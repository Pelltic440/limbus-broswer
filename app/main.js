'use strict';
const { app, BrowserWindow, ipcMain, session, shell, dialog, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const updater = require('./updater');
const adblock = require('./adblock');
const appupdate = require('./appupdate');
let adb = null;
let appu = null;
const boot = require('./boot');

const PART = 'persist:limbus';
const HUB_LIVE = 'https://claude.ai/artifact/AoRHBdKCvv9LgEDHAHvkDy';
const NEWTAB = pathToFileURL(path.join(__dirname, 'hub', 'index.html')).href + '?shell=1#home';
const ICON = path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const TEST = !!process.env.LB_TEST;
const CHROME_MAJOR = process.versions.chrome.split('.')[0];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + CHROME_MAJOR + '.0.0.0 Safari/537.36';
const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';

let win = null;
let guests = new Set();

if (!TEST && !app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setAppUserModelId('com.limbus.browser');
Menu.setApplicationMenu(null);

/* ---------- small stores ---------- */
const userFile = (n) => path.join(app.getPath('userData'), n);
function readJson(n, d) { try { return JSON.parse(fs.readFileSync(userFile(n), 'utf8')); } catch (e) { return d; } }
function writeJson(n, v) { try { fs.writeFileSync(userFile(n), JSON.stringify(v)); } catch (e) { /* not fatal */ } }
let perms = {};
const downloadPaths = new Set();

function sendShell(ch, data) { if (win && !win.isDestroyed()) win.webContents.send('lb:' + ch, data); }
function downloadsDir() { return process.env.LB_DOWNLOADS || app.getPath('downloads'); }
function originOf(u) { try { return new URL(u).origin; } catch (e) { return ''; } }

/* ---------- opening things outside the browser ---------- */
const EXTERNAL_OK = /^(https?:|mailto:|spotify:|steam:\/\/)/i;
function openExternalChecked(url, ask) {
  if (!EXTERNAL_OK.test(url)) return;
  const go = () => { if (TEST) { fs.appendFileSync(userFile('external.log'), url + '\n'); } else { shell.openExternal(url).catch(() => {}); } };
  if (!ask || TEST) return go();
  let scheme = url.split(':')[0];
  dialog.showMessageBox(win, { type: 'question', buttons: ['Open', 'Cancel'], defaultId: 1, cancelId: 1, title: 'Open another app?', message: 'A page wants to open a "' + scheme + '" link in another app.', detail: url.slice(0, 200) })
    .then((r) => { if (r.response === 0) go(); });
}
function isWebScheme(u) { return /^(https?|file|about|data|blob|view-source|devtools|chrome-extension):/i.test(u); }

/* ---------- keyboard shortcuts, one table for the window and every page ---------- */
const { commandFor } = require('./keys');
function hookInput(contents) {
  contents.on('before-input-event', (e, input) => {
    const c = commandFor(input);
    if (c) { e.preventDefault(); sendShell('cmd', c); }
  });
}

/* ---------- web pages (tabs and side panels) ---------- */
function isPopup(d) { return d.disposition === 'new-window' && /(^|[,\s])(width|height|popup|left|top)\b/i.test(d.features || ''); }
function attachGuest(contents) {
  guests.add(contents);
  contents.once('destroyed', () => guests.delete(contents));
  hookInput(contents);
  contents.on('did-start-navigation', (e) => { if (e.isMainFrame && !e.isSameDocument && adb) adb.resetCount(contents.id); });
  contents.setWindowOpenHandler((d) => {
    if (!isWebScheme(d.url)) { openExternalChecked(d.url, true); return { action: 'deny' }; }
    if (isPopup(d) || d.url === 'about:blank') {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: ICON, backgroundColor: '#0d0b0a' } };
    }
    sendShell('open-tab', { url: d.url, bg: d.disposition === 'background-tab' });
    return { action: 'deny' };
  });
  contents.on('will-navigate', (e, url) => {
    if (!isWebScheme(url)) { e.preventDefault(); openExternalChecked(url, true); }
  });
  contents.on('zoom-changed', (_e, dir) => sendShell('cmd', dir === 'in' ? 'zoomin' : 'zoomout'));
  contents.on('context-menu', (_e, p) => showContext(contents, p));
}
function showContext(wc, p) {
  const t = [];
  const sel = (p.selectionText || '').trim();
  const open = (url, bg) => sendShell('open-tab', { url, bg: !!bg });
  if (p.misspelledWord && p.dictionarySuggestions && p.dictionarySuggestions.length) {
    p.dictionarySuggestions.slice(0, 5).forEach((s) => t.push({ label: s, click: () => wc.replaceMisspelling(s) }));
    t.push({ type: 'separator' });
  }
  if (p.linkURL) {
    t.push({ label: 'Open link in new tab', click: () => open(p.linkURL) },
      { label: 'Open link in background tab', click: () => open(p.linkURL, true) },
      { label: 'Copy link address', click: () => clipboard.writeText(p.linkURL) }, { type: 'separator' });
  }
  if (p.mediaType === 'image' && p.srcURL) {
    t.push({ label: 'Open image in new tab', click: () => open(p.srcURL) },
      { label: 'Save image as…', click: () => wc.downloadURL(p.srcURL) },
      { label: 'Copy image', click: () => wc.copyImageAt(p.x, p.y) },
      { label: 'Copy image address', click: () => clipboard.writeText(p.srcURL) }, { type: 'separator' });
  } else if ((p.mediaType === 'video' || p.mediaType === 'audio') && p.srcURL && /^https?:/i.test(p.srcURL)) {
    t.push({ label: 'Save ' + p.mediaType + ' as…', click: () => wc.downloadURL(p.srcURL) },
      { label: 'Copy ' + p.mediaType + ' address', click: () => clipboard.writeText(p.srcURL) }, { type: 'separator' });
  }
  if (p.isEditable) {
    t.push({ label: 'Undo', enabled: p.editFlags.canUndo, click: () => wc.undo() }, { label: 'Redo', enabled: p.editFlags.canRedo, click: () => wc.redo() }, { type: 'separator' },
      { label: 'Cut', enabled: p.editFlags.canCut, click: () => wc.cut() }, { label: 'Copy', enabled: p.editFlags.canCopy, click: () => wc.copy() },
      { label: 'Paste', enabled: p.editFlags.canPaste, click: () => wc.paste() }, { label: 'Select all', click: () => wc.selectAll() });
  } else if (sel) {
    t.push({ label: 'Copy', click: () => wc.copy() });
    t.push({ label: 'Search for “' + (sel.length > 28 ? sel.slice(0, 28) + '…' : sel) + '”', click: () => sendShell('open-tab', { search: sel }) });
  }
  if (!p.linkURL && !sel && !p.isEditable && p.mediaType !== 'image') {
    const h = wc.navigationHistory;
    t.push({ label: 'Back', enabled: h.canGoBack(), click: () => h.goBack() }, { label: 'Forward', enabled: h.canGoForward(), click: () => h.goForward() },
      { label: 'Reload', click: () => wc.reload() }, { type: 'separator' }, { label: 'Select all', click: () => wc.selectAll() });
  }
  t.push({ type: 'separator' }, { label: 'Inspect element', click: () => wc.inspectElement(p.x, p.y) });
  while (t.length && t[0].type === 'separator') t.shift();
  Menu.buildFromTemplate(t).popup({ window: win });
}

/* ---------- permissions ---------- */
const SILENT_OK = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock', 'speaker-selection', 'window-management', 'storage-access', 'top-level-storage-access']);
const ASK = { media: 'your camera or microphone', notifications: 'show notifications', geolocation: 'know your location', 'clipboard-read': 'read your clipboard', midi: 'use MIDI devices', midiSysex: 'use MIDI devices', 'display-capture': 'record your screen' };
function setupSession(ses) {
  ses.setUserAgent(UA);
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://accounts.google.com/*'] }, (d, cb) => {
    const h = d.requestHeaders;
    Object.keys(h).forEach((k) => { if (/^sec-ch-ua/i.test(k)) delete h[k]; });
    h['User-Agent'] = FIREFOX_UA;
    cb({ requestHeaders: h });
  });
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    if (SILENT_OK.has(permission)) return cb(true);
    if (!ASK[permission]) return cb(false);
    const origin = originOf(details.requestingUrl || wc.getURL()) || 'This page';
    if (/^file:|^null$/.test(origin) || origin === 'This page') return cb(false);
    const key = origin + '|' + permission;
    if (key in perms) return cb(perms[key]);
    if (TEST) return cb(false);
    dialog.showMessageBox(win, { type: 'question', buttons: ['Allow', 'Block'], defaultId: 1, cancelId: 1, title: 'Site permission', message: origin + ' wants to ' + ASK[permission] + '.', checkboxLabel: 'Remember my choice for this site', checkboxChecked: true })
      .then((r) => { const ok = r.response === 0; if (r.checkboxChecked) { perms[key] = ok; writeJson('permissions.json', perms); } cb(ok); });
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => SILENT_OK.has(permission) || perms[(origin || '') + '|' + permission] === true);
  // downloads go straight to the Downloads folder and are listed in the browser's own panel
  let seq = 0;
  const items = new Map();
  ipcMain.on('lb:dl', (e, op, id) => {
    if (!fromShell(e)) return;
    const it = items.get(id);
    if (op === 'cancel' && it) it.cancel();
    if (op === 'pause' && it) it.pause();
    if (op === 'resume' && it && it.canResume()) it.resume();
  });
  ses.on('will-download', (_e, item) => {
    const id = ++seq, dir = downloadsDir();
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* exists */ }
    const ext = path.extname(item.getFilename()), base = path.basename(item.getFilename(), ext);
    let target = path.join(dir, item.getFilename()), n = 0;
    while (fs.existsSync(target)) { n++; target = path.join(dir, base + ' (' + n + ')' + ext); }
    item.setSavePath(target);
    downloadPaths.add(target);
    items.set(id, item);
    const send = (state) => sendShell('dl', { id, name: path.basename(target), url: item.getURL(), total: item.getTotalBytes(), received: item.getReceivedBytes(), state, path: target });
    send('progressing');
    item.on('updated', (_ev, st) => send(st === 'interrupted' ? 'interrupted' : (item.isPaused() ? 'paused' : 'progressing')));
    item.once('done', (_ev, st) => { send(st); items.delete(id); });
  });
}
function fromShell(e) { return win && !win.isDestroyed() && e.sender === win.webContents; }

/* ---------- main window ---------- */
function createWindow() {
  const st = readJson('window.json', {});
  win = new BrowserWindow({
    width: st.w || 1360, height: st.h || 860, x: st.x, y: st.y, minWidth: 760, minHeight: 480,
    backgroundColor: '#0d0b0a', show: false, icon: ICON, autoHideMenuBar: true,
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#0d0b0a', symbolColor: '#ece5da', height: 36 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: true, spellcheck: true }
  });
  if (st.max) win.maximize();
  win.once('ready-to-show', () => win.show());
  const save = () => { if (!win || win.isDestroyed()) return; const b = win.getNormalBounds(); writeJson('window.json', { x: b.x, y: b.y, w: b.width, h: b.height, max: win.isMaximized() }); };
  win.on('close', save);
  win.on('closed', () => { win = null; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  hookInput(win.webContents);
  win.webContents.on('will-attach-webview', (e, prefs, params) => {
    delete prefs.preload; delete prefs.preloadURL;
    prefs.nodeIntegration = false; prefs.contextIsolation = true; prefs.sandbox = true; prefs.webSecurity = true;
    params.partition = PART; params.allowpopups = true;
    if (!/^(https?:|file:|about:blank)/i.test(params.src || '')) e.preventDefault();
  });
  win.webContents.on('did-attach-webview', (_e, contents) => attachGuest(contents));
  win.webContents.once('did-finish-load', () => { setTimeout(() => { try { boot.confirm(); } catch (e) { /* not fatal */ } }, 1500); });
  win.loadFile(path.join(__dirname, 'ui', 'shell.html'));
}

ipcMain.handle('lb:info', (e) => fromShell(e) ? {
  newtab: NEWTAB, hub: HUB_LIVE, errorPage: pathToFileURL(path.join(__dirname, 'ui', 'error.html')).href, version: app.getVersion(), electron: process.versions.electron,
  chrome: process.versions.chrome, platform: process.platform, downloads: downloadsDir(), installed: !!updater.installDir(), args: process.argv.slice(1).filter((a) => /^https?:\/\//i.test(a)), test: TEST
} : null);
const RISKY = /\.(exe|msi|bat|cmd|com|scr|ps1|vbs|vbe|js|jse|wsf|lnk|hta|jar|reg|dll)$/i;
ipcMain.on('lb:external', (e, url) => {
  if (!fromShell(e)) return;
  const m = /^(file-show|file-open):(.+)$/.exec(url);
  if (m) {
    if (!downloadPaths.has(m[2])) return;
    if (TEST) { fs.appendFileSync(userFile('external.log'), url + '\n'); return; }
    if (m[1] === 'file-open' && !RISKY.test(m[2])) shell.openPath(m[2]); else shell.showItemInFolder(m[2]);
    return;
  }
  openExternalChecked(url, false);
});
ipcMain.on('lb:fullscreen', (e, on) => { if (fromShell(e)) win.setFullScreen(!!on); });
ipcMain.handle('lb:clear', async (e, what) => {
  if (!fromShell(e)) return false;
  const ses = session.fromPartition(PART);
  if (what === 'cache') await ses.clearCache();
  if (what === 'cookies') await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'] });
  return true;
});
ipcMain.handle('lb:perms', (e, op) => {
  if (!fromShell(e)) return null;
  if (op === 'reset') { perms = {}; writeJson('permissions.json', perms); }
  return Object.keys(perms).length;
});
ipcMain.handle('lb:update', async (e, op) => {
  if (!fromShell(e)) return null;
  try {
    if (op === 'check') return Object.assign({ ok: true, installed: !!updater.installDir() }, await updater.check());
    if (op.indexOf('apply:') === 0) { await updater.apply(op.slice(6)); return { ok: true }; }
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  return null;
});

app.whenReady().then(() => {
  perms = readJson('permissions.json', {});
  setupSession(session.fromPartition(PART));
  adb = adblock.create({ ses: session.fromPartition(PART), userFile, readJson, writeJson, sendShell, fromShell, test: TEST });
  appu = appupdate.create({ app, session: session.fromPartition(PART), userFile, readJson, writeJson, sendShell, fromShell, ipcMain, boot, test: TEST });
  createWindow();
  adb.start();
  appu.start();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  // popups (sign-in windows) get no menu bar and share the browser's session
  app.on('browser-window-created', (_e, w) => { if (w !== win) w.setMenuBarVisibility(false); });
  if (!TEST) setTimeout(() => {
    updater.check().then((r) => { if (r.patch || r.nextMajor) sendShell('update-state', Object.assign({ installed: !!updater.installDir() }, r)); }).catch(() => {});
  }, 45000);
});
app.on('second-instance', (_e, argv) => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); argv.filter((a) => /^https?:\/\//i.test(a)).forEach((u) => sendShell('open-tab', { url: u })); }
});
app.on('window-all-closed', () => app.quit());
