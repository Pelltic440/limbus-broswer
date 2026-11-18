'use strict';
// Keeps the browser's own program files (the interface, the Hub, the data, the ad blocker code) current.
// It looks at the release/ folder of one GitHub repository that the user chose (main branch), downloads
// limbus-app.zip, checks it against the SHA-256 in limbus-app.json, unpacks it into a waiting folder and tells the window.
// boot.js applies the waiting update the next time the browser starts, and rolls it back if it fails to start.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Transform } = require('stream');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { extract } = require('./unzip');

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const VER_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const MAX_ZIP = 60 * 1024 * 1024;
const EVERY = 6 * 60 * 60 * 1000;

function newer(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}

function create(o) {
  const { app, session, userFile, readJson, writeJson, sendShell, fromShell, ipcMain, boot, test } = o;
  const fetchWeb = (url) => session.fetch(url, { headers: { 'User-Agent': 'LimbusBrowser-updater', Accept: 'application/vnd.github+json, application/octet-stream, */*' } });
  const api = (test && process.env.LB_UPDATE_API) || '';
  const defaults = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'update-default.json'), 'utf8')); } catch (e) { return {}; } })();
  let cfg = Object.assign({ repo: '', auto: true }, defaults, readJson('update.json', {}));
  if (typeof cfg.repo !== 'string' || (cfg.repo && !REPO_RE.test(cfg.repo))) cfg.repo = '';
  const saveCfg = () => writeJson('update.json', { repo: cfg.repo, auto: !!cfg.auto });

  const S = { state: cfg.repo ? 'idle' : 'nosource', repo: cfg.repo, auto: !!cfg.auto, current: app.getVersion(), latest: '', notes: '', error: '', checkedAt: 0, justApplied: null, rolledBack: null, lastError: '' };
  let busy = false, timer = null;

  function syncBoot() {
    const b = boot.state();
    S.justApplied = b.fresh && b.applied ? { version: b.applied.version, from: b.applied.from, notes: b.applied.notes || '' } : null;
    S.rolledBack = b.rolledBack ? { version: b.rolledBack.version } : null;
    S.lastError = b.lastError || '';
    // a finished download that is waiting for a restart
    let waiting = null;
    try {
      const v = JSON.parse(fs.readFileSync(path.join(boot.paths.NEXT, 'package.json'), 'utf8')).version;
      const info = JSON.parse(fs.readFileSync(boot.paths.NEXT_INFO, 'utf8'));
      if (VER_RE.test(v) && newer(v, S.current)) waiting = { version: v, notes: String(info.notes || '') };
    } catch (e) { /* none waiting */ }
    if (waiting) { S.state = 'ready'; S.latest = waiting.version; S.notes = waiting.notes; }
    return b;
  }
  function publish() { sendShell('appupdate', snap()); }
  function snap() { return Object.assign({}, S); }

  async function getJson(url) {
    const r = await fetchWeb(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  // update files live in the repository's release/ folder on the main branch
  function fileUrl(name) {
    return (test ? api + '/raw/' + cfg.repo + '/main/release/' : 'https://raw.githubusercontent.com/' + cfg.repo + '/main/release/') + name;
  }

  async function check(opts) {
    if (!cfg.repo) { S.state = 'nosource'; publish(); return snap(); }
    if (busy) return snap();
    busy = true;
    try {
      syncBoot();
      if (S.state !== 'ready') { S.state = 'checking'; S.error = ''; publish(); }
      const manifest = await getJson(fileUrl('limbus-app.json'));
      if (!manifest || !VER_RE.test(String(manifest.version)) || !/^[0-9a-f]{64}$/i.test(String(manifest.sha256))) throw new Error('The update information is not valid');
      S.checkedAt = Date.now();
      const bad = boot.state().bad || [];
      if (!newer(manifest.version, S.current) || bad.indexOf(manifest.version) >= 0) {
        if (S.state !== 'ready') { S.state = 'current'; S.latest = manifest.version; S.notes = ''; }
        return snap();
      }
      if (manifest.minElectron && newer(String(manifest.minElectron), process.versions.electron)) {
        S.state = 'engine'; S.latest = manifest.version; S.notes = 'This version needs a newer engine (Electron ' + manifest.minElectron + '). Update the engine first.';
        return snap();
      }
      if (S.state === 'ready' && S.latest === manifest.version) return snap();
      S.latest = manifest.version; S.notes = String(manifest.notes || '').slice(0, 2000);
      if (cfg.auto || (opts && opts.download)) { busy = false; return await download(manifest, fileUrl('limbus-app.zip')); }
      S.state = 'available';
    } catch (err) {
      S.state = 'error'; S.error = String(err && err.message || err);
    } finally { busy = false; publish(); }
    return snap();
  }

  async function download(manifest, zipUrl) {
    busy = true;
    S.state = 'downloading'; publish();
    const work = path.join(boot.paths.UPD, 'work');
    try {
      fs.rmSync(work, { recursive: true, force: true });
      fs.mkdirSync(work, { recursive: true });
      const zip = path.join(work, 'limbus-app.zip');
      const res = await fetchWeb(zipUrl);
      if (!res.ok || !res.body) throw new Error('Download failed (HTTP ' + res.status + ')');
      let seen = 0;
      const cap = new Transform({ transform(chunk, _e, cb) { seen += chunk.length; if (seen > MAX_ZIP) cb(new Error('The update file is larger than allowed')); else cb(null, chunk); } });
      await pipeline(Readable.fromWeb(res.body), cap, fs.createWriteStream(zip));
      const hash = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
      if (hash !== String(manifest.sha256).toLowerCase()) throw new Error('The downloaded update does not match its checksum, so it was thrown away');
      const dir = path.join(work, 'x');
      extract(zip, dir);
      let pkg;
      try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch (e) { throw new Error('The update has no package.json'); }
      if (pkg.version !== manifest.version) throw new Error('The update version does not match its release');
      if (pkg.main !== 'boot.js' || !fs.existsSync(path.join(dir, 'main.js'))) throw new Error('The update is not a complete browser package');
      fs.rmSync(boot.paths.NEXT, { recursive: true, force: true });
      fs.renameSync(dir, boot.paths.NEXT);
      fs.writeFileSync(boot.paths.NEXT_INFO, JSON.stringify({ version: manifest.version, notes: String(manifest.notes || '').slice(0, 2000) }));
      S.state = 'ready';
    } catch (err) {
      S.state = 'error'; S.error = String(err && err.message || err);
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
      busy = false; publish();
    }
    return snap();
  }

  ipcMain.handle('lb:appupdate', async (e, op) => {
    if (!fromShell(e)) return null;
    op = String(op || '');
    if (op === 'state') { syncBoot(); return snap(); }
    if (op === 'check') return check({});
    if (op === 'download') return check({ download: true });
    if (op === 'restart') { if (S.state === 'ready') boot.restart(); return snap(); }
    if (op === 'seen') { boot.clearFresh(); S.justApplied = null; S.rolledBack = null; return snap(); }
    if (op.indexOf('auto:') === 0) { cfg.auto = op.slice(5) === 'on'; S.auto = cfg.auto; saveCfg(); return snap(); }
    if (op.indexOf('repo:') === 0) {
      const v = op.slice(5).trim().replace(/^https:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
      if (v && !REPO_RE.test(v)) { S.error = 'That is not a GitHub repository name. Use the form owner/name.'; S.state = 'error'; return snap(); }
      cfg.repo = v; S.repo = v; S.error = ''; S.state = v ? 'idle' : 'nosource'; saveCfg();
      return v ? check({}) : snap();
    }
    return null;
  });

  function start() {
    syncBoot();
    if (test) return;
    setTimeout(() => { check({}); }, 2 * 60 * 1000);
    timer = setInterval(() => { check({}); }, EVERY);
    if (timer.unref) timer.unref();
  }
  return { start, check, snapshot: snap };
}

module.exports = { create, newer };
