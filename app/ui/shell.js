(function () {
  'use strict';
  var C = window.LCBContent, K = window.LCBCore;
  var PART = 'persist:limbus';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage is optional */ } }

  /* ---------- icons ---------- */
  var P = {
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 5l-7 7 7 7"/>', fwd: '<path d="M9 5l7 7-7 7"/>',
    reload: '<path d="M20 11a8 8 0 1 0-2.3 5.6"/><path d="M20 4v7h-7"/>', stop: '<path d="M6 6l12 12M18 6L6 18"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>', star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
    dl: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', menu: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v5M12 18v.5"/>', up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    bm: '<path d="M7 4h10v16l-5-4-5 4z"/>', hist: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/><path d="M12 8v5l3 2"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>', shieldoff: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M5 5l14 14"/>',
    tab: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9h16"/>', search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'
  };
  function svg(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>'; }

  /* ---------- settings and stores ---------- */
  var ENGINES = { google: ['Google', 'https://www.google.com/search?q=%s'], duckduckgo: ['DuckDuckGo', 'https://duckduckgo.com/?q=%s'], bing: ['Bing', 'https://www.bing.com/search?q=%s'], brave: ['Brave Search', 'https://search.brave.com/search?q=%s'] };
  var set = Object.assign({ engine: 'google', startup: 'restore', sinner: '', panelW: 440 }, lsGet('lb.settings', {}));
  function saveSet() { lsSet('lb.settings', set); }
  var bookmarks = lsGet('lb.bookmarks', []);
  var history = lsGet('lb.history', []);
  var zooms = lsGet('lb.zoom', {});
  var closed = [];
  var info = null;

  /* ---------- theme: a Sinner on duty each day ---------- */
  var SINNER = null;
  function pickSinner() {
    var keys = C.SINNERS.map(function (s) { return s.k; });
    var k = set.sinner && keys.indexOf(set.sinner) >= 0 ? set.sinner : K.sinnerOfDay(new Date(), keys, C.BIRTHDAYS);
    SINNER = C.SINNERS.filter(function (s) { return s.k === k; })[0];
    document.documentElement.style.setProperty('--sinner', SINNER.c);
    $('#brandName').textContent = SINNER.n;
  }
  function slot() { return K.daySlot(new Date().getHours()); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function greet() {
    var hello = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Late hours' }[slot()];
    var lines = C.LINES[SINNER.k][slot()] || C.LINES[SINNER.k].poke;
    toast(hello + ', Manager. ' + SINNER.n + ' is on duty.', { quote: pick(lines), ms: 7000 });
  }

  /* ---------- toasts and small menus ---------- */
  function toast(msg, o) {
    o = o || {};
    var el = document.createElement('div'); el.className = 'toast';
    el.innerHTML = '<div>' + esc(msg) + '</div>' + (o.quote ? '<div class="q">“' + esc(o.quote) + '”</div>' : '');
    if (o.actions) {
      var acts = document.createElement('div'); acts.className = 'acts';
      o.actions.forEach(function (a) { var b = document.createElement('button'); b.className = 'small'; b.textContent = a.label; b.addEventListener('click', function () { a.fn(); el.remove(); }); acts.appendChild(b); });
      el.appendChild(acts);
    }
    $('#toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, o.ms || 4200);
    return el;
  }
  function menu(x, y, items) {
    var m = $('#ctxmenu'); m.innerHTML = '';
    items.forEach(function (it) { var d = document.createElement('div'); d.textContent = it[0]; d.addEventListener('click', function () { m.hidden = true; it[1](); }); m.appendChild(d); });
    m.hidden = false;
    m.style.left = Math.min(x, window.innerWidth - 210) + 'px'; m.style.top = Math.min(y, window.innerHeight - 20 - items.length * 32) + 'px';
  }
  document.addEventListener('mousedown', function (e) { if (!e.target.closest('#ctxmenu')) $('#ctxmenu').hidden = true; });

  /* ---------- tabs ---------- */
  var tabs = [], cur = null, seq = 0;
  function tabById(id) { return tabs.filter(function (t) { return t.id === id; })[0]; }
  function isStart(u) { return !!u && !!info && u.indexOf(info.newtab.split('?')[0]) === 0; }
  function isErrorPage(u) { return !!u && !!info && u.indexOf(info.errorPage) === 0; }
  function shownUrl(u) {
    if (!u || isStart(u)) return '';
    if (isErrorPage(u)) { try { return new URL(u).searchParams.get('u') || ''; } catch (e) { return ''; } }
    return u;
  }
  function looksLikeUrl(t) {
    if (/^localhost(:\d+)?([\/?#]|$)/i.test(t) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?([\/?#]|$)/.test(t)) return true;
    if (/^[a-z][a-z0-9+.\-]*:\/\//i.test(t)) return true;
    return /^[^\s\/?#]+\.[a-z]{2,}(:\d+)?([\/?#]\S*)?$/i.test(t);
  }
  function resolve(text) {
    var t = String(text || '').trim(); if (!t) return '';
    if (t === 'about:blank') return t;
    if (looksLikeUrl(t)) {
      if (!/^[a-z][a-z0-9+.\-]*:\/\//i.test(t)) t = (/^(localhost|\d{1,3}(\.\d{1,3}){3})/i.test(t) ? 'http://' : 'https://') + t;
      return t;
    }
    return (ENGINES[set.engine] || ENGINES.google)[1].replace('%s', encodeURIComponent(t));
  }
  function newTab(url, o) {
    o = o || {};
    url = url || info.newtab;
    var wv = document.createElement('webview');
    wv.setAttribute('partition', PART); wv.setAttribute('allowpopups', '');
    var t = { id: ++seq, wv: wv, url: url, title: '', fav: '', loading: true, audible: false, muted: false, ready: false, canBack: false, canFwd: false, find: '' };
    wire(t);
    wv.setAttribute('src', url);
    $('#views').appendChild(wv);
    var at = o.after != null ? tabs.indexOf(tabById(o.after)) + 1 : tabs.length;
    tabs.splice(at, 0, t);
    if (!o.bg) activate(t.id); else renderTabs();
    saveSession();
    return t;
  }
  function wire(t) {
    var wv = t.wv;
    function on(ev, fn) { wv.addEventListener(ev, fn); }
    on('dom-ready', function () { t.ready = true; try { t.wcId = wv.getWebContentsId(); } catch (e) { /* not ready */ } applyZoom(t); if (t === cur) syncNav(); });
    on('did-start-loading', function () { t.loading = true; renderTabs(); if (t === cur) syncNav(); });
    on('did-stop-loading', function () { t.loading = false; renderTabs(); if (t === cur) syncNav(); });
    on('did-navigate', function (e) { onNav(t, e.url); });
    on('did-navigate-in-page', function (e) { if (e.isMainFrame) onNav(t, e.url); });
    on('page-title-updated', function (e) { t.title = e.title; renderTabs(); touchHistory(t); });
    on('page-favicon-updated', function (e) { t.fav = (e.favicons || [])[0] || ''; renderTabs(); });
    on('media-started-playing', function () { t.audible = true; renderTabs(); });
    on('media-paused', function () { t.audible = false; renderTabs(); });
    on('update-target-url', function (e) { var b = $('#bubble'); if (e.url && t === cur) { b.textContent = e.url; b.hidden = false; } else b.hidden = true; });
    on('did-fail-load', function (e) {
      if (!e.isMainFrame || e.errorCode === -3 || e.errorCode === 0) return;
      if (/^file:/i.test(e.validatedURL) && !isErrorPage(e.validatedURL)) return;
      if (isErrorPage(e.validatedURL)) return;
      var u = info.errorPage + '?u=' + encodeURIComponent(e.validatedURL) + '&c=' + encodeURIComponent(e.errorDescription || '');
      t.url = e.validatedURL; wv.loadURL(u).catch(function () {});
    });
    on('render-process-gone', function () { toast('This tab crashed. Reload it to continue.'); });
    on('enter-html-full-screen', function () { document.body.classList.add('fs'); window.lb.fullscreen(true); });
    on('leave-html-full-screen', function () { document.body.classList.remove('fs'); window.lb.fullscreen(false); });
    on('found-in-page', function (e) { if (t === cur) { var r = e.result || {}; $('#findCount').textContent = r.matches ? r.activeMatchOrdinal + ' / ' + r.matches : (t.find ? 'No matches' : ''); } });
  }
  function onNav(t, url) {
    t.url = isErrorPage(url) ? (shownUrl(url) || t.url) : url;
    if (t.ready) applyZoom(t);
    if (!isErrorPage(url) && !isStart(url) && /^https?:/i.test(url)) addHistory(url, t.title);
    if (t === cur) syncAddr();
    renderTabs(); saveSession();
  }
  function navigate(t, url) {
    t.url = url;
    if (t.ready) { t.wv.loadURL(url).catch(function () {}); } else { t.wv.setAttribute('src', url); }
    if (t === cur) syncAddr();
  }
  function activate(id) {
    var t = tabById(id); if (!t) return;
    cur = t;
    tabs.forEach(function (x) { x.wv.classList.toggle('on', x === t); });
    $('#findbar').hidden = true; $('#bubble').hidden = true;
    renderTabs(); syncAddr(); syncNav();
    if (t.ready) { try { t.wv.focus(); } catch (e) { /* not ready */ } }
    saveSession();
  }
  function closeTab(id, noRemember) {
    var i = tabs.findIndex(function (t) { return t.id === id; }); if (i < 0) return;
    var t = tabs[i];
    if (!noRemember && /^https?:/i.test(t.url)) { closed.push({ url: t.url, title: t.title }); if (closed.length > 15) closed.shift(); }
    t.wv.remove(); tabs.splice(i, 1);
    if (!tabs.length) { newTab(); return; }
    if (cur === t) activate(tabs[Math.min(i, tabs.length - 1)].id); else renderTabs();
    saveSession();
  }
  function initial(t) { var h = ''; try { h = new URL(t.url).hostname.replace(/^www\./, ''); } catch (e) { /* no host */ } return (h[0] || 'L').toUpperCase(); }
  function renderTabs() {
    var el = $('#tabs');
    el.innerHTML = tabs.map(function (t) {
      var title = t.title || (isStart(t.url) ? 'Start page' : shownUrl(t.url) || 'New tab');
      var lead = t.loading ? '<span class="spin"></span>' : (t.fav ? '<img class="fav" src="' + esc(t.fav) + '" alt="">' : '<span class="mono">' + esc(isStart(t.url) ? '◆' : initial(t)) + '</span>');
      return '<div class="tab' + (t === cur ? ' on' : '') + '" data-id="' + t.id + '" role="tab" aria-selected="' + (t === cur) + '" title="' + esc(title) + '">' + lead + '<span class="ttl">' + esc(title) + '</span>' +
        (t.audible && !t.muted ? '<span class="aud" title="Playing sound">♪</span>' : '') + '<button class="x" data-x="' + t.id + '" aria-label="Close tab">' + svg('close').replace('<svg', '<svg width="12" height="12"') + '</button></div>';
    }).join('');
    document.title = (cur && cur.title ? cur.title + ' – ' : '') + 'Limbus Browser';
  }
  $('#tabs').addEventListener('mousedown', function (e) {
    var x = e.target.closest('[data-x]'), tab = e.target.closest('.tab');
    if (e.button === 1 && tab) { e.preventDefault(); closeTab(+tab.getAttribute('data-id')); return; }
    if (e.button !== 0 || x || !tab) return;
    activate(+tab.getAttribute('data-id'));
  });
  $('#tabs').addEventListener('click', function (e) { var x = e.target.closest('[data-x]'); if (x) closeTab(+x.getAttribute('data-x')); });
  $('#tabs').addEventListener('error', function (e) { if (e.target.classList && e.target.classList.contains('fav')) { var t = tabById(+e.target.closest('.tab').getAttribute('data-id')); if (t) { t.fav = ''; renderTabs(); } } }, true);
  $('#tabs').addEventListener('contextmenu', function (e) {
    var tab = e.target.closest('.tab'); if (!tab) return; e.preventDefault();
    var t = tabById(+tab.getAttribute('data-id'));
    menu(e.clientX, e.clientY, [
      ['Reload', function () { try { t.wv.reload(); } catch (x) { /* not ready */ } }],
      ['Duplicate', function () { newTab(t.url, { after: t.id }); }],
      [t.muted ? 'Unmute tab' : 'Mute tab', function () { t.muted = !t.muted; try { t.wv.setAudioMuted(t.muted); } catch (x) { /* not ready */ } renderTabs(); }],
      ['Close tab', function () { closeTab(t.id); }],
      ['Close other tabs', function () { tabs.slice().forEach(function (o) { if (o !== t) closeTab(o.id, true); }); }],
      ['Close tabs to the right', function () { var i = tabs.indexOf(t); tabs.slice(i + 1).forEach(function (o) { closeTab(o.id, true); }); }]
    ]);
  });
  $('#newTab').addEventListener('click', function () { newTab(); $('#addr').focus(); });

  /* ---------- toolbar and address bar ---------- */
  var addr = $('#addr'), sugg = $('#sugg'), suggIx = -1, suggItems = [];
  $('#newTab').innerHTML = svg('plus'); $('#back').innerHTML = svg('back'); $('#fwd').innerHTML = svg('fwd'); $('#reload').innerHTML = svg('reload');
  $('#homeBtn').innerHTML = svg('home'); $('#star').innerHTML = svg('star'); $('#dlBtn').innerHTML = svg('dl'); $('#menuBtn').innerHTML = svg('cog');
  $('#findPrev').innerHTML = svg('up'); $('#findNext').innerHTML = svg('down'); $('#findClose').innerHTML = svg('close'); $('#panelClose').innerHTML = svg('close'); $('#panelTab').innerHTML = svg('tab');
  function syncAddr() {
    if (!cur) return;
    if (document.activeElement !== addr) addr.value = shownUrl(cur.url).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    var u = shownUrl(cur.url), lock = $('#lock');
    lock.className = /^https:/i.test(u) ? 'secure' : (/^http:/i.test(u) ? 'warn' : '');
    lock.innerHTML = u ? svg(/^http:/i.test(u) ? 'warn' : /^https:/i.test(u) ? 'lock' : 'search') : svg('search');
    $('#star').classList.toggle('on', isBookmarked(u));
    refreshShield();
  }
  function syncNav() {
    if (!cur) return;
    var b = false, f = false, ld = cur.loading;
    if (cur.ready) { try { b = cur.wv.canGoBack(); f = cur.wv.canGoForward(); } catch (e) { /* not ready */ } }
    $('#back').disabled = !b; $('#fwd').disabled = !f;
    $('#reload').innerHTML = svg(ld ? 'stop' : 'reload'); $('#reload').title = ld ? 'Stop' : 'Reload (Ctrl+R)';
  }
  addr.addEventListener('focus', function () { if (cur) addr.value = shownUrl(cur.url); addr.select(); showSugg(); });
  addr.addEventListener('blur', function () { setTimeout(function () { sugg.hidden = true; syncAddr(); }, 120); });
  addr.addEventListener('input', showSugg);
  addr.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!suggItems.length) return; suggIx = (suggIx + (e.key === 'ArrowDown' ? 1 : -1) + suggItems.length) % suggItems.length; paintSugg(); addr.value = suggItems[suggIx].fill; }
    else if (e.key === 'Enter') { e.preventDefault(); var url = suggIx >= 0 ? suggItems[suggIx].go : resolve(addr.value); sugg.hidden = true; if (url) go(url, e.altKey); addr.blur(); }
    else if (e.key === 'Escape') { sugg.hidden = true; if (cur) addr.value = shownUrl(cur.url); addr.blur(); }
  });
  function go(url, inNew) { if (inNew || !cur) newTab(url); else { navigate(cur, url); try { cur.wv.focus(); } catch (e) { /* not ready */ } } }
  function showSugg() {
    var q = addr.value.trim(), ql = q.toLowerCase(); suggItems = []; suggIx = -1;
    if (q) {
      suggItems.push({ kind: looksLikeUrl(q) ? 'Go' : 'Search', title: q, sub: looksLikeUrl(q) ? resolve(q) : (ENGINES[set.engine] || ENGINES.google)[0], go: resolve(q), fill: q });
      var seen = {};
      bookmarks.concat(history).forEach(function (x) {
        if (suggItems.length >= 8 || seen[x.u]) return;
        if ((x.u + ' ' + (x.t || '')).toLowerCase().indexOf(ql) >= 0) { seen[x.u] = 1; suggItems.push({ kind: bookmarks.indexOf(x) >= 0 ? 'Bookmark' : 'History', title: x.t || x.u, sub: x.u, go: x.u, fill: x.u }); }
      });
    }
    if (!suggItems.length) { sugg.hidden = true; return; }
    sugg.hidden = false; paintSugg();
  }
  function paintSugg() {
    sugg.innerHTML = suggItems.map(function (s, i) { return '<div class="row' + (i === suggIx ? ' sel' : '') + '" data-i="' + i + '"><i>' + esc(s.kind) + '</i><b>' + esc(s.title) + '</b><span>' + esc(s.sub) + '</span></div>'; }).join('');
  }
  sugg.addEventListener('mousedown', function (e) { var r = e.target.closest('.row'); if (!r) return; e.preventDefault(); var s = suggItems[+r.getAttribute('data-i')]; sugg.hidden = true; go(s.go, e.ctrlKey); addr.blur(); });
  $('#back').addEventListener('click', function () { if (cur && cur.ready) cur.wv.goBack(); });
  $('#fwd').addEventListener('click', function () { if (cur && cur.ready) cur.wv.goForward(); });
  $('#reload').addEventListener('click', function () { if (!cur || !cur.ready) return; if (cur.loading) cur.wv.stop(); else cur.wv.reload(); });
  $('#homeBtn').addEventListener('click', function () { newTab(); });
  $('#star').addEventListener('click', toggleBookmark);
  $('#dlBtn').addEventListener('click', function () { drawer('downloads'); });
  $('#menuBtn').addEventListener('click', function () { drawer('settings'); });
  $('#brand').addEventListener('click', function () { toast(SINNER.n + ' says:', { quote: pick(C.LINES[SINNER.k].poke) }); });

  /* ---------- ad blocker ---------- */
  var ad = { enabled: true, ready: false, source: 'loading', total: 0, paused: [], counts: {}, updated: 0, error: '' };
  function adHost() { var u = cur ? shownUrl(cur.url) : ''; try { return /^https?:/i.test(u) ? new URL(u).hostname.replace(/^www\./, '') : ''; } catch (e) { return ''; } }
  function adOffHere() { var h = adHost(); return !ad.enabled || (h && ad.paused.indexOf(h) >= 0); }
  function refreshShield() {
    var b = $('#shield'), n = cur && cur.wcId ? (ad.counts[cur.wcId] || 0) : 0, off = adOffHere();
    b.innerHTML = svg(off ? 'shieldoff' : 'shield') + (n && !off ? '<span id="shieldN">' + (n > 99 ? '99+' : n) + '</span>' : '');
    b.classList.toggle('off', off);
    b.title = !ad.enabled ? 'Ad blocker is off' : off ? 'Ad blocker paused on this site' : 'Ad blocker on. Blocked ' + n + ' on this page';
  }
  function applyAd(s) {
    if (!s) return;
    var changed = s.enabled !== ad.enabled || s.source !== ad.source || s.updated !== ad.updated || s.paused.length !== ad.paused.length;
    ad = s; refreshShield();
    if (changed && drawerMode === 'settings') drawer('settings', true);
  }
  $('#shield').addEventListener('click', function () {
    var r = this.getBoundingClientRect(), h = adHost(), paused = !!h && ad.paused.indexOf(h) >= 0, n = cur && cur.wcId ? (ad.counts[cur.wcId] || 0) : 0, items = [];
    items.push([ad.enabled ? 'Ad blocker is ON. Click to turn off' : 'Ad blocker is OFF. Click to turn on', function () { window.lb.adblock('toggle').then(applyAd); }]);
    if (h && ad.enabled) items.push([paused ? 'Resume blocking on ' + h : 'Pause on ' + h + ' (if the site looks broken)', function () { window.lb.adblock((paused ? 'resume:' : 'pause:') + h).then(function (s) { applyAd(s); if (cur && cur.ready) cur.wv.reload(); }); }]);
    items.push(['Blocked on this page: ' + n, function () { /* info only */ }], ['Blocked since the browser opened: ' + ad.total, function () { /* info only */ }]);
    menu(r.left - 200, r.bottom + 4, items);
  });
  window.lb.on('adblock', applyAd);

  /* ---------- bookmarks and history ---------- */
  function isBookmarked(u) { return !!u && bookmarks.some(function (b) { return b.u === u; }); }
  function toggleBookmark() {
    if (!cur) return; var u = shownUrl(cur.url); if (!/^https?:/i.test(u)) { toast('Open a web page first, then bookmark it.'); return; }
    if (isBookmarked(u)) { bookmarks = bookmarks.filter(function (b) { return b.u !== u; }); toast('Bookmark removed'); }
    else { bookmarks.unshift({ u: u, t: cur.title || u, ts: Date.now() }); toast('Bookmarked'); }
    lsSet('lb.bookmarks', bookmarks); syncAddr(); if (drawerMode === 'bookmarks') drawer('bookmarks', true);
  }
  function addHistory(u, title) {
    if (history[0] && history[0].u === u) { history[0].ts = Date.now(); if (title) history[0].t = title; }
    else history.unshift({ u: u, t: title || '', ts: Date.now() });
    if (history.length > 2000) history.length = 2000;
    clearTimeout(addHistory.t); addHistory.t = setTimeout(function () { lsSet('lb.history', history); }, 1500);
  }
  function touchHistory(t) { if (history[0] && history[0].u === t.url && t.title) { history[0].t = t.title; } }

  /* ---------- zoom ---------- */
  var STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  function origin(u) { try { return new URL(u).origin; } catch (e) { return ''; } }
  function applyZoom(t) { var z = zooms[origin(t.url)] || 1; try { t.wv.setZoomFactor(z); } catch (e) { /* not ready */ } }
  function zoom(dir) {
    if (!cur || !cur.ready) return; var o = origin(cur.url), z = zooms[o] || 1, ix = 0;
    STEPS.forEach(function (s, i) { if (Math.abs(s - z) < Math.abs(STEPS[ix] - z)) ix = i; });
    var n = dir === 0 ? 1 : STEPS[Math.max(0, Math.min(STEPS.length - 1, ix + dir))];
    if (n === 1) delete zooms[o]; else zooms[o] = n;
    lsSet('lb.zoom', zooms); applyZoom(cur); toast('Zoom ' + Math.round(n * 100) + '%', { ms: 1200 });
  }

  /* ---------- find in page ---------- */
  function openFind() { var b = $('#findbar'); b.hidden = false; var i = $('#findInput'); i.focus(); i.select(); if (i.value) doFind(false, true); }
  function closeFind() { $('#findbar').hidden = true; if (cur && cur.ready) { try { cur.wv.stopFindInPage('clearSelection'); cur.wv.focus(); } catch (e) { /* not ready */ } } }
  function doFind(back, first) {
    var v = $('#findInput').value; if (!cur || !cur.ready) return; cur.find = v;
    if (!v) { try { cur.wv.stopFindInPage('clearSelection'); } catch (e) { /* ignore */ } $('#findCount').textContent = ''; return; }
    cur.wv.findInPage(v, { forward: !back, findNext: !first });
  }
  $('#findInput').addEventListener('input', function () { doFind(false, true); });
  $('#findInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doFind(e.shiftKey, false); } if (e.key === 'Escape') closeFind(); });
  $('#findNext').addEventListener('click', function () { doFind(false, false); });
  $('#findPrev').addEventListener('click', function () { doFind(true, false); });
  $('#findClose').addEventListener('click', closeFind);

  /* ---------- side rail and panels ---------- */
  var RAIL = [
    { id: 'start', name: 'New tab', icon: 'home', fn: function () { newTab(); } },
    { id: 'hub', name: 'Limbus Hub (synced with your phone)', mono: 'LH', color: 'var(--sinner)', tab: function () { return info.hub; } },
    '-',
    { id: 'wa', name: 'WhatsApp', mono: 'WA', color: '#25d366', url: 'https://web.whatsapp.com/', panel: true },
    { id: 'sp', name: 'Spotify', mono: 'SP', color: '#1ed760', url: 'https://open.spotify.com/', panel: true, act: ['Open Spotify app', 'spotify:'], note: 'Music playback needs the Spotify app; this browser cannot play protected audio.' },
    { id: 'cl', name: 'Claude', mono: 'C', color: '#d97757', url: 'https://claude.ai/new', panel: true },
    { id: 'gp', name: 'ChatGPT', mono: 'GPT', color: '#b8c2cc', url: 'https://chatgpt.com/', panel: true },
    { id: 'ge', name: 'Gemini', mono: 'G', color: '#8ab4f8', url: 'https://gemini.google.com/app', panel: true },
    { id: 'yt', name: 'YouTube', mono: 'YT', color: '#ff4e45', url: 'https://www.youtube.com/' },
    { id: 'st', name: 'Steam', mono: 'ST', color: '#66c0f4', url: 'https://store.steampowered.com/', act: ['Launch Limbus Company', 'steam://rungameid/1973530'] },
    '-',
    { id: 'wk', name: 'Limbus Company wiki', mono: 'W', color: '#c8a45a', url: 'https://limbuscompany.wiki.gg/' },
    { id: 'pr', name: 'Prydwen', mono: 'P', color: '#c8a45a', url: 'https://www.prydwen.gg/limbus-company/' },
    { id: 'gl', name: 'Great Limbus Library', mono: 'GLL', color: '#c8a45a', url: 'https://gll-fun.com/limbus/en/' },
    { id: 'ld', name: 'Limbus Deck', mono: 'LD', color: '#c8a45a', url: 'https://limbusdeck.com/en' },
    { id: 'nw', name: 'Official Limbus news', mono: 'N', color: '#c8a45a', url: 'https://steamcommunity.com/app/1973530/allnews/' },
    'sp',
    { id: 'bm', name: 'Bookmarks', icon: 'bm', fn: function () { drawer('bookmarks'); } },
    { id: 'hi', name: 'History', icon: 'hist', fn: function () { drawer('history'); } },
    { id: 'dl', name: 'Downloads', icon: 'dl', fn: function () { drawer('downloads'); } },
    { id: 'se', name: 'Settings', icon: 'cog', fn: function () { drawer('settings'); } }
  ];
  var panelApp = null, panels = {};
  function renderRail() {
    $('#rail').innerHTML = RAIL.map(function (r, i) {
      if (r === '-') return '<hr>'; if (r === 'sp') return '<div class="sp"></div>';
      var body = r.icon ? svg(r.icon) : '<span class="m" style="--c:' + r.color + '">' + esc(r.mono) + '</span>';
      return '<button class="ri' + (panelApp === r.id ? ' on' : '') + '" data-i="' + i + '" data-name="' + esc(r.name) + '" aria-label="' + esc(r.name) + '">' + body + '</button>';
    }).join('');
  }
  $('#rail').addEventListener('click', function (e) {
    var b = e.target.closest('.ri'); if (!b) return; var r = RAIL[+b.getAttribute('data-i')];
    if (r.fn) return r.fn();
    if (r.panel && !e.shiftKey && !e.ctrlKey) return togglePanel(r);
    openOrFocus(r.tab ? r.tab() : r.url, e.ctrlKey || e.shiftKey);
  });
  $('#rail').addEventListener('mouseover', function (e) {
    var b = e.target.closest('.ri'), t = $('#tip'); if (!b) { t.hidden = true; return; }
    var r = b.getBoundingClientRect(); t.textContent = b.getAttribute('data-name'); t.hidden = false;
    t.style.left = (r.right + 8) + 'px'; t.style.top = (r.top + r.height / 2 - t.offsetHeight / 2) + 'px';
  });
  $('#rail').addEventListener('mouseleave', function () { $('#tip').hidden = true; });
  function openOrFocus(url, forceNew) {
    var base = url.replace(/#.*$/, '');
    var t = !forceNew && tabs.filter(function (x) { return x.url && x.url.indexOf(base) === 0; })[0];
    if (t) activate(t.id); else newTab(url);
  }
  function togglePanel(r) {
    if (panelApp === r.id) return closePanel();
    var p = panels[r.id];
    if (!p) {
      var wv = document.createElement('webview'); wv.setAttribute('partition', PART); wv.setAttribute('allowpopups', ''); wv.setAttribute('src', r.url);
      $('#panelViews').appendChild(wv); p = panels[r.id] = { wv: wv, url: r.url };
      wv.addEventListener('did-navigate', function (e) { p.url = e.url; });
      wv.addEventListener('did-navigate-in-page', function (e) { if (e.isMainFrame) p.url = e.url; });
    }
    Object.keys(panels).forEach(function (k) { panels[k].wv.classList.toggle('on', k === r.id); });
    panelApp = r.id; $('#panel').hidden = false; $('#panelName').textContent = r.name;
    var act = $('#panelAct'); act.hidden = !r.act; if (r.act) { act.textContent = r.act[0]; act.onclick = function () { window.lb.external(r.act[1]); }; }
    if (r.note) toast(r.note, { ms: 6000 });
    $('#panelTab').onclick = function () { var u = panels[r.id].url || r.url; closePanel(); newTab(u); };
    renderRail();
  }
  function closePanel() { panelApp = null; $('#panel').hidden = true; Object.keys(panels).forEach(function (k) { panels[k].wv.classList.remove('on'); }); renderRail(); }
  $('#panelClose').addEventListener('click', closePanel);
  // the rail items that have a launch action (Steam) get a quick button in the toolbar menu instead of a panel
  function applyPanelWidth() { document.documentElement.style.setProperty('--pw', set.panelW + 'px'); }

  /* ---------- downloads ---------- */
  var dls = {};
  window.lb.on('dl', function (d) {
    var prev = dls[d.id]; dls[d.id] = d;
    $('#dlBtn').classList.toggle('busy', Object.keys(dls).some(function (k) { return dls[k].state === 'progressing'; }));
    if (!prev) toast('Downloading ' + d.name, { ms: 2500 });
    if (d.state === 'completed') toast('Downloaded ' + d.name, { actions: [{ label: 'Show in folder', fn: function () { window.lb.external('file-show:' + d.path); } }] });
    if (d.state === 'interrupted') toast('Download failed: ' + d.name);
    if (drawerMode === 'downloads') drawer('downloads', true);
  });
  function fmt(n) { return n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n > 1e3 ? Math.round(n / 1e3) + ' KB' : n + ' B'; }

  /* ---------- drawer: bookmarks, history, downloads, settings ---------- */
  var drawerMode = null, upd = null, au = { state: 'idle', repo: '', auto: true, current: '', latest: '', notes: '', error: '' };
  function closeDrawer() { drawerMode = null; $('#drawer').hidden = true; }
  function drawer(mode, keep) {
    var d = $('#drawer');
    if (!keep && drawerMode === mode) return closeDrawer();
    drawerMode = mode; d.hidden = false;
    var title = { bookmarks: 'Bookmarks', history: 'History', downloads: 'Downloads', settings: 'Settings' }[mode], body = '';
    if (mode === 'bookmarks') body = bookmarks.length ? bookmarks.map(function (b, i) { return item(b.u, b.t, i, 'bm'); }).join('') : '<p class="muted">Nothing saved yet. Press the star in the address bar on any page.</p>';
    if (mode === 'history') {
      var q = (drawer.q || '').toLowerCase(), list = history.filter(function (h) { return !q || (h.u + ' ' + h.t).toLowerCase().indexOf(q) >= 0; }).slice(0, 150);
      body = '<input type="search" id="hq" placeholder="Search history" value="' + esc(drawer.q || '') + '">' + (list.length ? list.map(function (h) { return item(h.u, h.t, history.indexOf(h), 'hi'); }).join('') : '<p class="muted">No history.</p>') + '<div class="row"><button class="small" data-act="clearHistory">Clear history</button></div>';
    }
    if (mode === 'downloads') {
      var ids = Object.keys(dls).reverse();
      body = ids.length ? ids.map(function (k) {
        var x = dls[k], pct = x.total ? Math.round(100 * x.received / x.total) : 0;
        return '<div class="item" data-act="dlOpen" data-id="' + x.id + '"><div class="t"><b>' + esc(x.name) + '</b><span>' + (x.state === 'progressing' ? fmt(x.received) + (x.total ? ' of ' + fmt(x.total) : '') : x.state === 'completed' ? fmt(x.total || x.received) + ' · done' : x.state) + '</span>' +
          (x.state === 'progressing' ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : '') + '</div>' +
          (x.state === 'progressing' ? '<button class="small" data-act="dlCancel" data-id="' + x.id + '">Cancel</button>' : '<button class="small" data-act="dlShow" data-id="' + x.id + '">Show</button>') + '</div>';
      }).join('') : '<p class="muted">Files you download appear here. They are saved to your Downloads folder.</p>';
    }
    if (mode === 'settings') body = settingsHtml();
    d.innerHTML = '<header><h2>' + title + '</h2><button class="icon" data-act="closeDrawer" aria-label="Close">' + svg('close') + '</button></header><div class="scroll">' + body + '</div>';
    var hq = $('#hq'); if (hq && keep) { hq.focus(); hq.setSelectionRange(hq.value.length, hq.value.length); }
  }
  function item(u, t, i, kind) {
    var host = ''; try { host = new URL(u).hostname; } catch (e) { /* no host */ }
    return '<div class="item" data-act="openUrl" data-u="' + esc(u) + '"><div class="t"><b>' + esc(t || u) + '</b><span>' + esc(u) + '</span></div><button class="icon" data-act="' + (kind === 'bm' ? 'delBm' : 'delHi') + '" data-i="' + i + '" aria-label="Remove">' + svg('close') + '</button></div>';
  }
  function settingsHtml() {
    var h = '<h3>Search</h3><label>Search engine for the address bar<select id="s-engine">' + Object.keys(ENGINES).map(function (k) { return '<option value="' + k + '"' + (set.engine === k ? ' selected' : '') + '>' + esc(ENGINES[k][0]) + '</option>'; }).join('') + '</select></label>';
    h += '<h3>Start-up</h3><label>When the browser opens<select id="s-startup"><option value="restore"' + (set.startup === 'restore' ? ' selected' : '') + '>Continue where I left off</option><option value="new"' + (set.startup === 'new' ? ' selected' : '') + '>Open the start page</option></select></label>';
    h += '<h3>Look</h3><label>Sinner on duty<select id="s-sinner"><option value="">A different Sinner every day</option>' + C.SINNERS.map(function (s) { return '<option value="' + s.k + '"' + (set.sinner === s.k ? ' selected' : '') + '>' + esc(s.n) + '</option>'; }).join('') + '</select></label>';
    h += '<label>Side panel width<select id="s-pw">' + [380, 440, 520, 620].map(function (w) { return '<option value="' + w + '"' + (set.panelW === w ? ' selected' : '') + '>' + w + ' px</option>'; }).join('') + '</select></label>';
    var adNote = ad.source === 'lists' ? 'Full filter lists (EasyList, EasyPrivacy and more), updated ' + new Date(ad.updated).toLocaleDateString() + '. They refresh by themselves every day.' : ad.source === 'basic' ? 'Basic built-in rules only. The full lists could not be downloaded yet, so it keeps trying by itself.' : ad.source === 'test' ? 'Test list.' : 'Loading the filter lists\u2026';
    h += '<h3>Ad blocker</h3><label>Block ads and trackers<select id="s-ad"><option value="on"' + (ad.enabled ? ' selected' : '') + '>On</option><option value="off"' + (ad.enabled ? '' : ' selected') + '>Off</option></select></label><p class="muted">' + esc(adNote) + ' Blocked since opening: ' + ad.total + '. If a site looks broken, use the shield button to pause blocking on just that site.</p><div class="row"><button class="small" data-act="adRefresh">Update filter lists now</button></div>';
    h += '<h3>Privacy</h3><div class="row"><button class="small" data-act="clearCache">Clear cached files</button><button class="small" data-act="clearCookies">Sign out of all sites</button><button class="small" data-act="clearHistory">Clear history</button><button class="small" data-act="resetPerms">Reset site permissions</button></div>';
    h += '<p class="muted">Sites you sign in to stay signed in until you sign out of all sites.</p>';
    h += '<h3>Browser updates</h3>' + auHtml();
    h += '<h3>Engine</h3><p>Limbus Browser ' + esc(info.version) + ' · engine Chromium ' + esc(info.chrome.split('.')[0]) + ' (Electron ' + esc(info.electron) + ')</p>';
    h += '<p class="muted" id="updNote">' + (upd ? esc(upd) : (info.installed ? 'Engine updates are checked automatically.' : 'Updates apply to the installed copy.')) + '</p><div class="row"><button class="small" data-act="checkUpdate">Check for updates now</button></div>';
    return h;
  }
  $('#drawer').addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'); if (!a) return; var act = a.getAttribute('data-act');
    if (act === 'closeDrawer') return closeDrawer();
    if (act === 'openUrl') { if (e.target.closest('button')) return; var u = a.getAttribute('data-u'); if (e.ctrlKey) newTab(u); else if (cur) navigate(cur, u); closeDrawer(); return; }
    if (act === 'delBm') { bookmarks.splice(+a.getAttribute('data-i'), 1); lsSet('lb.bookmarks', bookmarks); syncAddr(); return drawer('bookmarks', true); }
    if (act === 'delHi') { history.splice(+a.getAttribute('data-i'), 1); lsSet('lb.history', history); return drawer('history', true); }
    if (act === 'clearHistory') { history = []; lsSet('lb.history', history); toast('History cleared'); return drawer(drawerMode, true); }
    if (act === 'dlCancel') return window.lb.download('cancel', +a.getAttribute('data-id'));
    if (act === 'dlShow') { var x = dls[a.getAttribute('data-id')]; if (x) window.lb.external('file-show:' + x.path); return; }
    if (act === 'dlOpen') { var y = dls[a.getAttribute('data-id')]; if (y && y.state === 'completed') window.lb.external('file-open:' + y.path); return; }
    if (act === 'clearCache') return window.lb.clear('cache').then(function () { toast('Cache cleared'); });
    if (act === 'clearCookies') return window.lb.clear('cookies').then(function () { toast('Signed out of all sites'); });
    if (act === 'resetPerms') return window.lb.perms('reset').then(function () { toast('Site permissions reset'); });
    if (act === 'adRefresh') { toast('Updating the filter lists\u2026', { ms: 2500 }); return window.lb.adblock('refresh').then(function (s) { applyAd(s); toast(s && s.source === 'lists' ? 'Filter lists are up to date.' : 'Could not download the full lists right now. Basic rules stay on.', { ms: 4000 }); }); }
    if (act === 'auCheck') { toast('Looking for a new version\u2026', { ms: 2200 }); return window.lb.appUpdate('check').then(function (r) { showAu(r, true); }); }
    if (act === 'auGet') { toast('Downloading the new version\u2026', { ms: 3000 }); return window.lb.appUpdate('download').then(function (r) { showAu(r, true); }); }
    if (act === 'auRestart') return window.lb.appUpdate('restart');
    if (act === 'auSave') { var rp = $('#au-repo'); return window.lb.appUpdate('repo:' + (rp ? rp.value : '')).then(function (r) { showAu(r, true); }); }
    if (act === 'checkUpdate') return checkUpdate(true);
    if (act === 'applyUpdate') return applyUpdate(a.getAttribute('data-v'));
  });
  $('#drawer').addEventListener('input', function (e) { if (e.target.id === 'hq') { drawer.q = e.target.value; drawer('history', true); } });
  $('#drawer').addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'au-auto') { window.lb.appUpdate('auto:' + (e.target.value === 'on' ? 'on' : 'off')).then(function (r) { if (r) au = r; }); return; }
    if (id === 's-ad') { window.lb.adblock('toggle').then(applyAd); return; }
    if (id === 's-engine') set.engine = e.target.value;
    if (id === 's-startup') set.startup = e.target.value;
    if (id === 's-sinner') { set.sinner = e.target.value; pickSinner(); }
    if (id === 's-pw') { set.panelW = +e.target.value; applyPanelWidth(); }
    saveSet();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!$('#drawer').hidden) closeDrawer(); else if (!$('#findbar').hidden) closeFind(); } });

  /* ---------- engine updates ---------- */
  function checkUpdate(manual) {
    return window.lb.update('check').then(function (r) {
      if (!r || !r.ok) { upd = manual ? 'Could not check for updates right now.' : upd; if (manual) toast(upd); return; }
      showUpdate(r, manual);
    });
  }
  function showUpdate(r, manual) {
    if (r.patch) {
      upd = 'Engine update ' + r.patch + ' is available (you have ' + r.current + ').';
      if (r.installed) toast(upd, { actions: [{ label: 'Update and restart', fn: function () { applyUpdate(r.patch); } }], ms: 12000 });
      else toast(upd + ' Run the installer again to update this copy.', { ms: 8000 });
    } else if (r.nextMajor) { upd = 'You are on the newest patch. A new major engine (' + r.nextMajor + ') exists; it needs a new browser build.'; if (manual) toast(upd, { ms: 6000 }); }
    else { upd = 'The engine is up to date (' + r.current + ').'; if (manual) toast(upd); }
    if (drawerMode === 'settings') drawer('settings', true);
  }
  function applyUpdate(v) { toast('Downloading and checking the update. The browser restarts when it is ready.', { ms: 6000 }); window.lb.update('apply:' + v).then(function (r) { if (r && !r.ok) toast('Update failed: ' + r.error, { ms: 8000 }); }); }
  window.lb.on('update-state', function (r) { showUpdate(r, false); });

  /* ---------- browser (program) updates ---------- */
  function auHtml() {
    var msg;
    if (au.state === 'nosource') msg = 'No update source is set yet. Enter the GitHub repository that holds your Limbus Browser update files (owner/name).';
    else if (au.state === 'checking') msg = 'Looking for a new version…';
    else if (au.state === 'downloading') msg = 'Downloading version ' + au.latest + '…';
    else if (au.state === 'ready') msg = 'Version ' + au.latest + ' is downloaded and checked. It starts the next time the browser opens, or now with the button below.' + (au.notes ? ' What is new: ' + au.notes : '');
    else if (au.state === 'available') msg = 'Version ' + au.latest + ' is available.' + (au.notes ? ' What is new: ' + au.notes : '');
    else if (au.state === 'engine') msg = au.notes;
    else if (au.state === 'error') msg = 'Could not update: ' + au.error;
    else if (au.state === 'current') msg = 'You have the newest version' + (au.checkedAt ? ' (checked ' + new Date(au.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ')' : '') + '.';
    else msg = 'Updates are checked by themselves every few hours.';
    var h = '<p>Limbus Browser version <b>' + esc(au.current || info.version) + '</b></p><p class="muted" id="auNote">' + esc(msg) + '</p>';
    h += '<label>Update source (GitHub owner/name)<input type="text" id="au-repo" value="' + esc(au.repo) + '" placeholder="yourname/limbus-browser" spellcheck="false" autocomplete="off"></label>';
    h += '<label>Download new versions by themselves<select id="au-auto"><option value="on"' + (au.auto ? ' selected' : '') + '>Yes, then ask me to restart</option><option value="off"' + (au.auto ? '' : ' selected') + '>No, only when I press the button</option></select></label>';
    h += '<div class="row"><button class="small" data-act="auSave">Save source</button><button class="small" data-act="auCheck">Check now</button>';
    if (au.state === 'available') h += '<button class="small" data-act="auGet">Download version ' + esc(au.latest) + '</button>';
    if (au.state === 'ready') h += '<button class="small" data-act="auRestart">Restart to update</button>';
    h += '</div><p class="muted">If a new version fails to start, the browser goes back to the previous one by itself.</p>';
    return h;
  }
  var auReadyShown = '';
  function showAu(r, manual) {
    if (!r) return;
    au = r;
    if (r.state === 'ready' && auReadyShown !== r.latest) {
      auReadyShown = r.latest;
      toast('Version ' + r.latest + ' is ready.', { actions: [{ label: 'Restart to update', fn: function () { window.lb.appUpdate('restart'); } }], ms: 15000 });
    } else if (manual && r.state === 'current') toast('You have the newest version.');
    else if (manual && r.state === 'error') toast('Could not update: ' + r.error, { ms: 7000 });
    if (drawerMode === 'settings' && !(document.activeElement && document.activeElement.id === 'au-repo')) drawer('settings', true);
  }
  window.lb.on('appupdate', function (r) { showAu(r, false); });
  window.lb.appUpdate('state').then(function (r) {
    if (!r) return;
    au = r;
    if (r.justApplied) { toast('Updated to version ' + r.justApplied.version + '.' + (r.justApplied.notes ? ' ' + r.justApplied.notes : ''), { ms: 9000 }); window.lb.appUpdate('seen'); }
    else if (r.rolledBack) { toast('Version ' + r.rolledBack.version + ' did not start properly, so the browser went back to the previous version.', { ms: 10000 }); window.lb.appUpdate('seen'); }
    showAu(r, false);
  });

  /* ---------- commands (menu, keyboard, page shortcuts) ---------- */
  function run(c) {
    if (!c) return;
    if (c.indexOf('tab:') === 0) { var n = +c.slice(4), t = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1]; if (t) activate(t.id); return; }
    var ix = cur ? tabs.indexOf(cur) : 0;
    switch (c) {
      case 'newtab': newTab(); addr.focus(); break;
      case 'reopen': var z = closed.pop(); if (z) newTab(z.url); break;
      case 'closetab': if (cur) closeTab(cur.id); break;
      case 'address': addr.focus(); addr.select(); break;
      case 'reload': if (cur && cur.ready) cur.wv.reload(); break;
      case 'hardreload': if (cur && cur.ready) cur.wv.reloadIgnoringCache(); break;
      case 'nexttab': activate(tabs[(ix + 1) % tabs.length].id); break;
      case 'prevtab': activate(tabs[(ix - 1 + tabs.length) % tabs.length].id); break;
      case 'find': openFind(); break;
      case 'history': drawer('history'); break;
      case 'downloads': drawer('downloads'); break;
      case 'bookmarks': drawer('bookmarks'); break;
      case 'bookmark': toggleBookmark(); break;
      case 'print': if (cur && cur.ready) { try { cur.wv.print(); } catch (e) { toast('Printing is not available for this page.'); } } break;
      case 'devtools': if (cur && cur.ready) { if (cur.wv.isDevToolsOpened()) cur.wv.closeDevTools(); else cur.wv.openDevTools(); } break;
      case 'zoomin': zoom(1); break;
      case 'zoomout': zoom(-1); break;
      case 'zoomreset': zoom(0); break;
      case 'back': if (cur && cur.ready) cur.wv.goBack(); break;
      case 'forward': if (cur && cur.ready) cur.wv.goForward(); break;
      case 'fullscreen': document.body.classList.toggle('fs'); window.lb.fullscreen(document.body.classList.contains('fs')); break;
    }
  }
  window.lb.on('cmd', run);
  window.lb.on('open-tab', function (d) {
    var url = d.search ? resolve(d.search) : d.url;
    if (url) newTab(url, { bg: d.bg, after: cur && cur.id });
  });

  /* ---------- session ---------- */
  var saveT = 0;
  function saveSession() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      lsSet('lb.session', { tabs: tabs.map(function (t) { return t.url; }), active: cur ? tabs.indexOf(cur) : 0 });
    }, 600);
  }

  /* ---------- start ---------- */
  window.lb.info().then(function (i) {
    info = i;
    pickSinner(); applyPanelWidth(); renderRail(); refreshShield();
    window.lb.adblock('status').then(applyAd);
    var s = lsGet('lb.session', null), want = (i.args || []).slice();
    var restored = false;
    if (!want.length && set.startup === 'restore' && s && s.tabs && s.tabs.length && !i.test) {
      s.tabs.forEach(function (u) { if (/^(https?:|file:)/i.test(u)) newTab(u, { bg: true }); });
      if (tabs.length) { activate(tabs[Math.min(s.active || 0, tabs.length - 1)].id); restored = true; }
    }
    want.forEach(function (u) { newTab(u); });
    if (!tabs.length) newTab();
    setTimeout(greet, 900);
    window.__lb = { run: run, tabs: tabs, panels: panels, newTab: newTab, get cur() { return cur; }, toast: toast, drawer: drawer, set: set, resolve: resolve };
  });
})();
