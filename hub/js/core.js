/* Limbus hub core: pure functions (no DOM). Loaded by the page and by Node tests.
   Tier averaging method lives here and nowhere else. */
(function (root) {
  "use strict";
  var TIERS = [["SS", 93], ["S", 85], ["A", 73], ["B", 58], ["C", 40], ["D", 0]];
  var DAY = 86400000;

  function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / DAY); }
  function tierOf(score) {
    for (var i = 0; i < TIERS.length; i++) if (score >= TIERS[i][1]) return TIERS[i][0];
    return "D";
  }

  /* Turn one source's tier list into a 0-100 score per Identity.
     Each tier becomes the middle rank of the block of Identities it holds,
     measured against every Identity that existed when the list was dated.
     That puts generous and strict lists on the same scale. */
  function sourceScores(src, ids) {
    var roster = ids.filter(function (i) { return i.rel <= src.asOf; });
    var N = Math.max(roster.length, 1);
    var counts = src.scale.map(function () { return 0; });
    var p = src.p || {};
    Object.keys(p).forEach(function (k) {
      var t = Array.isArray(p[k]) ? p[k][0] : p[k];
      var ix = src.scale.indexOf(t);
      if (ix >= 0) counts[ix]++;
    });
    var band = {}, start = 1;
    src.scale.forEach(function (t, ix) {
      var end = start + counts[ix] - 1;
      var mid = counts[ix] ? (start + end) / 2 : start;
      band[t] = Math.max(0, 100 * (1 - (mid - 0.5) / N));
      start = end + 1;
    });
    var out = {};
    Object.keys(p).forEach(function (k) {
      var list = Array.isArray(p[k]) ? p[k] : [p[k]];
      var vals = list.map(function (t) { return band[t]; }).filter(function (v) { return typeof v === "number"; });
      if (!vals.length) return;
      out[k] = { score: vals.reduce(function (a, b) { return a + b; }, 0) / vals.length, label: list.join(" / "), implied: false };
    });
    if (src.universe === "top-half-3star") {
      var ranked = start - 1;
      var three = roster.filter(function (i) { return i.r === 3; });
      var rest = three.filter(function (i) { return !out[i.k]; });
      if (rest.length) {
        var mid2 = ranked + (rest.length + 1) / 2;
        var sc = Math.max(0, 100 * (1 - (mid2 - 0.5) / N));
        rest.forEach(function (i) { out[i.k] = { score: sc, label: "unranked", implied: true }; });
      }
    }
    return out;
  }

  /* Weight of a source for one Identity. */
  function weightFor(src, id, today, userWeight) {
    var w = typeof userWeight === "number" ? userWeight : (src.weight || 1);
    var age = daysBetween(src.asOf, today);
    if (age > 45) w *= Math.pow(0.5, (age - 45) / 120);          // old lists fade
    if (!src.fast && daysBetween(id.rel, src.asOf) < 90) w *= 0.5; // slow lists misplace new Identities
    return w;
  }

  /* ids: [{k,r,rel}], sources: {key: src}, opts: {off:{key:true}, weights:{key:n}, today:"YYYY-MM-DD"} */
  function computeTiers(ids, sources, opts) {
    opts = opts || {};
    var today = opts.today || new Date().toISOString().slice(0, 10);
    var per = {};
    Object.keys(sources).forEach(function (key) {
      if (opts.off && opts.off[key]) return;
      per[key] = sourceScores(sources[key], ids);
    });
    var result = {};
    ids.forEach(function (id) {
      var sum = 0, wsum = 0, n = 0, by = {};
      Object.keys(per).forEach(function (key) {
        var e = per[key][id.k];
        if (!e) return;
        var w = weightFor(sources[key], id, today, opts.weights && opts.weights[key]);
        if (e.implied) w *= 0.6;
        if (w <= 0) return;
        sum += e.score * w; wsum += w; if (!e.implied) n++;
        by[key] = { label: e.label, score: Math.round(e.score), w: Math.round(w * 100) / 100, implied: e.implied };
      });
      if (wsum > 0) {
        var s = sum / wsum;
        result[id.k] = { score: Math.round(s * 10) / 10, tier: tierOf(s), n: n, by: by };
      } else {
        result[id.k] = { score: null, tier: "?", n: 0, by: {} };
      }
    });
    return result;
  }

  /* Team maths. A Sinner's deck holds 3 copies of Skill 1, 2 of Skill 2, 1 of Skill 3. */
  var DECK = [3, 2, 1];
  function teamStats(members, tiers) {
    var sins = {}, kw = {}, scoreSum = 0, scored = 0;
    members.forEach(function (m) {
      if (!m) return;
      m.s.forEach(function (sin, i) { sins[sin] = (sins[sin] || 0) + DECK[i]; });
      (m.kw || []).forEach(function (k) { kw[k] = (kw[k] || 0) + 1; });
      var t = tiers && tiers[m.k];
      if (t && t.score != null) { scoreSum += t.score; scored++; }
    });
    return { sins: sins, kw: kw, avg: scored ? Math.round(scoreSum / scored * 10) / 10 : null, size: members.filter(Boolean).length };
  }

  /* Best team for one keyword: at most one Identity per Sinner, highest score first. */
  function bestTeam(ids, tiers, pick, size, ownedOnly, owned) {
    var bySinner = {};
    ids.forEach(function (i) {
      if (!pick(i)) return;
      if (ownedOnly && !(owned && owned[i.k])) return;
      var t = tiers[i.k]; var sc = t && t.score != null ? t.score : -1;
      var cur = bySinner[i.sk];
      if (!cur || sc > cur.sc) bySinner[i.sk] = { id: i, sc: sc };
    });
    return Object.keys(bySinner).map(function (k) { return bySinner[k]; })
      .sort(function (a, b) { return b.sc - a.sc; }).slice(0, size || 7).map(function (x) { return x.id; });
  }

  /* Clash odds for two skills. Heads chance = 50% + SP%. Coins are re-flipped each round
     and the loser drops a coin until one side has none. Monte Carlo. */
  function clashOdds(a, b, trials) {
    trials = trials || 4000;
    function roll(s, coins) {
      var p = Math.min(0.95, Math.max(0.05, 0.5 + (s.sp || 0) / 100)), v = s.base;
      for (var i = 0; i < coins; i++) if (Math.random() < p) v += s.coin;
      return v;
    }
    var wins = 0;
    for (var t = 0; t < trials; t++) {
      var ca = a.coins, cb = b.coins, guard = 0;
      while (ca > 0 && cb > 0 && guard++ < 200) {
        var ra = roll(a, ca), rb = roll(b, cb);
        if (ra > rb) cb--; else if (rb > ra) ca--;
      }
      if (ca > 0 && cb <= 0) wins++;
      else if (ca > 0 && cb > 0 && Math.random() < 0.5) wins++;
    }
    return wins / trials;
  }

  /* Which Sinner fronts the page today: birthdays first, then a 12-day rotation. */
  function sinnerOfDay(date, sinners, birthdays) {
    var md = (date.getMonth() + 1) + "-" + date.getDate();
    if (birthdays && birthdays[md]) return birthdays[md];
    var dayNo = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
    return sinners[((dayNo % sinners.length) + sinners.length) % sinners.length];
  }
  function daySlot(h) { return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 18 ? "afternoon" : h >= 18 && h < 23 ? "evening" : "night"; }

  /* Next reset: the game day rolls over at 06:00 KST (21:00 UTC); the week on Thursday. */
  function nextReset(now, weekly) {
    var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 21, 0, 0));
    if (d <= now) d = new Date(d.getTime() + DAY);
    if (weekly) while (d.getUTCDay() !== 3) d = new Date(d.getTime() + DAY); // Wed 21:00 UTC = Thu 06:00 KST
    return d;
  }
  /* The game-day key a moment belongs to (changes at each daily reset). */
  function gameDay(now) { return new Date(now.getTime() - 21 * 3600000).toISOString().slice(0, 10); }
  function gameWeek(now) {
    var d = new Date(now.getTime() - 21 * 3600000);
    var back = (d.getUTCDay() - 3 + 7) % 7;
    return new Date(d.getTime() - back * DAY).toISOString().slice(0, 10);
  }

  var api = { TIERS: TIERS, tierOf: tierOf, sourceScores: sourceScores, computeTiers: computeTiers, teamStats: teamStats,
    bestTeam: bestTeam, clashOdds: clashOdds, sinnerOfDay: sinnerOfDay, daySlot: daySlot, nextReset: nextReset,
    gameDay: gameDay, gameWeek: gameWeek, daysBetween: daysBetween };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LCBCore = api;
})(typeof window !== "undefined" ? window : globalThis);
