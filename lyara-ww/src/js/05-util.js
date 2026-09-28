/* 05-util.js — pure helpers. Stage 1.
   K.util  : type guards, maths, name normalisation, dungeon matching.
   K.fmt   : fr-FR formatting («2 214», «309,6», «30:50», «il y a 3 h», «28/09», «mercredi 30/09 à 06:00»).
   K.time  : reset / weekKey (periods from raider.io when valid, else CONFIG/Réglages rule). */
(function (K) {
  'use strict';
  var C = K.CONFIG;

  /* ---------------- util ---------------- */
  var U = (K.util = {});
  var isNum = (U.isNum = function (v) { return typeof v === 'number' && Number.isFinite(v); });
  U.isStr = function (v) { return typeof v === 'string'; };
  var isObj = (U.isObj = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); });
  var str = (U.str = function (v) { return typeof v === 'string' ? v : isNum(v) ? String(v) : ''; });
  U.arr = function (v) { return Array.isArray(v) ? v : []; };
  U.obj = function (v) { return isObj(v) ? v : {}; };
  U.clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };
  U.sum = function (xs) { return xs.reduce(function (a, b) { return a + (isNum(b) ? b : 0); }, 0); };
  U.median = function (xs) {
    var s = xs.filter(isNum).sort(function (a, b) { return a - b; });
    if (!s.length) return null;
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  /* maxBy(list, 'key' | fn) → item with the largest finite value (first wins on ties), or null */
  U.maxBy = function (xs, f) {
    var best = null, bv = -Infinity;
    (xs || []).forEach(function (x) { var v = typeof f === 'function' ? f(x) : x && x[f]; if (isNum(v) && v > bv) { bv = v; best = x; } });
    return best;
  };
  U.round5 = function (x) { return Math.round(x / 5) * 5; };
  U.uniq = function (xs) { return Array.from(new Set(xs)); };
  U.clone = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
  U.isHttps = function (s) { return typeof s === 'string' && /^https:\/\/[^\s"'<>`]+$/.test(s); };
  U.isHex = function (s) { return typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s); };
  U.isISO = function (s) { return typeof s === 'string' && s.length >= 10 && Number.isFinite(Date.parse(s)); };
  U.fold = function (s) { return str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  /* dungeon/boss name key: case, accents, apostrophes and a leading "The" insensitive
     («King's Rest» == «Kings' Rest», «The Blinding Vale» == «Blinding Vale») */
  U.normName = function (s) { return U.fold(s).replace(/['’‘`´]/g, '').trim().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, ''); };
  U.normKey = function (s) { return U.fold(s).replace(/[^a-z0-9]/g, ''); };
  U.slugify = function (s) { return U.fold(s).replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
  var nameOf = function (x) { return x ? (x.dungeon != null ? x.dungeon : x.name) : ''; };
  var shortOf = function (x) { return x ? (x.short != null ? x.short : x.short_name != null ? x.short_name : x.slug) : ''; };
  /* pairwise: normalised name first, short name second (short names differ between sources) */
  U.sameDungeon = function (a, b) {
    var na = U.normName(nameOf(a)), nb = U.normName(nameOf(b));
    if (na && nb && na === nb) return true;
    var sa = U.normKey(shortOf(a)), sb = U.normKey(shortOf(b));
    return !!(sa && sb && sa === sb);
  };
  /* list match: a name match anywhere in the list beats a short-name match */
  U.findDungeon = function (list, x) {
    var n = U.normName(nameOf(x)), s = U.normKey(shortOf(x)), i;
    if (n) for (i = 0; i < list.length; i++) if (U.normName(nameOf(list[i])) === n) return list[i];
    if (s) for (i = 0; i < list.length; i++) if (U.normKey(shortOf(list[i])) === s) return list[i];
    return null;
  };
  var seq = 0;
  U.uid = function (p) { return (p || 'k') + (++seq).toString(36); };

  /* ---------------- fmt (fr-FR) ---------------- */
  var F = (K.fmt = {});
  var DASH = (F.DASH = '—'), MINUS = (F.MINUS = '−');
  var nfs = {};
  var nf = function (d) { return nfs[d] || (nfs[d] = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })); };
  F.num = function (v, d) { return isNum(v) ? nf(d || 0).format(v).replace('-', MINUS) : DASH; };
  F.int = function (v) { return isNum(v) ? F.num(Math.floor(v)) : DASH; };            // scores: never overstated
  F.ilvl = function (v) { return isNum(v) ? F.num(Math.round(v * 10) / 10, 1) : DASH; }; // «309,6»
  F.signed = function (v, d) { return isNum(v) ? (v > 0 ? '+' : v < 0 ? MINUS : '') + nf(d || 0).format(Math.abs(v)) : DASH; };
  F.plural = function (n, one, many) { return Math.abs(n) >= 2 ? many : one; };        // French: 0 and 1 are singular
  F.count = function (n, one, many) { return F.num(n) + ' ' + F.plural(n, one, many); };

  var toMs = (F.toMs = function (t) {
    return t instanceof Date ? t.getTime() : isNum(t) ? t : typeof t === 'string' ? Date.parse(t) : NaN;
  });
  var dtfs = {};
  var dtf = function (k, o) {
    if (!dtfs[k]) {
      try { dtfs[k] = new Intl.DateTimeFormat('fr-FR', Object.assign({ timeZone: C.timeZone }, o)); }
      catch (e) { dtfs[k] = new Intl.DateTimeFormat('fr-FR', o); }
    }
    return dtfs[k];
  };
  var dateFmt = function (k, o) { return function (t) { var ms = toMs(t); return Number.isFinite(ms) ? dtf(k, o).format(ms) : DASH; }; };
  F.hhmm = dateFmt('hm', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });   // «23:14» (Europe/Paris)
  F.ddmm = dateFmt('dm', { day: '2-digit', month: '2-digit' });                       // «28/09»
  F.ddmmyyyy = dateFmt('dmy', { day: '2-digit', month: '2-digit', year: 'numeric' });
  F.weekday = dateFmt('wd', { weekday: 'long' });                                      // «mercredi»
  F.dayLong = function (t) { return Number.isFinite(toMs(t)) ? F.weekday(t) + ' ' + F.ddmm(t) + ' à ' + F.hhmm(t) : DASH; };
  /* «20 s», «2 min», «3 h», «2 j» (callers add «il y a» / «Données d'il y a») */
  F.ago = function (t, now) {
    var ms = toMs(t); if (!Number.isFinite(ms)) return DASH;
    var s = Math.max(0, Math.round(((now || Date.now()) - ms) / 1000));
    if (s < 60) return s + ' s';
    var m = Math.floor(s / 60); if (m < 60) return m + ' min';
    var h = Math.floor(m / 60); if (h < 48) return h + ' h';
    return Math.floor(h / 24) + ' j';
  };
  F.rel = function (t, now) { var a = F.ago(t, now); return a === DASH ? DASH : 'il y a ' + a; };
  /* countdown: «1 j 19 h», «5 h 12 min», «1 min» */
  F.countdown = function (ms) {
    if (!isNum(ms)) return DASH;
    ms = Math.max(0, ms);
    var d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    if (d >= 1) return d + ' j ' + h + ' h';
    if (h >= 1) return h + ' h ' + m + ' min';
    return Math.max(1, Math.ceil(ms / 6e4)) + ' min';
  };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  /* «30:50», «1:02:03» */
  F.dur = function (ms) {
    if (!isNum(ms)) return DASH;
    var t = Math.round(Math.abs(ms) / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  };
  /* timer margin: «−3:10» (in time) / «dépassé de 0:10» */
  F.margin = function (clear, par) {
    if (!isNum(clear) || !isNum(par)) return DASH;
    var d = par - clear;
    return d >= 0 ? MINUS + F.dur(d) : 'dépassé de ' + F.dur(-d);
  };

  /* ---------------- time (reset / week) ---------------- */
  var TM = (K.time = {});
  TM.DAY = 864e5; TM.WEEK = 7 * TM.DAY;
  /* next weekly reset strictly after `now`, rule {dow (0 = dimanche), hourUTC} */
  TM.nextReset = function (now, rule) {
    var dow = rule && isNum(rule.dow) ? rule.dow : C.reset.dow;
    var hr = rule && isNum(rule.hourUTC) ? rule.hourUTC : C.reset.hourUTC;
    var d = new Date(now);
    var t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hr) + ((dow - d.getUTCDay() + 7) % 7) * TM.DAY;
    while (t <= now) t += TM.WEEK;
    return t;
  };
  /* info(now?) → {now, resetAt, weekStart, weekKey:'YYYY-MM-DD', left(ms), source:'raider.io'|'calcul', period} */
  TM.info = function (now) {
    now = isNum(now) ? now : Date.now();
    var p = K.aux && K.aux.periods, cur = p && p.data && p.data.current;
    var resetAt = null, start = null, source = 'calcul';
    if (cur && U.isISO(cur.end) && Date.parse(cur.end) > now) {
      resetAt = Date.parse(cur.end); source = 'raider.io';
      start = U.isISO(cur.start) ? Date.parse(cur.start) : null;
    }
    if (resetAt === null) resetAt = TM.nextReset(now, K.S && K.S.settings && K.S.settings.reset);
    var weekStart = start !== null ? start : resetAt - TM.WEEK;
    return { now: now, resetAt: resetAt, weekStart: weekStart, weekKey: new Date(weekStart).toISOString().slice(0, 10),
      left: resetAt - now, source: source, period: cur && isNum(cur.period) ? cur.period : null };
  };
  /* local (Europe/Paris) calendar parts of t → {y, m, d, h, min, dow (0 = dimanche)} */
  var partsFmt = null;
  TM.parts = function (t) {
    var ms = toMs(t); if (!Number.isFinite(ms)) return null;
    if (!partsFmt) partsFmt = dtf('parts', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
    var o = {};
    partsFmt.formatToParts(ms).forEach(function (x) { o[x.type] = x.value; });
    var wd = { 'dim.': 0, 'lun.': 1, 'mar.': 2, 'mer.': 3, 'jeu.': 4, 'ven.': 5, 'sam.': 6 };
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute, dow: wd[o.weekday] !== undefined ? wd[o.weekday] : new Date(ms).getDay() };
  };
  /* local day key «2026-09-28» (journal: one entry per local day) */
  TM.dayKey = function (t) { var p = TM.parts(t); return p ? p.y + '-' + pad(p.m) + '-' + pad(p.d) : null; };
})(KATA);
