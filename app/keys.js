'use strict';
// One table of keyboard shortcuts, used for the window and for every page inside it.
function commandFor(i) {
  if (i.type !== 'keyDown') return null;
  const k = i.key, lk = k.length === 1 ? k.toLowerCase() : k;
  const ctrl = i.control || i.meta, shift = i.shift, alt = i.alt;
  if (ctrl && !alt) {
    if (lk === 't') return shift ? 'reopen' : 'newtab';
    if (lk === 'w') return 'closetab';
    if (lk === 'l') return 'address';
    if (lk === 'r') return shift ? 'hardreload' : 'reload';
    if (k === 'Tab') return shift ? 'prevtab' : 'nexttab';
    if (k === 'PageDown') return 'nexttab';
    if (k === 'PageUp') return 'prevtab';
    if (/^[1-9]$/.test(k)) return 'tab:' + k;
    if (lk === 'f') return 'find';
    if (lk === 'h') return 'history';
    if (lk === 'j') return 'downloads';
    if (lk === 'o' && shift) return 'bookmarks';
    if (lk === 'd') return 'bookmark';
    if (lk === 'p') return 'print';
    if (shift && lk === 'i') return 'devtools';
    if (k === '+' || k === '=') return 'zoomin';
    if (k === '-' || k === '_') return 'zoomout';
    if (k === '0') return 'zoomreset';
  }
  if (alt && !ctrl) {
    if (k === 'ArrowLeft') return 'back';
    if (k === 'ArrowRight') return 'forward';
    if (lk === 'd') return 'address';
    if (k === 'Home') return 'newtab';
  }
  if (k === 'F5') return ctrl ? 'hardreload' : 'reload';
  if (k === 'F6') return 'address';
  if (k === 'F11') return 'fullscreen';
  if (k === 'F12') return 'devtools';
  return null;
}
module.exports = { commandFor };
