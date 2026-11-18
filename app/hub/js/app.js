/* Limbus hub UI. Data lives in the artifact database (shared catalog and tier sources written by Claude,
   plus one private subtree per signed-in viewer). See docs/maintenance.txt for the layout. */
(function () {
  "use strict";
  var C = window.LCBContent, K = window.LCBCore;
  /* ?shell=1 means the page runs inside the Limbus Browser on a PC, where it may reach the web itself. */
  var SHELL = /[?&]shell=1(&|$)/.test(location.search);
  var NAV = [["home", "Home"], ["tiers", "Tier list"], ["ids", "Identities"], ["teams", "Teams"], ["tracker", "Tracker"], ["archive", "Archive"], ["ask", "Ask"], ["config", "Options"]];
  var NAV_PHONE = [["home", "Home"], ["tiers", "Tiers"], ["ids", "IDs"], ["teams", "Teams"], ["tracker", "Tracker"], ["more", "More"]];
  var DEF = {
    roster: { ids: {} },
    teams: { list: [] },
    tracker: { story: {}, daily: { day: "", done: {} }, weekly: { week: "", done: {} }, res: {}, egos: [], goals: [], notes: "" },
    prefs: { mode: "rotate", fixed: "", name: "", engine: "google", off: {}, weights: {} },
    archive: { items: [] },
    requests: { list: [] }
  };
  var USER_DOCS = Object.keys(DEF);
  var S = {
    view: "home", db: null, uid: null, sample: null, sync: "loading", syncNote: "",
    catalog: {}, ids: [], byKey: {}, sources: {}, tiers: {}, news: [], meta: {},
    f: { sinner: "", rar: 0, kw: "", own: "", q: "", fac: "" }, poke: null, q: "", editTeam: null,
    chat: [], ans: null, ansId: 0, asking: false, askCtl: null, askDraft: "", clash: null,
    dirty: {}, writing: {}, again: {}, saveT: {}
  };
  USER_DOCS.forEach(function (k) { S[k] = clone(DEF[k]); });

  /* ---------- helpers ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage is optional */ } }
  function merge(def, data) { var o = clone(def); Object.keys(data || {}).forEach(function (k) { o[k] = data[k]; }); return o; }
  function sinner(k) { for (var i = 0; i < C.SINNERS.length; i++) if (C.SINNERS[i].k === k) return C.SINNERS[i]; return C.SINNERS[0]; }
  function rar(r) { return r === 3 ? "000" : r === 2 ? "00" : "0"; }
  function owned(k) { return !!(S.roster.ids && S.roster.ids[k]); }
  function fmtDate(d) { try { return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return d; } }
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2600); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function currentSinner(now) {
    if (S.prefs.mode === "fixed" && S.prefs.fixed) return S.prefs.fixed;
    return K.sinnerOfDay(now, C.SINNERS.map(function (s) { return s.k; }), C.BIRTHDAYS);
  }
  function applyTheme() {
    var sn = sinner(currentSinner(new Date()));
    document.documentElement.style.setProperty("--sinner", sn.c);
    $("#brandName").textContent = S.prefs.name || "Limbus Hub";
  }
  function setSync(state, note) {
    S.sync = state; S.syncNote = note || "";
    var el = $("#sync"); if (!el) return;
    var txt = { loading: "Connecting", live: "Synced to your account", local: SHELL ? "Saved on this PC" : "Saved on this device only", error: "Sync problem", stale: "Showing saved copy" }[state] || state;
    el.className = "sync " + (state === "live" ? "live" : state === "error" ? "error" : state === "loading" ? "" : "local");
    el.innerHTML = "<i></i><span>" + esc(txt) + "</span>";
    el.title = note || "";
  }

  /* ---------- data ---------- */
  function rebuild() {
    var ids = [], by = {};
    C.SINNERS.forEach(function (sn) {
      (S.catalog[sn.k] || []).forEach(function (i) {
        var o = { k: i.k, n: i.n, r: i.r, s: i.s || [], d: i.d, rel: i.rel, se: i.se, kw: i.kw || [], sk: sn.k, fac: C.factionOf(i.n) };
        ids.push(o); by[o.k] = o;
      });
    });
    S.ids = ids; S.byKey = by;
    S.tiers = ids.length ? K.computeTiers(ids, S.sources, { off: S.prefs.off, weights: S.prefs.weights }) : {};
  }

  /* A sync code is the personal data as text: LCB1: + base64 of the JSON. Plain JSON from older backups still works. */
  function encodeSync(o) { var j = JSON.stringify(o); try { return "LCB1:" + btoa(unescape(encodeURIComponent(j))); } catch (e) { return j; } }
  function decodeSync(t) {
    t = String(t || "").trim().replace(/\s+/g, "");
    try {
      var j = t.indexOf("LCB1:") === 0 ? decodeURIComponent(escape(atob(t.slice(5)))) : t;
      var o = JSON.parse(j);
      return o && typeof o === "object" && !Array.isArray(o) ? o : null;
    } catch (e) { return null; }
  }
  function userBundle() { var o = {}; USER_DOCS.forEach(function (k) { o[k] = S[k]; }); return o; }
  /* Shared game data ships with the page as data/*.js (window.LCBData). Personal data comes from the database. */
  function loadData() {
    var D = window.LCBData || {};
    S.catalog = D.catalog || {}; S.sources = D.sources || {};
    S.news = (D.feed && D.feed.news) || []; S.meta = (D.feed && D.feed.meta) || {};
    var us = lsGet("lcb.user.v1"), seeded = false;
    if (!us && SHELL && D.seed) { us = D.seed; seeded = true; }
    if (us) USER_DOCS.forEach(function (k) { if (us[k]) S[k] = merge(DEF[k], us[k]); });
    if (seeded) lsSet("lcb.user.v1", userBundle());
    rebuild();
  }
  function saveUser(name) {
    S.dirty[name] = (S.dirty[name] || 0) + 1;
    lsSet("lcb.user.v1", userBundle());
    clearTimeout(S.saveT[name]);
    S.saveT[name] = setTimeout(function () { flush(name); }, 700);
  }
  function flush(name) {
    if (!S.db || !S.uid) { S.dirty[name] = 0; return; }
    if (S.writing[name]) { S.again[name] = true; return; }
    S.writing[name] = true;
    var stamp = S.dirty[name], data = clone(S[name]);
    data.updatedAt = new Date().toISOString();
    S.db.doc("data/users/" + S.uid + "/" + name).set(data).then(function () { setSync("live"); }, function (e) {
      setSync("error", "Could not save " + name + (e && e.code ? " (" + e.code + ")" : ""));
    }).then(function () {
      S.writing[name] = false;
      if (S.dirty[name] === stamp) S.dirty[name] = 0;
      if (S.again[name]) { S.again[name] = false; flush(name); }
    });
  }
  function applyUserDoc(name, data) {
    if (USER_DOCS.indexOf(name) < 0 || !data || S.dirty[name]) return false;
    var next = merge(DEF[name], data); delete next.updatedAt;
    var cur = clone(S[name]); delete cur.updatedAt;
    if (JSON.stringify(next) === JSON.stringify(cur)) return false;
    S[name] = next; return true;
  }
  function startSync() {
    if (!window.claude || typeof window.claude.use !== "function") { setSync("local", SHELL ? "This is the copy on your PC. The synced Hub is in the side rail." : "Open this page from Claude to sync across devices."); return; }
    var waiting = setTimeout(function () { if (S.sync === "loading") setSync("stale", "Still trying to reach your saved roster and tracker."); }, 10000);
    function live(meta) { if (meta && meta.fromCache) return; clearTimeout(waiting); if (S.sync !== "error") setSync("live"); }
    function fail(e) { clearTimeout(waiting); setSync("error", (e && e.message) || "The data could not be reached."); }
    Promise.all([window.claude.use("db"), window.claude.use("user"), window.claude.use("sample")]).then(function (r) {
      S.db = r[0]; S.sample = r[2];
      if (S.view === "ask") render();
      if (!S.db) { clearTimeout(waiting); setSync("local", "Open this page from Claude, signed in, to sync across devices."); return; }
      var idp = r[1] && typeof r[1].id === "function" ? r[1].id() : Promise.resolve(null);
      idp.then(function (id) {
        if (!id) { clearTimeout(waiting); setSync("local", "Your roster and tracker are saved on this device only."); return; }
        S.uid = id;
        S.db.collection("data/users/" + id).onSnapshot(function (q) {
          var changed = false;
          q.docs.forEach(function (d) { if (applyUserDoc(d.id, d.data())) changed = true; });
          if (changed) { lsSet("lcb.user.v1", userBundle()); rebuild(); applyTheme(); render(); }
          live(q.metadata);
        }, fail);
      });
    }).catch(fail);
  }

  /* ---------- small renderers ---------- */
  function tierBadge(k) { var t = S.tiers[k]; var lab = t && t.tier !== "?" ? t.tier : "–"; return '<span class="badge b-' + (t && t.tier !== "?" ? t.tier : "U") + '" title="' + (t && t.score != null ? "Score " + t.score + " from " + t.n + " list" + (t.n === 1 ? "" : "s") : "Not rated") + '">' + lab + "</span>"; }
  function sinDots(i) { return i.s.map(function (x) { return '<i class="dot" style="--c:' + (C.SINS[x] || "#888") + '" title="' + esc(x) + '"></i>'; }).join(""); }
  function kwChips(i) { return i.kw.map(function (x) { return '<span class="kw" style="--c:' + (C.KEYWORDS[x] || "#888") + '">' + esc(x) + "</span>"; }).join(""); }
  function idChip(i, extra) {
    var sn = sinner(i.sk), t = S.tiers[i.k];
    return '<button class="idchip' + (owned(i.k) ? " owned" : "") + '" data-a="open" data-k="' + esc(i.k) + '" style="--c:' + sn.c + '">' +
      '<span class="who">' + esc(sn.n) + "</span><span>" + esc(i.n) + "</span>" +
      (owned(i.k) ? '<span class="own" title="You own this">✓</span>' : "") + (t && t.n <= 1 ? '<span class="thin" title="Rated by one list only">•</span>' : "") + (extra || "") + "</button>";
  }
  function passes(i) {
    var f = S.f;
    if (f.sinner && i.sk !== f.sinner) return false;
    if (f.rar && i.r !== f.rar) return false;
    if (f.kw && i.kw.indexOf(f.kw) < 0) return false;
    if (f.fac && i.fac !== f.fac) return false;
    if (f.own === "yes" && !owned(i.k)) return false;
    if (f.own === "no" && owned(i.k)) return false;
    if (f.q) { var q = f.q.toLowerCase(); if ((i.n + " " + sinner(i.sk).n).toLowerCase().indexOf(q) < 0) return false; }
    return true;
  }
  function filtersHtml() {
    var f = S.f, facs = {};
    S.ids.forEach(function (i) { facs[i.fac] = (facs[i.fac] || 0) + 1; });
    function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? " selected" : "") + ">" + esc(label) + "</option>"; }
    return '<div class="filters">' +
      '<input class="field" id="f-q" type="search" placeholder="Find an Identity" value="' + esc(f.q) + '" data-i="f" data-k="q" aria-label="Find an Identity">' +
      '<select id="f-sinner" data-i="f" data-k="sinner" aria-label="Sinner">' + opt("", "All Sinners", f.sinner) + C.SINNERS.map(function (s) { return opt(s.k, s.n, f.sinner); }).join("") + "</select>" +
      '<select id="f-rar" data-i="f" data-k="rar" aria-label="Rarity">' + opt(0, "Any rarity", f.rar) + opt(3, "000", f.rar) + opt(2, "00", f.rar) + opt(1, "0", f.rar) + "</select>" +
      '<select id="f-kw" data-i="f" data-k="kw" aria-label="Status keyword">' + opt("", "Any status", f.kw) + Object.keys(C.KEYWORDS).map(function (k) { return opt(k, k.charAt(0).toUpperCase() + k.slice(1), f.kw); }).join("") + "</select>" +
      '<select id="f-fac" data-i="f" data-k="fac" aria-label="Faction">' + opt("", "Any faction", f.fac) + Object.keys(facs).sort().map(function (k) { return opt(k, k + " (" + facs[k] + ")", f.fac); }).join("") + "</select>" +
      '<select id="f-own" data-i="f" data-k="own" aria-label="Owned">' + opt("", "Owned or not", f.own) + opt("yes", "Only ones I own", f.own) + opt("no", "Only ones I lack", f.own) + "</select>" +
      "</div>";
  }
  function emptyData() { return '<div class="notice warn">The Identity data file did not load. Reload the page; if it stays like this, ask Claude to republish the hub.</div>'; }

  /* ---------- views ---------- */
  var V = {};
  V.home = function () {
    var now = new Date(), sk = currentSinner(now), sn = sinner(sk), slot = K.daySlot(now.getHours());
    var lines = C.LINES[sk][slot], line = S.poke || lines[now.getDate() % lines.length];
    var hello = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Late hours" }[slot];
    var eng = curEngine();
    var d = S.tracker.daily.day === K.gameDay(now) ? S.tracker.daily.done : {};
    var ev = S.meta && S.meta.event;
    var h = '<section class="hero" style="--sinner:' + sn.c + '"><div class="bignum" aria-hidden="true">' + (sn.no < 10 ? "0" : "") + sn.no + "</div>" +
      '<div class="no">SINNER NO. ' + (sn.no < 10 ? "0" : "") + sn.no + (S.prefs.mode === "fixed" ? " · PINNED" : " · TODAY") + "</div>" +
      '<div class="name">' + esc(sn.n) + "</div>" +
      '<div class="when">' + hello + ", Manager · " + esc(now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })) + "</div>" +
      '<blockquote id="line">“' + esc(line) + "”</blockquote>" +
      '<div class="row"><button class="btn small" data-a="poke">Poke ' + esc(sn.n.split(" ")[0]) + '</button><button class="btn small ghost" data-a="nextSinner">Meet another Sinner</button>' +
      (S.prefs.mode === "fixed" ? '<button class="btn small ghost" data-a="unpin">Back to daily rotation</button>' : "") + "</div></section>";
    h += '<section class="card"><form class="search" id="searchForm"><input id="q" type="search" placeholder="Search, type a web address, or ask a question" autocomplete="off" value="' + esc(S.q) + '" data-i="q" aria-label="Search">' +
      '<a class="btn primary" id="go" href="#home"' + (SHELL ? "" : ' target="_blank" rel="noopener"') + '>Go</a></form>' +
      '<div class="chips" role="group" aria-label="Where to search">' + engineChips(eng) + "</div></section>" + (SHELL ? answerCard() : "");
    h += '<div class="grid two"><div class="col">' +
      '<section class="card"><header><h2>Quick access</h2></header><div class="apps">' + C.APPS.map(function (a) {
        return '<a class="app" href="' + a.u + '" target="_blank" rel="noopener" style="--c:' + a.c + '"><span class="mono">' + esc(a.m || a.n.slice(0, 2)) + "</span><span>" + esc(a.n) + "</span></a>";
      }).join("") + "</div></section>" +
      '<section class="card"><header><h2>Limbus Company</h2></header><div class="links">' + C.LIMBUS.map(function (a) {
        return '<a class="link" href="' + a.u + '" target="_blank" rel="noopener"><b>' + esc(a.n) + "</b><span>" + esc(a.d) + "</span></a>";
      }).join("") + '</div><div class="minilinks">' + C.LIMBUS_MORE.map(function (a) { return '<a href="' + a.u + '" target="_blank" rel="noopener">' + esc(a.n) + "</a>"; }).join("") + "</div></section>" +
      '<section class="card"><header><h2>Tools</h2></header>' + clashHtml() + enkHtml() + "</section>" +
      '</div><div class="col">' +
      '<section class="card"><header><h2>Today</h2><span class="muted small">Game day resets 06:00 KST</span></header><div class="timers">' +
      '<div class="timer"><b class="num" data-timer="daily">–</b><span>until daily reset</span></div>' +
      '<div class="timer"><b class="num" data-timer="weekly">–</b><span>until weekly reset</span></div>' +
      (ev && ev.end && Date.parse(ev.end) > now.getTime() ? '<div class="timer"><b class="num" data-timer="event" data-end="' + esc(ev.end) + '">–</b><span>' + esc(ev.name || "Event") + " ends</span></div>" : "") +
      '</div><div class="checks">' + C.DAILIES.map(function (x) {
        return '<label class="check' + (d[x[0]] ? " done" : "") + '"><input type="checkbox" data-i="daily" data-k="' + x[0] + '"' + (d[x[0]] ? " checked" : "") + "><span>" + esc(x[1]) + "</span></label>";
      }).join("") + "</div></section>" +
      '<section class="card"><header><h2>Updates</h2><span class="muted small">' + (S.meta && S.meta.updatedAt ? "Checked " + esc(fmtDate(S.meta.updatedAt)) : "") + "</span></header>" +
      (S.news.length ? '<ul class="news">' + S.news.slice(0, 8).map(function (n) {
        return "<li><time>" + esc(fmtDate(n.date)) + "</time>" + (n.url ? '<a href="' + esc(n.url) + '" target="_blank" rel="noopener">' + esc(n.title) + "</a>" : "<b>" + esc(n.title) + "</b>") + (n.sum ? "<p>" + esc(n.sum) + "</p>" : "") + "</li>";
      }).join("") + "</ul>" : '<div class="notice">No updates loaded yet.</div>') + "</section>" +
      collectionCard() + "</div></div>";
    return h;
  };
  function collectionCard() {
    if (!S.ids.length) return "";
    var tot = S.ids.length, have = S.ids.filter(function (i) { return owned(i.k); }).length;
    return '<section class="card"><header><h2>Your collection</h2><a class="btn small ghost" href="#ids">Open</a></header>' +
      '<div class="row spread"><span><b class="num">' + have + "</b> of " + tot + ' Identities</span><span class="muted num">' + Math.round(have / tot * 100) + '%</span></div><div class="bar"><i style="width:' + (have / tot * 100) + '%"></i></div></section>';
  }
  function clashHtml() {
    var c = S.clash || { a: { base: 4, coin: 4, coins: 2, sp: 0 }, b: { base: 5, coin: 3, coins: 3, sp: 0 }, res: null };
    function side(key, label) {
      var s = c[key];
      function inp(f, ph) { return '<input class="field num" type="number" inputmode="numeric" id="cl-' + key + "-" + f + '" value="' + s[f] + '" data-i="clash" data-s="' + key + '" data-k="' + f + '" aria-label="' + label + " " + ph + '" title="' + ph + '">'; }
      return '<div><h3>' + label + '</h3><div class="filters" style="grid-template-columns:repeat(4,1fr)">' + inp("base", "base power") + inp("coin", "coin power") + inp("coins", "coins") + inp("sp", "sanity") + "</div></div>";
    }
    return '<details' + (S.clash ? " open" : "") + '><summary>Clash calculator</summary><p>Base power, coin power, number of coins and sanity for each side. Heads chance is 50% plus sanity.</p>' +
      side("a", "Your skill") + side("b", "Enemy skill") +
      '<div class="row" style="margin-top:8px"><button class="btn small" data-a="clash">Work out the odds</button><span id="clashRes">' + (c.res != null ? "You win about <b>" + Math.round(c.res * 100) + "%</b> of clashes." : "") + "</span></div></details>";
  }
  function enkHtml() {
    return '<details><summary>Enkephalin timer</summary><p>Enkephalin refills at 1 every 6 minutes.</p><div class="row"><input class="field num" style="max-width:120px" type="number" inputmode="numeric" id="enk-now" placeholder="Now" aria-label="Enkephalin now">' +
      '<input class="field num" style="max-width:120px" type="number" inputmode="numeric" id="enk-max" placeholder="Max" aria-label="Enkephalin cap"><button class="btn small" data-a="enk">When is it full?</button><span id="enkRes"></span></div></details>';
  }

  V.tiers = function () {
    if (!S.ids.length) return emptyData();
    var srcKeys = Object.keys(S.sources), on = srcKeys.filter(function (k) { return !(S.prefs.off || {})[k]; });
    var h = '<section class="card"><header><h2>Averaged tier list</h2><span class="muted small">' + on.length + " of " + srcKeys.length + " lists in the average" + (S.meta.updatedAt ? " · checked " + esc(fmtDate(S.meta.updatedAt)) : "") + "</span></header>" + filtersHtml() + "</section>";
    h += '<div id="list">' + tiersList() + "</div>";
    h += '<section class="card"><header><h2>Where the placements come from</h2></header><div class="scroll-x"><table class="plain"><thead><tr><th>Use</th><th>List</th><th>Dated</th><th>Tiers</th><th>Rated</th><th>Weight</th></tr></thead><tbody>' +
      srcKeys.map(function (k) {
        var s = S.sources[k], off = (S.prefs.off || {})[k];
        return "<tr><td><input type=\"checkbox\" id=\"src-" + esc(k) + "\" data-i=\"src\" data-k=\"" + esc(k) + "\"" + (off ? "" : " checked") + ' aria-label="Use ' + esc(s.name) + '" style="width:20px;height:20px;accent-color:var(--sinner)"></td><td><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + "</a>" +
          (s.note ? '<div class="muted small">' + esc(s.note) + "</div>" : "") + '</td><td class="num">' + esc(fmtDate(s.asOf)) + "</td><td>" + esc((s.scale || []).join(" › ")) + '</td><td class="num">' + Object.keys(s.p || {}).length + '</td><td class="num">' + (s.weight || 1) + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      "<details><summary>How the average is worked out</summary><p>Each list uses its own tier names, and some are far more generous than others. So every tier is first turned into a rank: an Identity in a list's top tier of ten sits around rank 5 of all " + S.ids.length + " Identities. That rank becomes a score from 0 to 100.</p>" +
      "<p>The scores are then averaged with weights. A specialist Limbus site counts three times as much as a general gaming site. A list loses weight as it ages past 45 days. Slow lists count half for Identities released in the 90 days before their date, because they tend to misplace new releases.</p>" +
      "<p>Final tiers: SS from 93, S from 85, A from 73, B from 58, C from 40, D below. A dot on a chip means only one list rated that Identity, so treat it as a first guess.</p>" +
      (S.meta.sourcesNote ? "<p>" + esc(S.meta.sourcesNote) + "</p>" : "") + "</details></section>";
    return h;
  };
  function tiersList() {
    var groups = {};
    S.ids.filter(passes).forEach(function (i) { var t = (S.tiers[i.k] || {}).tier || "?"; (groups[t] = groups[t] || []).push(i); });
    var order = K.TIERS.map(function (t) { return t[0]; }).concat(["?"]), out = "";
    order.forEach(function (t) {
      var g = groups[t]; if (!g || !g.length) return;
      g.sort(function (a, b) { return ((S.tiers[b.k] || {}).score || 0) - ((S.tiers[a.k] || {}).score || 0); });
      out += '<div class="tier t-' + (t === "?" ? "U" : t) + '" style="margin-bottom:8px"><div class="lab">' + (t === "?" ? "–" : t) + "<small>" + g.length + '</small></div><div class="body">' + g.map(function (i) { return idChip(i); }).join("") + "</div></div>";
    });
    return out || '<div class="notice">Nothing matches those filters.</div>';
  }

  V.ids = function () {
    if (!S.ids.length) return emptyData();
    var tot = { 1: 0, 2: 0, 3: 0 }, have = { 1: 0, 2: 0, 3: 0 };
    S.ids.forEach(function (i) { tot[i.r]++; if (owned(i.k)) have[i.r]++; });
    var all = tot[1] + tot[2] + tot[3], mine = have[1] + have[2] + have[3];
    var h = '<section class="card"><header><h2>Identities</h2><span class="muted small">Tap the square to mark what you own. Tap a name for details.</span></header>' +
      '<div class="stats">' + [["All", mine, all], ["000", have[3], tot[3]], ["00", have[2], tot[2]], ["0", have[1], tot[1]]].map(function (x) {
        return '<div class="stat"><span class="muted small">' + x[0] + '</span><b class="num">' + x[1] + '<span class="muted" style="font-size:1rem"> / ' + x[2] + '</span></b><div class="bar"><i style="width:' + (x[2] ? x[1] / x[2] * 100 : 0) + '%"></i></div></div>';
      }).join("") + "</div>" + filtersHtml() + '<div class="row"><button class="btn small ghost" data-a="ownBase">Mark the 12 base Identities as owned</button></div></section>';
    return h + '<section class="card"><div id="list">' + idsList() + "</div></section>";
  };
  function idsList() {
    var out = "";
    C.SINNERS.forEach(function (sn) {
      var list = S.ids.filter(function (i) { return i.sk === sn.k && passes(i); });
      if (!list.length) return;
      list.sort(function (a, b) { return b.r - a.r || (a.rel < b.rel ? 1 : -1); });
      var mine = list.filter(function (i) { return owned(i.k); }).length;
      out += '<div class="sinhead" style="--c:' + sn.c + '"><b>' + esc(sn.n) + '</b><span class="muted small num">' + mine + " / " + list.length + "</span></div>" + list.map(function (i) {
        var o = S.roster.ids[i.k];
        return '<div class="idrow"><button class="own-toggle" data-a="own" data-k="' + esc(i.k) + '" aria-pressed="' + !!o + '" aria-label="' + (o ? "Owned" : "Not owned") + ": " + esc(i.n) + '">' + (o ? "✓" : "") + "</button>" +
          '<button class="main" data-a="open" data-k="' + esc(i.k) + '"><b>' + esc(i.n) + '</b><span class="meta"><span class="rar">' + rar(i.r) + "</span>" + sinDots(i) + kwChips(i) +
          (o && (o.u || o.l) ? '<span class="muted small">' + (o.u ? "Uptie " + o.u : "") + (o.u && o.l ? " · " : "") + (o.l ? "Lv " + o.l : "") + "</span>" : "") + "</span></button>" + tierBadge(i.k) + "</div>";
      }).join("");
    });
    return out || '<div class="notice">Nothing matches those filters.</div>';
  }

  function teamMembers(t) {
    var keys = t.order && t.order.length ? t.order : C.SINNERS.map(function (s) { return s.k; });
    return keys.map(function (sk) { return S.byKey[(t.slots || {})[sk]]; }).filter(Boolean);
  }
  function statsHtml(members) {
    var st = K.teamStats(members, S.tiers);
    var sins = Object.keys(C.SINS).filter(function (x) { return st.sins[x]; }).sort(function (a, b) { return st.sins[b] - st.sins[a]; });
    var kws = Object.keys(st.kw).sort(function (a, b) { return st.kw[b] - st.kw[a]; });
    return '<div class="sinbar">' + (sins.length ? sins.map(function (x) { return '<span class="sinpill num" style="--c:' + C.SINS[x] + '"><i class="dot" style="--c:' + C.SINS[x] + '"></i>' + x + " " + st.sins[x] + "</span>"; }).join("") : '<span class="muted small">Pick Identities to see the Sin skills in the deck.</span>') + "</div>" +
      (kws.length ? '<div class="row small">' + kws.map(function (x) { return '<span class="kw" style="--c:' + C.KEYWORDS[x] + '">' + x + " ×" + st.kw[x] + "</span>"; }).join("") + (st.avg != null ? '<span class="muted">Average score ' + st.avg + " (" + K.tierOf(st.avg) + ")</span>" : "") + "</div>" : "");
  }
  V.teams = function () {
    if (!S.ids.length) return emptyData();
    var h = '<section class="card"><header><h2>My teams</h2><button class="btn small primary" data-a="newTeam">New team</button></header>';
    if (!S.teams.list.length) h += '<div class="notice">No teams saved yet. Start one, or copy a recommended team below.</div>';
    S.teams.list.forEach(function (t) {
      var open = S.editTeam === t.id, mem = teamMembers(t);
      h += '<div class="teamcard"><div class="row spread"><b>' + esc(t.name || "Team") + '</b><span class="row"><button class="btn small" data-a="editTeam" data-id="' + t.id + '">' + (open ? "Done" : "Edit") + '</button><button class="btn small ghost" data-a="delTeam" data-id="' + t.id + '">Delete</button></span></div>';
      if (open) {
        h += '<input class="field" id="tn-' + t.id + '" value="' + esc(t.name || "") + '" placeholder="Team name" data-i="teamName" data-id="' + t.id + '" aria-label="Team name">' +
          '<p class="muted small" style="margin:0">Choose one Identity per Sinner, then tap the box on the right to set who deploys, in order.</p>';
        C.SINNERS.forEach(function (sn) {
          var cur = (t.slots || {})[sn.k] || "", pos = (t.order || []).indexOf(sn.k);
          var opts = S.ids.filter(function (i) { return i.sk === sn.k; }).sort(function (a, b) { return (owned(b.k) - owned(a.k)) || (((S.tiers[b.k] || {}).score || 0) - ((S.tiers[a.k] || {}).score || 0)); });
          h += '<div class="slot" style="--c:' + sn.c + '"><span class="who">' + esc(sn.n) + '</span><select id="sl-' + t.id + "-" + sn.k + '" data-i="slot" data-id="' + t.id + '" data-sk="' + sn.k + '" aria-label="' + esc(sn.n) + ' Identity"><option value="">Not chosen</option>' +
            opts.map(function (i) { var tr = S.tiers[i.k]; return '<option value="' + esc(i.k) + '"' + (cur === i.k ? " selected" : "") + ">" + (owned(i.k) ? "✓ " : "") + rar(i.r) + " " + esc(i.n) + (tr && tr.tier !== "?" ? " · " + tr.tier : "") + "</option>"; }).join("") +
            '</select><button class="ord' + (pos >= 0 ? " on" : "") + '" data-a="ord" data-id="' + t.id + '" data-sk="' + sn.k + '" aria-label="Deployment order for ' + esc(sn.n) + '">' + (pos >= 0 ? pos + 1 : "–") + "</button></div>";
        });
      } else {
        h += '<div class="members">' + (mem.length ? mem.map(function (i) { return idChip(i); }).join("") : '<span class="muted small">Empty team</span>') + "</div>";
      }
      h += statsHtml(mem) + "</div>";
    });
    h += "</section>";
    h += '<section class="card"><header><h2>Recommended teams</h2><span class="muted small">Built from the averaged tier list: the best-rated Identity per Sinner for each status.</span></header>';
    var recs = [["Best of what you own", function () { return true; }, true]];
    Object.keys(C.KEYWORDS).forEach(function (kw) { recs.push([kw.charAt(0).toUpperCase() + kw.slice(1), function (i) { return i.kw.indexOf(kw) >= 0; }, false, kw]); });
    recs.forEach(function (r, ix) {
      var ideal = r[2] ? [] : K.bestTeam(S.ids, S.tiers, r[1], 7, false), mine = K.bestTeam(S.ids, S.tiers, r[1], 7, true, S.roster.ids);
      h += '<div class="teamcard"><div class="row spread"><b' + (r[3] ? ' style="color:' + C.KEYWORDS[r[3]] + '"' : "") + ">" + esc(r[0]) + "</b></div>";
      if (!r[2]) h += '<div><h3>Strongest line-up</h3><div class="members" style="margin-top:6px">' + ideal.map(function (i) { return idChip(i); }).join("") + '</div><div class="row" style="margin-top:6px"><span class="muted small">You own ' + ideal.filter(function (i) { return owned(i.k); }).length + " of " + ideal.length + '</span><button class="btn small ghost" data-a="useRec" data-ix="' + ix + '" data-own="0">Copy to my teams</button></div></div>';
      h += "<div><h3>" + (r[2] ? "Highest rated, one per Sinner" : "With what you own") + '</h3><div class="members" style="margin-top:6px">' + (mine.length ? mine.map(function (i) { return idChip(i); }).join("") : '<span class="muted small">You own no ' + esc(r[0]) + " Identities yet.</span>") + "</div>" +
        (mine.length ? '<div class="row" style="margin-top:6px">' + (mine.length < 5 && !r[2] ? '<span class="muted small">Too few for a full team; fill the gaps with your best others.</span>' : "") + '<button class="btn small ghost" data-a="useRec" data-ix="' + ix + '" data-own="1">Copy to my teams</button></div>' : "") + "</div>" + statsHtml(r[2] ? mine : ideal) + "</div>";
    });
    S._recs = recs;
    return h + "</section>";
  };

  V.tracker = function () {
    var now = new Date(), tr = S.tracker;
    var d = tr.daily.day === K.gameDay(now) ? tr.daily.done : {}, w = tr.weekly.week === K.gameWeek(now) ? tr.weekly.done : {};
    function checks(list, done, kind) { return '<div class="checks">' + list.map(function (x) { return '<label class="check' + (done[x[0]] ? " done" : "") + '"><input type="checkbox" data-i="' + kind + '" data-k="' + x[0] + '"' + (done[x[0]] ? " checked" : "") + "><span>" + esc(x[1]) + "</span></label>"; }).join("") + "</div>"; }
    var cleared = C.CANTOS.filter(function (c) { return tr.story[c[0]]; }).length;
    var cap = 40; ["c5", "c6", "c7", "c8"].forEach(function (c) { if (tr.story[c]) cap += 5; });
    var h = '<div class="grid two"><div class="col">';
    h += '<section class="card"><header><h2>Routine</h2></header><h3>Daily · resets in <span class="num" data-timer="daily">–</span></h3>' + checks(C.DAILIES, d, "daily") + '<h3>Weekly · resets in <span class="num" data-timer="weekly">–</span></h3>' + checks(C.WEEKLIES, w, "weekly") + "</section>";
    h += '<section class="card"><header><h2>Story</h2><span class="muted small num">' + cleared + " of " + C.CANTOS.length + " Cantos cleared</span></header>" + '<div class="bar"><i style="width:' + (cleared / C.CANTOS.length * 100) + '%"></i></div><div class="checks">' +
      C.CANTOS.map(function (c) { return '<label class="check' + (tr.story[c[0]] ? " done" : "") + '"><input type="checkbox" data-i="story" data-k="' + c[0] + '"' + (tr.story[c[0]] ? " checked" : "") + "><span><b>" + c[1] + "</b> " + esc(c[2]) + "</span></label>"; }).join("") +
      '</div><p class="muted small" style="margin:0">Identity level cap for your cleared Cantos: ' + cap + (cap >= 60 ? " or higher (check in game)" : "") + ". Canto V, VI, VII and VIII each raise it by 5.</p></section>";
    h += '<section class="card"><header><h2>Goals</h2></header>' + (tr.goals.length ? tr.goals.map(function (g, ix) { return '<div class="row spread"><label class="check' + (g.done ? " done" : "") + '" style="flex:1"><input type="checkbox" data-i="goal" data-ix="' + ix + '"' + (g.done ? " checked" : "") + "><span>" + esc(g.t) + '</span></label><button class="btn small ghost" data-a="delGoal" data-ix="' + ix + '" aria-label="Remove goal">Remove</button></div>'; }).join("") : '<div class="notice">Nothing here yet.</div>') +
      '<form class="search" data-f="goal"><input class="field" id="goal-new" placeholder="Add a goal" aria-label="New goal"><button class="btn" type="submit">Add</button></form></section>';
    h += '</div><div class="col">';
    if (S.ids.length) {
      h += '<section class="card"><header><h2>Collection by Sinner</h2></header>' + C.SINNERS.map(function (sn) {
        var list = S.ids.filter(function (i) { return i.sk === sn.k; }), mine = list.filter(function (i) { return owned(i.k); }).length;
        return '<div class="row" style="flex-wrap:nowrap"><span style="width:104px;color:' + sn.c + ';font-family:var(--font-display);text-transform:uppercase;font-size:.82rem">' + esc(sn.n) + '</span><div class="bar" style="flex:1"><i style="width:' + (mine / list.length * 100) + "%;background:" + sn.c + '"></i></div><span class="num small muted" style="width:52px;text-align:right">' + mine + "/" + list.length + "</span></div>";
      }).join("") + "</section>";
    }
    h += '<section class="card"><header><h2>Resources</h2></header><div class="filters">' + [["lunacy", "Lunacy"], ["thread", "Thread"], ["crates", "Egoshard crates"], ["ideality", "Ideality on banner"], ["pass", "Limbus Pass level"], ["tickets", "Extraction tickets"]].map(function (x) {
      return '<label class="small muted">' + x[1] + '<input class="field num" type="number" inputmode="numeric" id="res-' + x[0] + '" value="' + esc(tr.res[x[0]] == null ? "" : tr.res[x[0]]) + '" data-i="res" data-k="' + x[0] + '"></label>';
    }).join("") + "</div></section>";
    h += '<section class="card"><header><h2>E.G.O</h2></header>' + (tr.egos.length ? '<div class="scroll-x"><table class="plain"><thead><tr><th>E.G.O</th><th>Sinner</th><th>Grade</th><th>Threadspin</th><th></th></tr></thead><tbody>' + tr.egos.map(function (e, ix) {
      return "<tr><td>" + esc(e.n) + '</td><td style="color:' + sinner(e.sk).c + '">' + esc(sinner(e.sk).n) + "</td><td>" + esc(e.g || "") + '</td><td><select id="ego-ts-' + ix + '" data-i="egoTs" data-ix="' + ix + '" aria-label="Threadspin" style="min-height:36px">' + ["", "I", "II", "III", "IV", "V"].map(function (t) { return "<option" + (e.ts === t ? " selected" : "") + ">" + t + "</option>"; }).join("") + '</select></td><td><button class="btn small ghost" data-a="delEgo" data-ix="' + ix + '">Remove</button></td></tr>';
    }).join("") + "</tbody></table></div>" : '<div class="notice">List the E.G.O you own here.</div>') +
      '<form class="filters" data-f="ego"><input class="field" id="ego-n" placeholder="E.G.O name" aria-label="E.G.O name"><select id="ego-sk" aria-label="Sinner">' + C.SINNERS.map(function (s) { return '<option value="' + s.k + '">' + esc(s.n) + "</option>"; }).join("") + '</select><select id="ego-g" aria-label="Grade"><option>ZAYIN</option><option>TETH</option><option>HE</option><option>WAW</option><option>ALEPH</option></select><button class="btn" type="submit">Add</button></form></section>';
    h += '<section class="card"><header><h2>Notes</h2></header><textarea id="notes" data-i="notes" placeholder="Anything you want to remember" aria-label="Notes">' + esc(tr.notes || "") + "</textarea></section>";
    return h + "</div></div>";
  };

  V.archive = function () {
    var items = S.archive.items || [], cats = [];
    items.forEach(function (i) { if (cats.indexOf(i.cat) < 0) cats.push(i.cat); });
    var h = '<section class="card"><header><h2>Everything Limbus you have made here</h2><span class="muted small">Links open the original chat, where the files are.</span></header>';
    if (!items.length) h += '<div class="notice">' + (S.sync === "live" ? "Nothing archived yet." : "Your archive is kept with your Claude account. Open this hub from Claude, signed in, and it will appear.") + "</div>";
    cats.forEach(function (c) {
      h += "<h3>" + esc(c) + '</h3><div class="arch">' + items.filter(function (i) { return i.cat === c; }).sort(function (a, b) { return a.d < b.d ? 1 : -1; }).map(function (i) {
        return '<a href="' + esc(i.url) + '" target="_blank" rel="noopener"><time>' + esc(fmtDate(i.d)) + "</time><b>" + esc(i.t) + '</b><span class="muted small">' + esc(i.desc || "") + "</span>" + (i.files && i.files.length ? '<span class="small" style="color:var(--brass)">' + esc(i.files.join(" · ")) + "</span>" : "") + "</a>";
      }).join("") + "</div>";
    });
    return h + "</section>";
  };

  V.ask = function () {
    if (SHELL && !S.sample) return answerPanel();
    var h = '<section class="card"><header><h2>Ask the hub</h2><span class="muted small">Claude, with your roster and the tier list in view. It cannot browse the web from here.</span></header>';
    if (!S.sample) return h + '<div class="notice">The assistant works when this hub is opened from Claude. For web questions, use the search bar on Home.</div></section>';
    h += '<div class="chat" id="chat">' + (S.chat.length ? S.chat.map(function (m) { return '<div class="msg ' + (m.role === "user" ? "me" : "it") + '">' + esc(m.content) + "</div>"; }).join("") :
      '<div class="chips">' + ["Which Identity should I get next?", "Build the best team from what I own.", "What is my roster missing?", "Explain Poise in simple words."].map(function (q) { return '<button class="chip" data-a="askQuick">' + esc(q) + "</button>"; }).join("") + "</div>") + "</div>" +
      '<form class="search" data-f="ask"><input class="field" id="ask-q" placeholder="Ask about your account, teams or the game" value="' + esc(S.askDraft) + '" autocomplete="off" aria-label="Question">' +
      (S.asking ? '<button class="btn" type="button" data-a="askStop">Stop</button>' : '<button class="btn primary" type="submit">Ask</button>') + "</form>" +
      (S.chat.length ? '<div class="row"><button class="btn small ghost" data-a="askClear">Start over</button></div>' : "") + "</section>";
    return h;
  };

  V.config = function () {
    var p = S.prefs, reqs = S.requests.list || [];
    var h = '<div class="grid two"><div class="col"><section class="card"><header><h2>Look</h2></header>' +
      '<label class="small muted">Name shown in the top bar<input class="field" id="pref-name" value="' + esc(p.name || "") + '" placeholder="Limbus Hub" data-i="pref" data-k="name"></label>' +
      '<label class="small muted">Sinner on duty<select id="pref-fixed" data-i="prefSinner"><option value="">A different Sinner every day</option>' + C.SINNERS.map(function (s) { return '<option value="' + s.k + '"' + (p.mode === "fixed" && p.fixed === s.k ? " selected" : "") + ">Always " + esc(s.n) + "</option>"; }).join("") + "</select></label>" +
      '<p class="muted small" style="margin:0">On a Sinner’s birthday, that Sinner takes the day.</p></section>';
    h += '<section class="card"><header><h2>Ask for an improvement</h2></header><p class="muted small" style="margin:0">Write what you want changed or added. The daily update reads this list and makes small changes itself; bigger ones it answers here.</p>' +
      '<form data-f="req" class="col" style="gap:8px"><textarea id="req-new" placeholder="For example: add a column for Uptie on the tier list" aria-label="Improvement request"></textarea><button class="btn" type="submit">Send request</button></form>' +
      (reqs.length ? reqs.slice().reverse().map(function (r) { return '<div class="teamcard"><div class="row spread"><span class="small muted">' + esc(fmtDate((r.ts || "").slice(0, 10))) + '</span><span class="kw" style="--c:' + (r.status === "done" ? "var(--good)" : r.status === "declined" ? "var(--bad)" : "var(--warn)") + '">' + esc(r.status || "new") + "</span></div><div>" + esc(r.text) + "</div>" + (r.reply ? '<div class="muted small">' + esc(r.reply) + "</div>" : "") + "</div>"; }).join("") : "") + "</section>";
    h += '</div><div class="col"><section class="card"><header><h2>Data</h2></header><p class="muted small" style="margin:0">' +
      (S.uid ? "Your roster, teams and tracker are saved to your Claude account and follow you to any device." : "Your roster, teams and tracker are saved in this browser only.") + " Identities loaded: " + S.ids.length + ". Tier lists loaded: " + Object.keys(S.sources).length + ".</p>" +
      '<p class="muted small" style="margin:0"><b>Moving between your PC browser and your phone:</b> press <i>Copy sync code</i> on one, send the text to yourself (for example a WhatsApp message to yourself), open this page on the other and press <i>Paste sync code</i>. It carries your roster, teams, tracker and archive. Pasting replaces what is on the device you paste into.</p>' +
      '<div class="row"><button class="btn small" data-a="export">Copy sync code</button><button class="btn small ghost" data-a="importOpen">Paste sync code</button></div><textarea id="backup" hidden aria-label="Sync code"></textarea><div class="row"><button class="btn small" id="importGo" data-a="importGo" hidden>Use this sync code</button></div></section>';
    var log = (S.meta && S.meta.changelog) || [];
    h += '<section class="card"><header><h2>What changed</h2></header>' + (log.length ? '<ul class="news">' + log.slice(0, 12).map(function (l) { return "<li><time>" + esc(fmtDate(l.d)) + "</time><p>" + esc(l.t) + "</p></li>"; }).join("") + "</ul>" : '<div class="notice">No changes logged yet.</div>') + "</section>";
    h += '<section class="card"><header><h2>About</h2></header><p class="muted small" style="margin:0">A personal fan tool for Limbus Company. Not affiliated with Project Moon. Identity data comes from the Limbus Company wiki and Limbus Deck; tier placements come from the sites listed under Tier list. Greeting lines are original fan writing, not lines from the game.</p></section></div></div>';
    return h;
  };
  V.more = function () {
    return '<section class="card"><header><h2>More</h2></header><div class="links">' + [["archive", "Archive", "Guides, solo runs and your OC work"], ["ask", "Ask the hub", "Questions about your account and teams"], ["config", "Options", "Look, backup, improvement requests"]].map(function (x) {
      return '<a class="link" href="#' + x[0] + '"><b>' + x[1] + "</b><span>" + x[2] + "</span></a>";
    }).join("") + "</div></section>";
  };

  /* ---------- sheet ---------- */
  function openId(k) {
    var i = S.byKey[k]; if (!i) return;
    var sn = sinner(i.sk), t = S.tiers[k] || {}, o = S.roster.ids[k];
    var rows = Object.keys(t.by || {}).map(function (key) { var b = t.by[key], s = S.sources[key] || {}; return "<tr><td>" + esc(s.name || key) + "</td><td>" + esc(b.implied ? "not in its ranked half" : b.label) + '</td><td class="num">' + b.score + '</td><td class="num">' + b.w + "</td></tr>"; }).join("");
    var h = '<div style="--c:' + sn.c + '"><div class="row spread"><span class="who" style="color:' + sn.c + ';font-family:var(--font-display);letter-spacing:.08em;text-transform:uppercase">' + esc(sn.n) + ' · <span class="rar">' + rar(i.r) + '</span></span><button class="btn small ghost" data-a="close">Close</button></div>' +
      "<h2 style=\"color:var(--text);font-size:1.3rem;text-transform:none;letter-spacing:.01em\">" + esc(i.n) + "</h2>" +
      '<div class="row">' + tierBadge(k) + (t.score != null ? '<span class="muted small">Score ' + t.score + " from " + t.n + " list" + (t.n === 1 ? "" : "s") + "</span>" : '<span class="muted small">Not rated by any list yet</span>') + "</div>" +
      '<div class="row">' + i.s.map(function (x, ix) { return '<span class="sinpill" style="--c:' + C.SINS[x] + '"><i class="dot" style="--c:' + C.SINS[x] + '"></i>Skill ' + (ix + 1) + " " + esc(x) + "</span>"; }).join("") + (i.d ? '<span class="sinpill" style="--c:' + C.SINS[i.d] + '"><i class="dot" style="--c:' + C.SINS[i.d] + '"></i>Defense ' + esc(i.d) + "</span>" : "") + "</div>" +
      '<div class="row">' + (kwChips(i) || '<span class="muted small">No status keyword</span>') + "</div>" +
      '<div class="muted small">' + esc(C.seasonLabel(i.se)) + " · released " + esc(fmtDate(i.rel)) + " · " + esc(i.fac) + "</div>" +
      '<div class="teamcard"><label class="check"><input type="checkbox" id="own-sheet" data-i="ownSheet" data-k="' + esc(k) + '"' + (o ? " checked" : "") + "><span>I own this Identity</span></label>" +
      (o ? '<div class="filters" style="grid-template-columns:1fr 1fr"><label class="small muted">Uptie<select id="up-sheet" data-i="uptie" data-k="' + esc(k) + '">' + ["", "I", "II", "III", "IV"].map(function (u, ix) { return '<option value="' + ix + '"' + ((o.u || 0) === ix ? " selected" : "") + ">" + (u || "Not set") + "</option>"; }).join("") + '</select></label><label class="small muted">Level<input class="field num" type="number" inputmode="numeric" id="lv-sheet" min="1" max="99" value="' + esc(o.l || "") + '" data-i="level" data-k="' + esc(k) + '"></label></div>' : "") + "</div>" +
      (rows ? '<div class="scroll-x"><table class="plain"><thead><tr><th>List</th><th>Placed</th><th>Score</th><th>Weight</th></tr></thead><tbody>' + rows + "</tbody></table></div>" : "") +
      '<div class="row"><a class="btn small" target="_blank" rel="noopener" href="https://limbuscompany.wiki.gg/index.php?search=' + encodeURIComponent(i.n + " " + sn.n) + '">Open on the wiki</a><a class="btn small ghost" target="_blank" rel="noopener" href="https://www.google.com/search?q=' + encodeURIComponent("Limbus Company " + i.n + " " + sn.n + " guide") + '">Search guides</a></div></div>';
    var sh = $("#sheet"); sh.innerHTML = h; sh.hidden = false; S.sheetKey = k;
  }
  function closeSheet() { $("#sheet").hidden = true; S.sheetKey = null; }

  /* ---------- render ---------- */
  function render() {
    var view = $("#view"), fn = V[S.view] || V.home;
    var act = document.activeElement, keep = act && act.id && view.contains(act) ? { id: act.id, a: act.selectionStart, b: act.selectionEnd } : null;
    view.innerHTML = fn();
    if (keep) { var el = document.getElementById(keep.id); if (el) { el.focus(); try { if (keep.a != null) el.setSelectionRange(keep.a, keep.b); } catch (e) { /* not a text field */ } } }
    document.querySelectorAll("[data-nav]").forEach(function (a) { var on = a.getAttribute("data-nav") === S.view || (a.getAttribute("data-nav") === "more" && ["archive", "ask", "config", "more"].indexOf(S.view) >= 0); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (S.view === "home") syncGo();
    if (S.sheetKey && !$("#sheet").hidden) openId(S.sheetKey);
    tick();
  }
  function renderList() { var l = $("#list"); if (!l) return render(); l.innerHTML = S.view === "tiers" ? tiersList() : idsList(); }
  function route() {
    var h = (location.hash || "").replace(/^#/, "");
    S.view = V[h] ? h : "home";
    render(); window.scrollTo(0, 0);
  }
  function fmtLeft(ms) { if (ms <= 0) return "now"; var m = Math.floor(ms / 60000), d = Math.floor(m / 1440), hr = Math.floor((m % 1440) / 60); return d ? d + "d " + hr + "h" : hr + "h " + (m % 60) + "m"; }
  function tick() {
    var now = new Date();
    document.querySelectorAll("[data-timer]").forEach(function (el) {
      var k = el.getAttribute("data-timer");
      el.textContent = k === "event" ? fmtLeft(Date.parse(el.getAttribute("data-end")) - now.getTime()) : fmtLeft(K.nextReset(now, k === "weekly").getTime() - now.getTime());
    });
  }
  function syncGo() {
    var go = $("#go"), q = (S.q || "").trim(), eng = curEngine(); if (!go) return;
    go.removeAttribute("data-a");
    if (eng === "hub") { go.href = "#ask"; go.removeAttribute("target"); return; }
    if (SHELL) go.removeAttribute("target"); else go.setAttribute("target", "_blank");
    if (!q) { go.href = "#home"; go.removeAttribute("target"); return; }
    if (isUrl(q)) { go.href = /^https?:\/\//i.test(q) ? q : "https://" + q; return; }
    if (eng === "answer") { go.href = "#home"; go.setAttribute("data-a", "goAnswer"); return; }
    var e = engineList().filter(function (x) { return x.k === eng; })[0] || C.ENGINES[0];
    go.href = e.u + encodeURIComponent(q);
  }
  function curEngine() { var e = S.prefs.engine || "google"; if (SHELL && (!S.prefs.engineSet || e === "hub")) return "answer"; return e; }
  function engineList() { return SHELL ? [{ k: "answer", n: "Answer here" }].concat(C.ENGINES, [{ k: "images", n: "Images", u: "https://www.google.com/search?tbm=isch&q=" }]) : C.ENGINES; }
  function engineChips(eng) {
    return engineList().map(function (e) { return '<button type="button" class="chip" data-a="engine" data-k="' + e.k + '" aria-pressed="' + (eng === e.k) + '">' + esc(e.n) + "</button>"; }).join("") +
      (SHELL ? "" : '<button type="button" class="chip" data-a="engine" data-k="hub" aria-pressed="' + (eng === "hub") + '">Ask the hub</button>');
  }

  /* ---------- answers and pictures inside the browser (shell mode only) ---------- */
  function isUrl(q) { return /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(q) || /^https?:\/\//i.test(q); }
  function safeUrl(u) { return /^https:\/\//i.test(u || "") ? u : ""; }
  function plain(html) { try { return new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent || ""; } catch (e) { return ""; } }
  function jget(url) {
    var ctl = typeof AbortController === "function" ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, 9000) : 0;
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error("http " + r.status); return r.json(); }, function (e) { clearTimeout(t); throw e; });
  }
  function cleanQuery(q) { return q.replace(/^(who|what|when|where|why|how)\s+(is|are|was|were|does|do|did|can|to)\s+(the\s+|a\s+|an\s+)?/i, "").replace(/[?!.\s]+$/, "").trim() || q; }
  function mentionsLimbus(q) {
    var l = q.toLowerCase();
    if (/limbus|sinner|identity|e\.?g\.?o\b|canto\b|mirror dungeon|walpurgis|enkephalin|uptie|threadspin|project moon|abnormalit|lobotomy|\blcb\b/.test(l)) return true;
    return C.SINNERS.some(function (s) { return l.indexOf(s.n.toLowerCase()) >= 0; }) || S.ids.some(function (i) { return i.n.length > 6 && l.indexOf(i.n.toLowerCase()) >= 0; });
  }
  function answer(q) {
    q = (q || "").trim(); if (!q) return;
    var id = ++S.ansId, cq = cleanQuery(q), enc = encodeURIComponent, W = "https://en.wikipedia.org/";
    S.ans = { q: q, st: "loading" }; render();
    var sum = jget(W + "w/api.php?action=query&list=search&srsearch=" + enc(cq) + "&srlimit=1&format=json&origin=*").then(function (r) {
      var hit = r && r.query && r.query.search && r.query.search[0]; if (!hit) return null;
      return jget(W + "api/rest_v1/page/summary/" + enc(hit.title.replace(/ /g, "_"))).then(function (p) {
        if (!p || !p.extract || p.type === "disambiguation") return null;
        return { title: p.title, desc: p.description || "", text: p.extract, thumb: safeUrl(p.thumbnail && p.thumbnail.source), url: safeUrl(p.content_urls && p.content_urls.desktop && p.content_urls.desktop.page) };
      });
    }).catch(function () { return null; });
    var imgs = jget("https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=" + enc(cq) + "&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|mime&iiurlwidth=360&format=json&origin=*").then(function (r) {
      var pages = (r && r.query && r.query.pages) || {};
      return Object.keys(pages).map(function (k) { return pages[k]; }).sort(function (x, y) { return (x.index || 0) - (y.index || 0); }).map(function (p) {
        var ii = p.imageinfo && p.imageinfo[0];
        if (!ii || !/^image\/(jpeg|png|webp|gif)$/.test(ii.mime || "")) return null;
        return { t: String(p.title || "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""), src: safeUrl(ii.thumburl), url: safeUrl(ii.descriptionurl) };
      }).filter(function (x) { return x && x.src; }).slice(0, 8);
    }).catch(function () { return []; });
    var wiki = !mentionsLimbus(q) ? Promise.resolve([]) : jget("https://limbuscompany.wiki.gg/api.php?action=query&list=search&srsearch=" + enc(cq) + "&srlimit=4&format=json&origin=*").then(function (r) {
      return ((r && r.query && r.query.search) || []).map(function (x) {
        return { t: x.title, u: "https://limbuscompany.wiki.gg/wiki/" + enc(String(x.title).replace(/ /g, "_")), s: plain(x.snippet).slice(0, 170) };
      });
    }).catch(function () { return []; });
    Promise.all([sum, imgs, wiki]).then(function (r) {
      if (id !== S.ansId) return;
      S.ans = { q: q, st: "done", sum: r[0], imgs: r[1], wiki: r[2] };
      render();
    });
  }
  function answerCard() {
    var a = S.ans; if (!a) return "";
    var enc = encodeURIComponent;
    var h = '<section class="card ans" aria-live="polite"><header><h2>Answer</h2><span class="muted small">for “' + esc(a.q) + '” <button class="btn small ghost" data-a="ansClear" type="button">Clear</button></span></header>';
    if (a.st === "loading") return h + '<p class="muted" style="margin:0">Looking it up…</p></section>';
    if (a.sum) {
      h += '<div class="ans-main">' + (a.sum.thumb ? '<img class="ans-thumb" src="' + esc(a.sum.thumb) + '" alt="">' : "") + "<div><h3>" + esc(a.sum.title) + "</h3>" +
        (a.sum.desc ? '<p class="muted small" style="margin:0">' + esc(a.sum.desc) + "</p>" : "") + "<p>" + esc(a.sum.text) + "</p>" +
        (a.sum.url ? '<a class="small" href="' + esc(a.sum.url) + '" target="_blank" rel="noopener">Read the full article</a>' : "") + "</div></div>";
    }
    if (a.imgs && a.imgs.length) h += '<div class="ans-imgs">' + a.imgs.map(function (m) { return '<a href="' + esc(m.url || m.src) + '" target="_blank" rel="noopener" title="' + esc(m.t) + '"><img loading="lazy" src="' + esc(m.src) + '" alt="' + esc(m.t) + '"></a>'; }).join("") + "</div>";
    if (a.wiki && a.wiki.length) h += '<div><h3 class="ans-h">From the Limbus Company wiki</h3><ul class="ans-wiki">' + a.wiki.map(function (w) { return '<li><a href="' + esc(w.u) + '" target="_blank" rel="noopener"><b>' + esc(w.t) + "</b><span>" + esc(w.s) + "</span></a></li>"; }).join("") + "</ul></div>";
    if (!a.sum && !(a.imgs && a.imgs.length) && !(a.wiki && a.wiki.length)) h += '<p class="muted" style="margin:0">No quick answer for that one. The buttons below open full results in a new tab of this browser.</p>';
    else h += '<p class="muted small" style="margin:0">Summary and pictures come from Wikipedia and Wikimedia Commons. For more, open full results below.</p>';
    h += '<div class="chips">' + [["Google", "https://www.google.com/search?q="], ["Images", "https://www.google.com/search?tbm=isch&q="], ["YouTube", "https://www.youtube.com/results?search_query="], ["Ask Claude", "https://claude.ai/new?q="], ["Ask ChatGPT", "https://chatgpt.com/?q="]].map(function (e) {
      return '<a class="chip" href="' + e[1] + enc(a.q) + '" target="_blank" rel="noopener">' + esc(e[0]) + "</a>";
    }).join("") + "</div></section>";
    return h;
  }
  function answerPanel() {
    return '<section class="card"><header><h2>Ask the web</h2><span class="muted small">Answers and pictures appear right here. Full pages open in a new tab.</span></header>' +
      '<form class="search" data-f="ans"><input class="field" id="ans-q" placeholder="Ask anything" value="' + esc(S.q) + '" autocomplete="off" aria-label="Question"><button class="btn primary" type="submit">Ask</button></form></section>' + answerCard();
  }

  /* ---------- ask ---------- */
  function askContext() {
    var top = S.ids.filter(function (i) { var t = S.tiers[i.k]; return t && (t.tier === "SS" || t.tier === "S" || t.tier === "A"); })
      .map(function (i) { return S.tiers[i.k].tier + " | " + i.n + " " + sinner(i.sk).n + " | " + i.kw.join("/"); });
    var mine = S.ids.filter(function (i) { return owned(i.k); }).map(function (i) { var o = S.roster.ids[i.k], t = S.tiers[i.k] || {}; return i.n + " " + sinner(i.sk).n + " | tier " + (t.tier || "?") + " | " + i.kw.join("/") + " | sins " + i.s.join(",") + (o.u ? " | uptie " + o.u : "") + (o.l ? " | level " + o.l : ""); });
    var tr = S.tracker;
    return "You are the assistant inside a personal Limbus Company hub. The person asking is the player (a free-to-play account unless they say otherwise). Use the data below when it helps and say plainly when it does not cover the question. You cannot browse the web here. Use simple, beginner-friendly words. Do not reveal story events past the Cantos they have cleared.\n\n" +
      "CLEARED CANTOS: " + (C.CANTOS.filter(function (c) { return tr.story[c[0]]; }).map(function (c) { return c[1]; }).join(", ") || "none recorded") + "\n" +
      "GOALS: " + (tr.goals.map(function (g) { return (g.done ? "[done] " : "") + g.t; }).join("; ") || "none") + "\n" +
      "E.G.O OWNED: " + (tr.egos.map(function (e) { return e.n + " (" + sinner(e.sk).n + (e.ts ? ", Threadspin " + e.ts : "") + ")"; }).join("; ") || "none recorded") + "\n" +
      "SAVED TEAMS: " + (S.teams.list.map(function (t) { return (t.name || "Team") + ": " + teamMembers(t).map(function (i) { return i.n + " " + sinner(i.sk).n; }).join(", "); }).join(" || ") || "none") + "\n\n" +
      "IDENTITIES THE PLAYER OWNS (" + mine.length + "):\n" + (mine.join("\n") || "none recorded") + "\n\n" +
      "AVERAGED COMMUNITY TIER LIST, tiers SS, S and A only (tier | Identity | status keywords):\n" + top.join("\n");
  }
  function ask(text) {
    text = (text || "").trim(); if (!text || S.asking || !S.sample) return;
    S.chat.push({ role: "user", content: text }); S.askDraft = ""; S.asking = true;
    var reply = { role: "assistant", content: "Thinking…" }; S.chat.push(reply);
    S.askCtl = new AbortController(); render();
    var turns = [{ role: "user", content: askContext() }].concat(S.chat.slice(0, -1));
    function paint() { var c = $("#chat"); if (c && c.lastElementChild) { c.lastElementChild.textContent = reply.content; } }
    S.sample(turns, { cache: false, signal: S.askCtl.signal, onText: function (u) { reply.content = u.text; paint(); } }).then(function (r) { reply.content = r.text; }, function (e) {
      var keep = e && e.text ? e.text + "\n\n" : "";
      var msg = { cancelled: "Stopped.", not_granted: "Claude was not allowed for this page, so the assistant is off.", rate_limited: "Too many questions right now. Try again in a little while.", session_expired: "Please sign in to Claude again.", refused: "Claude declined that one. Try wording it differently." }[e && e.code] || "Something went wrong reaching Claude. Try again.";
      reply.content = keep + msg;
      if (e && (e.code === "not_granted" || e.code === "sampling_disabled")) S.sample = null;
    }).then(function () { S.asking = false; S.askCtl = null; if (S.view === "ask") render(); });
  }

  /* ---------- actions ---------- */
  var A = {
    open: function (el) { openId(el.getAttribute("data-k")); },
    close: closeSheet,
    poke: function () { var sk = currentSinner(new Date()), p = C.LINES[sk].poke; var next; do { next = p[Math.floor(Math.random() * p.length)]; } while (p.length > 1 && next === S.poke); S.poke = next; var l = $("#line"); if (l) l.textContent = "“" + next + "”"; },
    nextSinner: function () { var keys = C.SINNERS.map(function (s) { return s.k; }), ix = keys.indexOf(currentSinner(new Date())); S.prefs.mode = "fixed"; S.prefs.fixed = keys[(ix + 1) % keys.length]; S.poke = null; saveUser("prefs"); applyTheme(); render(); },
    unpin: function () { S.prefs.mode = "rotate"; S.prefs.fixed = ""; S.poke = null; saveUser("prefs"); applyTheme(); render(); },
    engine: function (el) { S.prefs.engine = el.getAttribute("data-k"); S.prefs.engineSet = 1; saveUser("prefs"); render(); var q = $("#q"); if (q) q.focus(); },
    own: function (el) { toggleOwn(el.getAttribute("data-k")); renderList(); },
    ownBase: function () { S.ids.forEach(function (i) { if (i.r === 1 && !S.roster.ids[i.k]) S.roster.ids[i.k] = {}; }); saveUser("roster"); render(); toast("Base Identities marked as owned."); },
    clash: function () { var c = S.clash || (S.clash = { a: { base: 4, coin: 4, coins: 2, sp: 0 }, b: { base: 5, coin: 3, coins: 3, sp: 0 } }); c.res = K.clashOdds(c.a, c.b, 6000); var r = $("#clashRes"); if (r) r.innerHTML = "You win about <b>" + Math.round(c.res * 100) + "%</b> of clashes."; },
    enk: function () { var now = +$("#enk-now").value, max = +$("#enk-max").value, r = $("#enkRes"); if (!(max > 0) || now < 0 || now >= max) { r.textContent = now >= max && max > 0 ? "Already full." : "Enter both numbers."; return; } var mins = (max - now) * 6, t = new Date(Date.now() + mins * 60000); r.textContent = "Full in " + fmtLeft(mins * 60000) + ", at " + t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) + "."; },
    newTeam: function () { var t = { id: uid(), name: "Team " + (S.teams.list.length + 1), slots: {}, order: [] }; S.teams.list.push(t); S.editTeam = t.id; saveUser("teams"); render(); },
    editTeam: function (el) { var id = el.getAttribute("data-id"); S.editTeam = S.editTeam === id ? null : id; render(); },
    delTeam: function (el) { var id = el.getAttribute("data-id"); if (el.getAttribute("data-sure") !== "1") { el.setAttribute("data-sure", "1"); el.textContent = "Tap again to delete"; return; } S.teams.list = S.teams.list.filter(function (t) { return t.id !== id; }); saveUser("teams"); render(); },
    ord: function (el) { var t = team(el.getAttribute("data-id")), sk = el.getAttribute("data-sk"); if (!t) return; if (!t.slots[sk]) { toast("Choose an Identity for that Sinner first."); return; } var ix = t.order.indexOf(sk); if (ix >= 0) t.order.splice(ix, 1); else t.order.push(sk); saveUser("teams"); render(); },
    useRec: function (el) { var r = S._recs[+el.getAttribute("data-ix")], mine = el.getAttribute("data-own") === "1"; var list = K.bestTeam(S.ids, S.tiers, r[1], 7, mine, S.roster.ids); var t = { id: uid(), name: r[0] + (mine ? " (mine)" : ""), slots: {}, order: [] }; list.forEach(function (i) { t.slots[i.sk] = i.k; t.order.push(i.sk); }); S.teams.list.push(t); saveUser("teams"); render(); toast("Copied to My teams."); },
    delGoal: function (el) { S.tracker.goals.splice(+el.getAttribute("data-ix"), 1); saveUser("tracker"); render(); },
    delEgo: function (el) { S.tracker.egos.splice(+el.getAttribute("data-ix"), 1); saveUser("tracker"); render(); },
    askQuick: function (el) { ask(el.textContent); },
    goAnswer: function (el, ev) { if (ev) ev.preventDefault(); answer((S.q || "").trim()); },
    ansClear: function () { S.ans = null; S.ansId++; render(); },
    askStop: function () { if (S.askCtl) S.askCtl.abort(); },
    askClear: function () { S.chat = []; render(); },
    export: function () { var ta = $("#backup"), txt = encodeSync(userBundle()); ta.hidden = false; ta.value = txt; ta.select(); try { navigator.clipboard.writeText(txt).then(function () { toast("Sync code copied."); }, function () { toast("Select the text and copy it."); }); } catch (e) { toast("Select the text and copy it."); } },
    importOpen: function () { var ta = $("#backup"); ta.hidden = false; ta.value = ""; ta.placeholder = "Paste a sync code here"; $("#importGo").hidden = false; ta.focus(); },
    importGo: function () { var o = decodeSync($("#backup").value); if (!o) { toast("That is not a valid sync code."); return; } var n = 0; USER_DOCS.forEach(function (k) { if (o[k] && typeof o[k] === "object") { S[k] = merge(DEF[k], o[k]); saveUser(k); n++; } }); if (!n) { toast("That sync code has no data in it."); return; } rebuild(); applyTheme(); render(); toast("Sync code applied."); }
  };
  function team(id) { return S.teams.list.filter(function (t) { return t.id === id; })[0]; }
  function toggleOwn(k) { if (S.roster.ids[k]) delete S.roster.ids[k]; else S.roster.ids[k] = {}; saveUser("roster"); }
  function setCheck(kind, k, on) {
    var now = new Date(), key = kind === "daily" ? K.gameDay(now) : K.gameWeek(now), box = S.tracker[kind], field = kind === "daily" ? "day" : "week";
    if (box[field] !== key) { box[field] = key; box.done = {}; }
    if (on) box.done[k] = 1; else delete box.done[k];
    saveUser("tracker");
  }
  var I = {
    q: function (el) { S.q = el.value; syncGo(); },
    f: function (el) { var k = el.getAttribute("data-k"); S.f[k] = k === "rar" ? +el.value : el.value; renderList(); },
    src: function (el) { var k = el.getAttribute("data-k"); S.prefs.off = S.prefs.off || {}; if (el.checked) delete S.prefs.off[k]; else S.prefs.off[k] = true; saveUser("prefs"); rebuild(); render(); },
    daily: function (el) { setCheck("daily", el.getAttribute("data-k"), el.checked); el.closest(".check").classList.toggle("done", el.checked); },
    weekly: function (el) { setCheck("weekly", el.getAttribute("data-k"), el.checked); el.closest(".check").classList.toggle("done", el.checked); },
    story: function (el) { var k = el.getAttribute("data-k"); if (el.checked) S.tracker.story[k] = 1; else delete S.tracker.story[k]; saveUser("tracker"); render(); },
    goal: function (el) { S.tracker.goals[+el.getAttribute("data-ix")].done = el.checked; saveUser("tracker"); el.closest(".check").classList.toggle("done", el.checked); },
    res: function (el) { S.tracker.res[el.getAttribute("data-k")] = el.value === "" ? "" : +el.value; saveUser("tracker"); },
    egoTs: function (el) { S.tracker.egos[+el.getAttribute("data-ix")].ts = el.value; saveUser("tracker"); },
    notes: function (el) { S.tracker.notes = el.value; saveUser("tracker"); },
    clash: function (el) { var c = S.clash || (S.clash = { a: { base: 4, coin: 4, coins: 2, sp: 0 }, b: { base: 5, coin: 3, coins: 3, sp: 0 } }); c[el.getAttribute("data-s")][el.getAttribute("data-k")] = +el.value || 0; },
    teamName: function (el) { var t = team(el.getAttribute("data-id")); if (t) { t.name = el.value; saveUser("teams"); } },
    slot: function (el) { var t = team(el.getAttribute("data-id")), sk = el.getAttribute("data-sk"); if (!t) return; if (el.value) t.slots[sk] = el.value; else { delete t.slots[sk]; var ix = t.order.indexOf(sk); if (ix >= 0) t.order.splice(ix, 1); } saveUser("teams"); render(); },
    pref: function (el) { S.prefs[el.getAttribute("data-k")] = el.value; saveUser("prefs"); applyTheme(); },
    prefSinner: function (el) { if (el.value) { S.prefs.mode = "fixed"; S.prefs.fixed = el.value; } else { S.prefs.mode = "rotate"; S.prefs.fixed = ""; } S.poke = null; saveUser("prefs"); applyTheme(); },
    ownSheet: function (el) { toggleOwn(el.getAttribute("data-k")); render(); },
    uptie: function (el) { var o = S.roster.ids[el.getAttribute("data-k")]; if (o) { o.u = +el.value || 0; saveUser("roster"); if ($("#list")) renderList(); } },
    level: function (el) { var o = S.roster.ids[el.getAttribute("data-k")]; if (o) { o.l = +el.value || 0; saveUser("roster"); if ($("#list")) renderList(); } }
  };
  var F = {
    goal: function () { var el = $("#goal-new"), v = el.value.trim(); if (!v) return; S.tracker.goals.push({ t: v, done: false }); saveUser("tracker"); render(); },
    ego: function () { var n = $("#ego-n").value.trim(); if (!n) return; S.tracker.egos.push({ n: n, sk: $("#ego-sk").value, g: $("#ego-g").value, ts: "" }); saveUser("tracker"); render(); },
    ask: function () { ask($("#ask-q").value); },
    ans: function () { var v = $("#ans-q").value.trim(); S.q = v; answer(v); },
    req: function () { var el = $("#req-new"), v = el.value.trim(); if (!v) return; S.requests.list.push({ id: uid(), text: v, ts: new Date().toISOString(), status: "new" }); saveUser("requests"); render(); toast("Request saved. The next daily update will read it."); }
  };

  /* ---------- wiring ---------- */
  document.addEventListener("click", function (ev) {
    if (ev.target.id === "sheet") { closeSheet(); return; }
    var el = ev.target.closest("[data-a]"); if (!el) return;
    var fn = A[el.getAttribute("data-a")]; if (fn) fn(el, ev);
  });
  function onInput(ev) {
    var el = ev.target, k = el.getAttribute && el.getAttribute("data-i"); if (!k || !I[k]) return;
    var text = el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && ["checkbox", "radio"].indexOf(el.type) < 0);
    if (ev.type === "input" && !text) return;      // selects and checkboxes act on change
    if (ev.type === "change" && text && k !== "level") return; // text fields act as you type
    I[k](el, ev);
  }
  document.addEventListener("input", onInput);
  document.addEventListener("change", onInput);
  document.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target;
    if (f.id === "searchForm") {
      var q = (S.q || "").trim(); if (!q) return;
      if (curEngine() === "hub") { S.askDraft = ""; location.hash = "#ask"; setTimeout(function () { ask(q); }, 50); S.q = ""; return; }
      syncGo(); $("#go").click(); return;
    }
    var k = f.getAttribute("data-f"); if (k && F[k]) F[k]();
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
  window.addEventListener("hashchange", route);

  function boot() {
    $("#tabs").innerHTML = NAV.map(function (n) { return '<a href="#' + n[0] + '" data-nav="' + n[0] + '">' + n[1] + "</a>"; }).join("");
    $("#bottom").innerHTML = NAV_PHONE.map(function (n) { return '<a href="#' + n[0] + '" data-nav="' + n[0] + '">' + n[1] + "</a>"; }).join("");
    loadData(); applyTheme(); setSync("loading"); route(); startSync();
    setInterval(tick, 30000);
    setInterval(function () { applyTheme(); if (S.view === "home" && !document.activeElement.matches("input,textarea,select")) render(); }, 15 * 60000);
  }
  window.LCBHub = { state: S };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
