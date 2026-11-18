'use strict';
// Ad and tracker blocker. Uses the Ghostery filter engine (EasyList, EasyPrivacy, uBlock-style lists) in the
// browser's session: blocks requests, hides leftover ad boxes, supports an on/off switch and per-site pause.
const { ipcMain, webContents } = require('electron');
const fs = require('fs');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');

const FALLBACK = [
  '||doubleclick.net^', '||googlesyndication.com^', '||googleadservices.com^', '||adservice.google.com^', '||google-analytics.com^',
  '||adnxs.com^', '||taboola.com^', '||outbrain.com^', '||criteo.com^', '||criteo.net^', '||pubmatic.com^', '||rubiconproject.com^',
  '||openx.net^', '||adsrvr.org^', '||moatads.com^', '||scorecardresearch.com^', '||amazon-adsystem.com^', '||ads.youtube.com^',
  '||adform.net^', '||smartadserver.com^', '||casalemedia.com^', '||quantserve.com^', '||hotjar.com^$third-party',
  '##.adsbygoogle', '##ins.adsbygoogle', '##[id^="google_ads_iframe"]', '##.ad-slot', '##.ad-banner'
].join('\n');
const DAY = 24 * 3600e3;

function create(o) {
  const { ses, userFile, readJson, writeJson, sendShell, test } = o;
  const saved = readJson('adblock.json', {});
  const state = { enabled: saved.enabled !== false, paused: Array.isArray(saved.paused) ? saved.paused : [], ready: false, source: 'loading', updated: 0, total: 0, error: '' };
  let blocker = null, hooked = false, building = false, dirty = false;
  const counts = new Map();
  const save = () => writeJson('adblock.json', { enabled: state.enabled, paused: state.paused });
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const off = (wc) => {
    if (!state.enabled) return true;
    const h = wc && !wc.isDestroyed() ? hostOf(wc.getURL()) : '';
    return !!h && state.paused.indexOf(h) >= 0;
  };
  const wcOf = (id) => (id ? webContents.fromId(id) : null);

  function hook() {
    if (hooked) return; hooked = true;
    blocker.enableBlockingInSession(ses); // registers cosmetic-filter preload and handlers; we then wrap them below
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, cb) => {
      const wc = wcOf(details.webContentsId);
      if (!blocker || off(wc)) return cb({});
      blocker.onBeforeRequest(details, (r) => {
        if (r && (r.cancel || r.redirectURL) && details.webContentsId) {
          counts.set(details.webContentsId, (counts.get(details.webContentsId) || 0) + 1); state.total++; dirty = true;
        }
        cb(r);
      });
    });
    ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, cb) => {
      if (!blocker || off(wcOf(details.webContentsId))) return cb({});
      blocker.onHeadersReceived(details, cb);
    });
    ipcMain.removeHandler('@ghostery/adblocker/inject-cosmetic-filters');
    ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', (e, url, msg) => (blocker && !off(e.sender) ? blocker.onInjectCosmeticFilters(e, url, msg) : undefined));
    ipcMain.removeHandler('@ghostery/adblocker/is-mutation-observer-enabled');
    ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', (e) => (blocker && !off(e.sender) ? blocker.onIsMutationObserverEnabled(e) : false));
  }
  function use(b, source) { blocker = b; state.source = source; state.ready = true; hook(); }

  async function build(force) {
    if (building) return; building = true;
    try {
      if (test && process.env.LB_ADBLOCK_LIST) { use(ElectronBlocker.parse(fs.readFileSync(process.env.LB_ADBLOCK_LIST, 'utf8')), 'test'); return; }
      const cache = userFile('adblock-engine.bin');
      try { if (force || Date.now() - fs.statSync(cache).mtimeMs > DAY) fs.rmSync(cache, { force: true }); } catch (e) { /* no cache yet */ }
      const b = await ElectronBlocker.fromPrebuiltAdsAndTracking((u, init) => ses.fetch(u, init), { path: cache, read: fs.promises.readFile, write: fs.promises.writeFile });
      try { state.updated = fs.statSync(cache).mtimeMs; } catch (e) { state.updated = Date.now(); }
      state.error = ''; use(b, 'lists');
    } catch (e) {
      state.error = String((e && e.message) || e);
      if (!blocker) use(ElectronBlocker.parse(FALLBACK), 'basic');
    } finally {
      building = false; sendShell('adblock', snapshot());
    }
  }
  const snapshot = () => ({ enabled: state.enabled, ready: state.ready, source: state.source, updated: state.updated, total: state.total, paused: state.paused, error: state.error, counts: Object.fromEntries(counts) });

  ipcMain.handle('lb:adblock', async (e, op) => {
    if (!o.fromShell(e)) return null;
    if (op === 'toggle') { state.enabled = !state.enabled; save(); }
    else if (op === 'refresh') { await build(true); }
    else if (op.indexOf('pause:') === 0) { const h = op.slice(6); if (h && state.paused.indexOf(h) < 0) { state.paused.push(h); save(); } }
    else if (op.indexOf('resume:') === 0) { state.paused = state.paused.filter((x) => x !== op.slice(7)); save(); }
    return snapshot();
  });
  setInterval(() => { if (dirty) { dirty = false; sendShell('adblock', snapshot()); } }, 800);
  setInterval(() => { if (state.source !== 'test') build(false); }, 6 * 3600e3);
  setInterval(() => { if (state.source === 'basic') build(false); }, 20 * 60e3);
  return { start: () => build(false), resetCount: (id) => { if (counts.delete(id)) dirty = true; }, snapshot };
}
module.exports = { create };
