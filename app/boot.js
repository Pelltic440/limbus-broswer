'use strict';
// First file the browser runs. It applies an app update that was downloaded earlier (before anything else is
// loaded) and undoes it if the new version did not start properly. This file is never replaced by an update,
// so a broken update can always be rolled back.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const APP = __dirname;
const SELF = path.basename(__filename);
const UPD = path.join(app.getPath('userData'), 'app-update');
const NEXT = path.join(UPD, 'next');
const PREV = path.join(UPD, 'prev');
const NEXT_INFO = path.join(UPD, 'next.json');
const STATE = path.join(UPD, 'state.json');

function readState() {
  try { const s = JSON.parse(fs.readFileSync(STATE, 'utf8')); if (s && typeof s === 'object') return Object.assign({ bad: [] }, s); } catch (e) { /* first run */ }
  return { bad: [] };
}
function writeState(s) { fs.mkdirSync(UPD, { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s)); }
function rm(p) { fs.rmSync(p, { recursive: true, force: true }); }
function readVersion(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version; } catch (e) { return null; } }

// Replaces everything in the app folder (except this file) with the contents of `from`.
function swapIn(from) {
  for (const n of fs.readdirSync(APP)) if (n !== SELF) rm(path.join(APP, n));
  for (const n of fs.readdirSync(from)) if (n !== SELF) fs.cpSync(path.join(from, n), path.join(APP, n), { recursive: true });
}
function restart() {
  try { app.releaseSingleInstanceLock(); } catch (e) { /* not held */ }
  app.relaunch();
  app.exit(0);
}

let st = readState();
let relaunching = false;

function rollback(reason) {
  const bad = st.pending;
  if (fs.existsSync(path.join(PREV, 'package.json'))) swapIn(PREV);
  if (bad && st.bad.indexOf(bad) < 0) st.bad.push(bad);
  st = { bad: st.bad, pending: null, ok: true, rolledBack: { version: bad, at: Date.now(), reason: String(reason || 'did not start') } };
  rm(NEXT); rm(NEXT_INFO);
  writeState(st);
}

function applyPending() {
  const version = readVersion(NEXT);
  if (!version || !fs.existsSync(path.join(NEXT, 'main.js'))) { rm(NEXT); rm(NEXT_INFO); return false; }
  if (st.bad.indexOf(version) >= 0) { rm(NEXT); rm(NEXT_INFO); return false; }
  let notes = '';
  try { notes = String(JSON.parse(fs.readFileSync(NEXT_INFO, 'utf8')).notes || ''); } catch (e) { /* optional */ }
  const from = readVersion(APP);
  rm(PREV);
  fs.cpSync(APP, PREV, { recursive: true });
  try {
    swapIn(NEXT);
  } catch (err) {
    try { swapIn(PREV); } catch (e2) { /* nothing more to do */ }
    st.bad.push(version);
    st.lastError = String(err && err.message || err);
    writeState(st);
    return false;
  }
  rm(NEXT); rm(NEXT_INFO);
  st = { bad: st.bad, pending: version, ok: false, starts: 0, from, applied: { version, from, at: Date.now(), notes }, fresh: true };
  writeState(st);
  return true;
}

const TEST = !!process.env.LB_TEST;
if (!TEST && !app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

try {
  if (st.pending && !st.ok) {
    // The first start after an update is allowed to run. If it never confirmed itself, the next start undoes it.
    st.starts = (st.starts || 0) + 1;
    writeState(st);
    if (st.starts > 1) { rollback('the new version did not finish starting'); relaunching = true; restart(); }
  } else if (fs.existsSync(path.join(NEXT, 'package.json'))) {
    if (applyPending()) { relaunching = true; restart(); }
  }
} catch (err) {
  // Updating must never stop the browser from opening.
  try { st.lastError = String(err && err.message || err); writeState(st); } catch (e) { /* ignore */ }
}

module.exports = {
  paths: { UPD, NEXT, PREV, NEXT_INFO, STATE },
  restart,
  state: () => readState(),
  // main.js calls this once the browser window is up: the running version is good, keep it.
  confirm() { const s = readState(); if (s.pending) { s.ok = true; s.pending = null; writeState(s); } },
  clearFresh() { const s = readState(); if (s.fresh || s.rolledBack) { delete s.fresh; delete s.rolledBack; writeState(s); } }
};

if (!relaunching) {
  try {
    require('./main.js');
  } catch (err) {
    if (st.pending) { try { rollback(err && err.message); } catch (e) { /* ignore */ } restart(); }
    else throw err;
  }
}
