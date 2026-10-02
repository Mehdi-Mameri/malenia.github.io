/* 40-engine.js — «Prochaine action» engine (spec P0-3, P0-4, P0-6, P0-7) + derivations reused by
   Semaine / Stuff / Analyse. Stage 2. Pure functions of ctx = K.ctx(); the only writes to S happen in the
   'model' (live) and 'live-rendered' handlers at the bottom (proof of completion) and in the action verbs
   of 45-now.js.
   K.engine.get() → memoised E (recomputed after every K.invalidate):
     E.queue[]   actions {id, rule|null, system, type, priority, title, detail, effort, loot, weekly, generic, disputed,
                 evaluable, hit, reason, magnitude, evidence[], evText, conf, s (internal, never shown), est (min;
                 per key when divisible), divisible, unitsNeeded, perMin, pips 1–5, urgency, phase 'prep'|'play',
                 done, doneAt, confirmed ISO|null, contradiction, snoozed ISO|null, pinned, closed ISO|null, group,
                 + evaluator fields (th, nAt, cnt, min, n, cell, runsToNext, weak[], killed, total, diff, needsConfirm…)}
     E.byId{} · E.cands[] · E.hero|null · E.heroOverflow · E.footnote (action|null) · E.budget (min) · E.budgetLabel
     E.raidNight · E.plan {items:[{a, units, est}], used, over, keys, budget} · E.groups {tonight, reset, loot, later,
     verify, general, done} · E.GROUPS [[key, label]] · E.campaign {a|null, type, builtin, met, title, progress, next,
     sameAsHero, go|null, sheet|null, prov 'calc'|null} · E.tier (tierState, .text «?/4» | «1/4 (4 ?)») · E.vault · E.radar · E.gates · E.unitMin
   Helpers: tierState(M,S) · tierIds(R) · vault(M,W,T) · allWeeklyRuns(M,W) · radar(M) · fitLevelScore(runs) · dungeonPool(M)
     gates(M,T,tier,enchEv) · projection(M,target,v) · eveningsLeft(time) · budgetMin(S,time) · raidNight(S,time)
     fmtMin(min) «10 min», «2 h 30» · ord(n) «1re»/«2e» · EVAL (evaluators) · build(ctx). */
(function (K) {
  'use strict';
  const U = K.util, C = K.CONFIG, F = K.fmt;
  const isNum = U.isNum;
  const L = window.__LYARA__;
  const CONF_N = { basse: 1, moyenne: 2, haute: 3 };
  const cmin = (...l) => K.ui.confMin(...l);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const nev = reason => ({ evaluable: false, hit: false, reason });
  const rslot = s => String(s).replace(/[12]$/, '');                      // finger1 → finger (research slot)
  const SLOTS = K.SLOTS, expand = list => K.expandSlots(list).filter(s => SLOTS.includes(s));
  const fmtMin = m => { if (!isNum(m)) return F.DASH; m = Math.round(m); if (m < 60) return m + ' min'; const r = m % 60; return Math.floor(m / 60) + ' h' + (r ? ' ' + (r < 10 ? '0' : '') + r : ''); };
  const ord = n => (n === 1 ? '1re' : n + 'e');
  const sourceConf = M => (M.source === 'live' ? 'haute' : M.source === 'cached' || M.source === 'snapshot' ? 'moyenne' : 'basse');

  /* ---------- tier (P0-11): manual override (same itemId) › research set item id › API `tier` › name heuristic › unknown ---------- */
  const tierSlots = () => { const s = K.R.tierSet.slots.filter(x => SLOTS.includes(x)); return s.length ? s : C.tierSlotsDefault; };
  /* research set ids, parsed from R.tierSet.acquisition «Nom (tête, 271519)», limited to the set slots → {slot: {id, name}} */
  const FR_SLOT = { 'tête': 'head', 'épaules': 'shoulder', torse: 'chest', mains: 'hands', jambes: 'legs', pieds: 'feet' };
  let idsSrc = null, idsMemo = {};
  const tierIds = R => {
    const ts = (R || K.R).tierSet;
    if (idsSrc === ts) return idsMemo;
    const slots = tierSlots(), out = {}, re = /([A-Z][\w' -]+?) \((tête|épaules|torse|mains|jambes|pieds), (\d{5,7})\)/g;
    if (ts.acquisitionConfidence !== 'basse') U.arr(ts.acquisition).forEach(line => { let m; re.lastIndex = 0; while ((m = re.exec(U.str(line)))) { const sl = FR_SLOT[m[2]]; if (sl && slots.includes(sl) && !out[sl]) out[sl] = { id: +m[3], name: m[1].trim() }; } });
    idsSrc = ts; idsMemo = out;
    return out;
  };
  const tierState = (M, S) => {
    M = M || K.M; S = S || K.S;
    const ts = K.R.tierSet;
    const toks = ts.name && ts.nameConfidence !== 'basse' ? U.uniq(U.fold(ts.name).split(/[^a-z0-9]+/).filter(w => w.length >= 4)) : [];
    const needTok = Math.min(2, toks.length);
    const per = tierSlots().map(slot => {
      const g = M.gear[slot];
      if (!g || !g.present) return { slot, isTier: null, prov: 'inconnu', absent: true };
      const man = U.obj(S.tierManual)[slot];
      const valid = U.isObj(man) && typeof man.isTier === 'boolean' && g.id != null && man.itemId === g.id;
      if (valid) return { slot, isTier: man.isTier, prov: 'manuel', g };
      const changed = U.isObj(man);                                            // override for another item: discarded
      const rid = tierIds()[slot];
      if (rid && g.id === rid.id) return { slot, isTier: true, prov: 'set', g, changed };   // same item id as the research set piece
      if (g.tier) return { slot, isTier: true, prov: 'live', g, changed };
      if (M.anyTierField) return { slot, isTier: false, prov: 'live', g, changed };
      if (needTok) {
        const words = U.fold(g.name).split(/[^a-z0-9]+/);
        if (toks.filter(t => words.includes(t)).length >= needTok) return { slot, isTier: null, prov: 'supposé', g, changed };
      }
      return { slot, isTier: null, prov: 'inconnu', g, changed };
    });
    const count = per.filter(p => p.isTier === true).length, unknown = per.filter(p => p.isTier === null).length;
    const pick = U.maxBy(per.filter(p => p.isTier !== true && p.g && isNum(p.g.ilvl)), p => p.g.ilvl);
    return { perSlot: per, slots: per.map(p => p.slot), count, unknown, known: per.length - unknown,
      text: per.length === unknown ? '?/4' : count + '/4' + (unknown ? ' (' + unknown + ' ?)' : ''),                // «?/4» · «1/4 (4 ?)»
      supposed: per.filter(p => p.prov === 'supposé').length, catalystPick: pick ? { slot: pick.slot, ilvl: pick.g.ilvl } : null };
  };

  /* ---------- Grand Coffre (P0-8) ---------- */
  const allWeeklyRuns = (M, W) => {
    const live = M.weekly || [];
    const man = U.arr(W && W.manualRuns).filter(m => U.isObj(m) && isNum(m.level) &&
      !live.some(r => U.sameDungeon(r, m) && r.level === m.level && Date.parse(r.at) >= (isNum(m.addedAt) ? m.addedAt : 0) - 72e5));
    return live.concat(man.map(m => ({ dungeon: U.str(m.dungeon), short: U.str(m.short), level: m.level, score: null, timed: null, at: null, manual: true, rd: K.research.dungeonFor({ dungeon: U.str(m.dungeon), short: U.str(m.short) }) })));
  };
  const nthRow = (items, rank, th) => {
    const s = items.slice().sort((a, b) => rank(b) - rank(a));
    return th.map(t => (s[t - 1] ? { state: 'open', item: s[t - 1], th: t } : { state: 'locked', need: t - s.length, th: t }));
  };
  const DIFF_RANK = { N: 1, H: 2, M: 3 };
  const vault = (M, W, T) => {
    W = W || {}; T = T || K.R.targets;
    const runs = allWeeklyRuns(M, W), max = T.vaultMplusLevel;
    const unknown = M.weekly === undefined && !runs.length;
    const mplus = unknown ? C.vault.mplus.map(t => ({ state: 'unknown', th: t }))
      : nthRow(runs, r => (isNum(r.level) ? r.level : 0), C.vault.mplus).map(c => (c.state === 'open'
        ? Object.assign(c, { maxed: isNum(max) && isNum(c.item.level) ? c.item.level >= max : null, declared: !!c.item.manual }) : c));
    const decl = c => (c.state === 'open' ? Object.assign(c, { declared: true }) : c);
    const raid = nthRow(Object.values(U.obj(W.raid)).filter(d => DIFF_RANK[d]).map(d => ({ d })), x => DIFF_RANK[x.d], C.vault.raid).map(decl);
    const world = nthRow(U.arr(W.world).filter(isNum).map(t => ({ tier: t })), x => x.tier, C.vault.world).map(decl);
    const n = runs.length, next = C.vault.mplus.find(t => t > n);
    return { mplus, raid, world, unknown, runs, n, max, open: mplus.concat(raid, world).filter(c => c.state === 'open').length,
      capped: !!M.weekly && M.weekly.length >= C.weeklyListCap, atMax: isNum(max) ? runs.filter(r => r.level >= max).length : null,
      next: next || null, runsToNext: next ? next - n : null, runsTo8: Math.max(0, C.vault.mplus[C.vault.mplus.length - 1] - n) };
  };
  /* P1-7 last week's vault: live previous-week runs (Donjons) + that week's declared raid / world rows; the rewards wait
     in game, and «Ouvre ton Coffre» is offered for 72 h after the reset (calcul KATA) until «Récupéré» (W.vaultClaimed) */
  const PREV_WINDOW = 72 * 36e5;
  const prevVault = (M, W, time) => {
    const runs = M.prevWeekly;
    if (runs === undefined) return null;
    const since = time.now - time.weekStart, open = cells => cells.filter(c => c.state === 'open');
    const cells = open(nthRow(runs, r => (isNum(r.level) ? r.level : 0), C.vault.mplus));
    const PW = K.store.week(new Date(time.weekStart - K.time.WEEK).toISOString().slice(0, 10));
    const raid = open(nthRow(Object.values(U.obj(PW.raid)).filter(d => DIFF_RANK[d]).map(d => ({ d })), x => DIFF_RANK[x.d], C.vault.raid)).length;
    const world = open(nthRow(U.arr(PW.world).filter(isNum).map(t => ({ tier: t })), x => x.tier, C.vault.world)).length;
    return { n: cells.length, levels: cells.map(c => c.item.level), raid, world, total: cells.length + raid + world, capped: runs.length >= C.weeklyListCap,
      inWindow: since >= 0 && since < PREV_WINDOW, leftMs: PREV_WINDOW - since, claimed: !!(W && W.vaultClaimed) };
  };

  /* evenings left before the reset, counting today if the local hour is < 23 (Europe/Paris) */
  const eveningsLeft = time => {
    const end = K.time.dayKey(time.resetAt), p = K.time.parts(time.now);
    const days = new Set();
    for (let t = time.now, i = 0; i < 9; i++, t += K.time.DAY) { const d = K.time.dayKey(t); if (!d || d >= end) break; days.add(d); }
    if (p && p.h >= 23) days.delete(K.time.dayKey(time.now));
    return days.size;
  };

  /* ---------- Radar de clés maths (P0-9, D5): Theil–Sen on his own timed runs ---------- */
  const fitLevelScore = runs => {
    const pts = runs.filter(r => r.timed === true && isNum(r.score) && isNum(r.level)).map(r => [r.level, r.score]);
    if (pts.length < 4 || new Set(pts.map(p => p[0])).size < 3) return null;
    const sl = [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (pts[i][0] !== pts[j][0]) sl.push((pts[j][1] - pts[i][1]) / (pts[j][0] - pts[i][0]));
    const b = U.median(sl), a = U.median(pts.map(p => p[1] - b * p[0]));
    const sigma = Math.max(2, 1.4826 * U.median(pts.map(p => Math.abs(p[1] - (a + b * p[0])))));
    const lv = pts.map(p => p[0]);
    return { a, b, sigma, lo: Math.min(...lv), hi: Math.max(...lv), n: pts.length };
  };
  /* research dungeons ∪ API runs (name first, short name second); unmatched runs keep their own tile */
  const dungeonPool = M => {
    const pool = K.R.mplus.dungeons.map(d => ({ key: 'r-' + U.slugify(d.slug || d.name), rd: d, name: d.name || '', short: U.str(d.slug).toUpperCase(), best: null, week: null, uncertain: false }));
    const add = (r, kind) => {
      let t = r.rd ? pool.find(p => p.rd === r.rd) : pool.find(p => !p.rd && U.sameDungeon(p, r));
      if (!t) { t = { key: 'a-' + U.slugify(r.dungeon || r.short || 'x'), rd: null, name: r.dungeon, short: r.short, best: null, week: null, uncertain: true }; pool.push(t); }
      if (r.short) t.short = r.short;
      if (!t[kind] || (isNum(r.score) ? r.score : -1) > (isNum(t[kind].score) ? t[kind].score : -1)) t[kind] = r;
    };
    (M.best || []).concat(M.alt || []).forEach(r => add(r, 'best'));
    (M.weekly || []).forEach(r => add(r, 'week'));
    return pool;
  };
  const radar = M => {
    const runs = (M.best || []).concat(M.alt || []);
    const fit = fitLevelScore(runs);
    const comfort = U.median(runs.filter(r => r.timed === true).map(r => r.level));
    const pool = dungeonPool(M);
    pool.forEach(d => {
      const b = d.best;
      d.ghost = !b;
      d.retime = !!b && b.timed === false;
      d.target = b && isNum(b.level) ? (b.timed ? b.level + 1 : b.level) : isNum(comfort) ? Math.round(comfort) - 1 : null;
      d.gain = fit && isNum(d.target) ? Math.max(0, fit.a + fit.b * d.target - (b && isNum(b.score) ? b.score : 0)) : null;
      d.extrapolated = !!fit && isNum(d.target) && (d.target < fit.lo - 1 || d.target > fit.hi + 1);
    });
    const sc = pool.filter(d => d.best && isNum(d.best.score)).map(d => d.best.score), sum = U.sum(sc);
    const additive = isNum(M.score) && M.score > 0 && sc.length ? Math.abs(sum - M.score) / M.score <= C.additiveTolerance : false;
    return { fit, comfort, pool, sum, additive, measured: M.best !== undefined };
  };

  /* ---------- Portes du Mythique (P0-13 §5): true / false / null (?) ---------- */
  const gates = (M, T, t, ench) => {
    const r = M.raid, tr = K.R.trinkets.raid.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99)).slice(0, 5);
    const ids = tr.map(x => x.itemId), t1 = M.gear.trinket1, t2 = M.gear.trinket2;
    const trk = !tr.length || ids.some(x => !isNum(x)) || !t1.present || !t2.present || t1.id == null || t2.id == null ? null : ids.includes(t1.id) && ids.includes(t2.id);
    return [
      { id: 'hc', label: 'HC complet', state: r && isNum(r.heroic_bosses_killed) && isNum(r.total_bosses) ? r.heroic_bosses_killed >= r.total_bosses : null },
      { id: 'ilvl', label: 'iLvl ≥ ' + (isNum(T.mythicEntryIlvl) ? T.mythicEntryIlvl : F.DASH), state: isNum(M.ilvl) && isNum(T.mythicEntryIlvl) ? M.ilvl >= T.mythicEntryIlvl : null },
      { id: 'tier', label: '4 pièces', state: t.count >= 4 ? true : t.count + t.unknown >= 4 ? null : false },
      { id: 'ench', label: 'Enchants complets', state: ench && ench.evaluable ? !ench.hit : null },
      { id: 'trinkets', label: 'Bijoux du top', state: trk }
    ];
  };

  /* ---------- projection (P0-13 §5): k items at ilvl v to reach target (calibrated on raider.io's ilvl) ---------- */
  const projection = (M, target, v) => {
    const es = SLOTS.filter(s => M.gear[s].present && isNum(M.gear[s].ilvl)).map(s => ({ ilvl: M.gear[s].ilvl, w: s === 'mainhand' && M.twoHand ? 2 : 1 }));
    if (!es.length || !isNum(target) || !isNum(v)) return null;
    const wm = xs => U.sum(xs.map(e => e.ilvl * e.w)) / U.sum(xs.map(e => e.w));
    const off = isNum(M.ilvl) ? M.ilvl - wm(es) : 0, asc = es.slice().sort((a, b) => a.ilvl - b.ilvl);
    const proj = k => wm(es.map(e => (asc.indexOf(e) < k && v > e.ilvl ? { ilvl: v, w: e.w } : e))) + off;
    let k = null;
    for (let i = 0; i <= es.length; i++) if (proj(i) >= target) { k = i; break; }
    const per = K.S.settings.itemsPerWeek;
    return { k, now: proj(0), ceiling: proj(es.length), v, target, weeks: k == null ? null : Math.ceil(k / (isNum(per) && per > 0 ? per : 1.5)) };
  };

  /* projection curve (P1-2): k (fractional) items at ilvl v → projected ilvl, same model as projection() */
  const projCurve = (M, v) => {
    const es = SLOTS.filter(s => M.gear[s].present && isNum(M.gear[s].ilvl)).map(s => ({ ilvl: M.gear[s].ilvl, w: s === 'mainhand' && M.twoHand ? 2 : 1 }));
    if (!es.length || !isNum(v)) return null;
    const wm = xs => U.sum(xs.map(e => e.ilvl * e.w)) / U.sum(xs.map(e => e.w));
    const off = isNum(M.ilvl) ? M.ilvl - wm(es) : 0, asc = es.slice().sort((a, b) => a.ilvl - b.ilvl);
    const at = k => wm(es.map(e => (asc.indexOf(e) < k && v > e.ilvl ? { ilvl: v, w: e.w } : e))) + off;
    const f = k => { const n = U.clamp(isNum(k) ? k : 0, 0, es.length), i = Math.floor(n), r = n - i; return r ? at(i) + (at(i + 1) - at(i)) * r : at(i); };
    f.slots = es.length;
    return f;
  };

  /* ---------- evaluators (spec P0-3) → {evaluable, hit, magnitude, evidence[], evidenceConf?, reason?, …} ---------- */
  const unitMin = M => {
    const seen = new Set(), ms = [];
    (M.weekly || []).concat(M.best || []).forEach(r => { const k = r.dungeon + '|' + r.level + '|' + r.at; if (!seen.has(k) && isNum(r.clear)) { seen.add(k); ms.push(r.clear); } });
    const m = U.median(ms);
    return m ? U.round5(m / 6e4 + C.keyOverheadMin) || 40 : 40;
  };
  const EVAL = {
    missingEnchant(p, x) {
      const M = x.M;
      const slots = expand(p.slots && p.slots.length ? p.slots : x.R.enchants.map(e => e.slot));
      const st = slots.filter(s => M.gear[s].present).map(s => [s, M.gear[s].ench.state]);
      if (!st.length || st.every(z => z[1] === 'inconnu')) return nev(M.source === 'snapshot' ? 'Le snapshot ne contient pas les enchants' : M.gearPresent ? 'Enchants non renvoyés par raider.io' : 'Équipement indisponible');
      const miss = st.filter(z => z[1] === 'manquant').map(z => z[0]);
      return { evaluable: true, hit: miss.length > 0, magnitude: miss.length, evidence: miss, seen: st, evidenceConf: M.source === 'live' ? 'haute' : 'moyenne' };
    },
    missingGem(p, x) {                                       // raider.io does NOT expose the socket count
      const M = x.M;
      const slots = expand(p.slots && p.slots.length ? p.slots : x.S.settings.socketSlots);
      const st = slots.filter(s => M.gear[s].present).map(s => [s, M.gear[s].gems.state]);
      if (!st.some(z => z[1] !== 'inconnu')) return nev(M.source === 'snapshot' ? 'Le snapshot ne contient pas les gemmes' : 'Gemmes non renvoyées par raider.io');
      const miss = st.filter(z => z[1] === 'vide?').map(z => z[0]);
      return { evaluable: true, hit: miss.length > 0, magnitude: miss.length, evidence: miss, seen: st, evidenceConf: 'basse' };
    },
    slotIlvlBelow(p, x) {
      const M = x.M, th = isNum(p.ilvl) ? p.ilvl : x.T.slotIlvlWeak;
      if (!isNum(th)) return nev('Seuil d\'ilvl absent de la recherche');
      if (!M.gearPresent) return nev('Équipement indisponible');
      const pool = p.slot ? expand([p.slot]) : p.slots && p.slots.length ? expand(p.slots) : K.SLOTS_EXPECTED;
      const low = pool.filter(s => M.gear[s].present && isNum(M.gear[s].ilvl) && M.gear[s].ilvl < th);
      return { evaluable: true, hit: low.length > 0, magnitude: U.sum(low.map(s => th - M.gear[s].ilvl)), evidence: low, th };
    },
    avgIlvlBelow(p, x) {
      const th = isNum(p.ilvl) ? p.ilvl : x.T.mythicEntryIlvl, v = x.M.ilvl;
      return isNum(v) && isNum(th) ? { evaluable: true, hit: v < th, magnitude: th - v, evidence: [], th } : nev('iLvl indisponible');
    },
    weeklyRunsBelow(p, x) {
      const M = x.M;
      if (M.weekly === undefined) return nev('Clés de la semaine indisponibles');
      const runs = allWeeklyRuns(M, x.W);
      const min = isNum(p.minLevel) ? p.minLevel : isNum(p.level) ? p.level : x.T.vaultMplusLevel, cnt = isNum(p.count) ? p.count : 8;
      const n = runs.length, nAt = runs.filter(r => isNum(r.level) && (!isNum(min) || r.level >= min)).length;
      const next = C.vault.mplus.find(t => t > n);
      return { evaluable: true, hit: nAt < cnt, magnitude: cnt - nAt, runsToNext: next ? next - n : null, divisible: true,
        unitsNeeded: Math.max(0, cnt - nAt), evidence: runs.map(r => '+' + r.level), n, nAt, min, cnt };
    },
    dungeonScoreGap(p, x) {
      if (x.M.best === undefined) return nev('Meilleures clés indisponibles');
      const pool = x.radar.pool, sc = d => (d.best && isNum(d.best.score) ? d.best.score : 0);
      let weak;
      if (isNum(p.minScore)) weak = pool.filter(d => sc(d) < p.minScore);
      else {
        const all = pool.map(d => d.best && d.best.score).filter(isNum);
        if (all.length < 3) return nev('Pas assez de donjons mesurés');
        const med = U.median(all), gap = isNum(p.gap) ? p.gap : 30;
        weak = pool.filter(d => !d.best || med - sc(d) > gap);
      }
      return { evaluable: true, hit: weak.length > 0, magnitude: weak.length, evidence: weak.map(d => d.short || d.name), weak, minScore: p.minScore };
    },
    tierCountBelow(p, x) {
      const t = x.tier, need = isNum(p.count) ? p.count : 4;
      if (!x.M.gearPresent) return nev('Équipement indisponible');
      return { evaluable: true, hit: t.count < need, magnitude: need - t.count, needsConfirm: t.unknown > 0, need,
        evidence: t.perSlot.filter(s => s.isTier !== true).map(s => s.slot), evidenceConf: t.unknown ? 'moyenne' : 'haute' };
    },
    raidNotCleared(p, x) {
      const d = /^(normal|heroic|mythic)$/.test(p.difficulty) ? p.difficulty : 'mythic', r = x.M.raid;
      const tot = isNum(p.bosses) ? p.bosses : r && r.total_bosses;
      if (!r || !isNum(r[d + '_bosses_killed']) || !isNum(tot)) return nev('Progression raid indisponible');
      const k = r[d + '_bosses_killed'];
      return { evaluable: true, hit: k < tot, magnitude: tot - k, evidence: [], killed: k, total: tot, diff: d };
    },
    always: () => ({ evaluable: true, hit: true, magnitude: 1, evidence: [] })
  };
  const LINKED = { vaultOpen: C.vault.conf, missingGem: 'basse', slotIlvlBelow: 'moyenne', avgIlvlBelow: 'moyenne', dungeonScoreGap: 'moyenne', raidNotCleared: 'haute', always: 'moyenne' };
  const linked = (a, x) => {
    if (a.type === 'missingEnchant') {
      const cs = (a.evidence || []).map(s => (x.R.enchants.find(e => e.slot === rslot(s)) || {}).confidence).filter(c => CONF_N[c]);
      return cs.length ? cmin(...cs) : 'moyenne';
    }
    if (a.type === 'weeklyRunsBelow' || a.type === 'vaultNext') return C.vault.conf;
    if (a.type === 'tierCountBelow') return CONF_N[x.R.tierSet.confidence] ? x.R.tierSet.confidence : 'moyenne';
    return LINKED[a.type] || 'moyenne';
  };
  const WEEKLY = ['weeklyRunsBelow', 'raidNotCleared', 'vaultNext', 'vaultOpen'];
  const KEYS = ['weeklyRunsBelow', 'vaultNext', 'dungeonScoreGap'];
  const PREP = ['missingEnchant', 'missingGem', 'tierCountBelow', 'always', 'vaultOpen'];
  const boost = (type, ev) => (type === 'missingEnchant' ? 1 + Math.min(ev.magnitude, 5) * 0.1
    : type === 'slotIlvlBelow' ? 1 + Math.min(ev.magnitude / 30, 0.6)
      : type === 'weeklyRunsBelow' || type === 'vaultNext' ? 1 + 0.6 / Math.max(ev.runsToNext == null ? 3 : ev.runsToNext, 1) : 1);
  const estOf = (a, x) => (a.type === 'vaultOpen' ? 5 : KEYS.includes(a.type) ? x.um : a.type === 'raidNotCleared' ? (isNum(x.S.settings.raidNightMin) ? x.S.settings.raidNightMin : 150)
    : C.score.EFFORT_MIN[a.effort] || 40);
  const evText = (a, x) => {
    if (a.type === 'dungeonScoreGap') return (a.weak || []).map(d => d.short || d.name).join(', ');
    if (a.type === 'weeklyRunsBelow') return a.nAt + '/' + a.cnt + ' clés';
    if (a.type === 'vaultNext') return F.count(a.n, 'clé', 'clés');
    if (a.type === 'vaultOpen') return F.count(a.magnitude, 'case', 'cases') + ' la semaine dernière';
    if (a.type === 'raidNotCleared') return a.killed + '/' + a.total;
    if (a.type === 'avgIlvlBelow') return 'iLvl ' + F.ilvl(x.M.ilvl);
    return (a.evidence || []).map(s => K.SLOT_FR[s] || s).join(', ');
  };

  const mk = (a, ev, x) => {
    const S = x.S, r = a.rule;
    Object.assign(a, ev);
    a.evidence = a.evidence || [];
    a.weekly = WEEKLY.includes(a.type);
    a.generic = a.type === 'always' || !!ev.unknownType;
    a.disputed = !!(r && r.disputed === true);
    a.loot = !!(r && r.dependsOnLoot === true);
    a.phase = PREP.includes(a.type) || ev.unknownType ? 'prep' : 'play';
    a.est = estOf(a, x);
    a.conf = null; a.s = 0; a.perMin = 0; a.pips = 1; a.urgency = 1;
    if (a.evaluable) {
      const rc = r && CONF_N[r.confidence] ? r.confidence : linked(a, x);
      a.conf = cmin(ev.evidenceConf || sourceConf(x.M), rc) || 'basse';
      const impact = (C.score.IMPACT[a.priority] || 25) * boost(a.type, ev);
      a.urgency = a.weekly ? 1 + 1.5 * U.clamp(1 - x.h / 168, 0, 1) + (x.h < 24 ? 0.5 : 0) : 1;
      a.s = impact * (a.loot ? 0.6 : 1) * a.urgency * (C.score.CONF_W[a.conf] || 0.55);
      a.perMin = a.s / Math.max(a.est, 5);
      a.pips = U.clamp(Math.ceil(impact / 30), 1, 5);
    }
    a.evText = evText(a, x);
    /* state (P0-7) */
    const d = U.obj(S.done)[a.id], ok = U.isObj(d) && (!a.weekly || d.weekKey === x.time.weekKey);
    const open = a.evaluable && a.hit;
    a.done = ok; a.doneAt = ok ? d.at : null;
    a.confirmed = ok && typeof d.liveConfirmed === 'string' && !open ? d.liveConfirmed : null;
    a.contradiction = ok && open && x.M.source === 'live' && Date.parse(x.M.at) > Date.parse(d.at);   // a live fetch AFTER the tick still sees the gap
    const sn = U.obj(S.snooze)[a.id];
    a.snoozed = typeof sn === 'string' && Date.parse(sn) > x.time.now ? sn : null;
    a.pinned = U.arr(S.pinned).includes(a.id);
    const cl = U.obj(S.closed)[a.id];
    a.closed = typeof cl === 'string' && a.evaluable && !a.hit ? cl : null;
    return a;
  };
  const isCand = a => a.evaluable && a.hit && !a.done && !a.snoozed && a.conf !== 'basse' && !a.disputed && !a.generic;
  const rank = (a, b) => b.s - a.s || a.loot - b.loot || a.est - b.est;

  /* ---------- budget (P0-6): S.budget minutes; 0 = «Soirée» (S.settings.eveningMin) ---------- */
  const raidNight = (S, time) => { const p = K.time.parts(time.now); return !!p && U.arr(S.settings.raidNights).includes(p.dow); };
  const budgetMin = (S, time) => {
    const ev = isNum(S.settings.eveningMin) && S.settings.eveningMin > 0 ? S.settings.eveningMin : 180;
    if (isNum(S.budget) && S.budget > 0) return S.budget;
    return raidNight(S, time) ? Math.max(30, ev - (isNum(S.settings.raidNightMin) ? S.settings.raidNightMin : 150)) : ev;
  };
  const BLABEL = { 30: '30 min', 60: '1 h', 120: '2 h' };

  const planOf = (q, hero, budget, prepOnly) => {
    const ok = a => !prepOnly || a.phase === 'prep';
    const pinned = q.filter(a => a.pinned && !a.done && !a.snoozed && !a.disputed && !(a.evaluable && !a.hit) && ok(a));
    const rest = q.filter(a => isCand(a) && !a.pinned && a !== hero && ok(a)).sort((a, b) => b.perMin - a.perMin);
    const seq = pinned.concat(hero && !hero.pinned && ok(hero) ? [hero] : [], rest);
    const items = [];
    let t = 0, keys = 0;
    seq.forEach(a => {
      const e = a.est || 40, forced = a.pinned || a === hero;
      if (a.type === 'vaultNext' && keys > 0) return;                        // already covered by the weekly-keys rule
      if (a.divisible) {
        const need = Math.max(0, (isNum(a.unitsNeeded) ? a.unitsNeeded : 1) - keys);
        let u = Math.min(need, Math.floor((budget - t) / e));
        if (forced && u < 1 && need > 0) u = 1;
        if (u > 0) { items.push({ a, units: u, est: u * e }); t += u * e; keys += u; }
      } else if (forced || t + e <= budget) {
        items.push({ a, units: 1, est: e }); t += e;
        if (a.type === 'vaultNext') keys += 1;
      }
    });
    items.sort((i, j) => (i.a.phase === 'prep' ? 0 : 1) - (j.a.phase === 'prep' ? 0 : 1));
    const nKeys = U.sum(items.filter(i => KEYS.includes(i.a.type)).map(i => i.units));
    return { items, used: t, over: Math.max(0, t - budget), keys: nKeys, budget };
  };

  const GROUPS = [['tonight', 'Ce soir'], ['reset', 'Avant le reset'], ['loot', 'Dépend du loot'], ['later', 'Hors budget ce soir'],
    ['verify', 'À vérifier en jeu'], ['general', 'Conseils généraux'], ['done', 'Fait · détecté en direct']];
  const groupOf = (a, inPlan, week7) => {
    if (a.confirmed) return Date.parse(a.confirmed) >= week7 ? 'done' : null;
    if (a.closed) return Date.parse(a.closed) >= week7 ? 'done' : null;
    if (inPlan.has(a)) return 'tonight';
    if (!a.evaluable) return a.unknownType ? 'general' : 'verify';
    if (!a.hit) return a.done ? 'done' : null;
    if (a.generic) return 'general';
    if (a.conf === 'basse' || a.disputed) return 'verify';
    if (a.weekly) return 'reset';
    if (a.loot) return 'loot';
    return a.done ? 'tonight' : 'later';
  };

  /* ---------- season objective (P0-4) ---------- */
  const CAMPAIGN = ['tierCountBelow', 'raidNotCleared', 'avgIlvlBelow', 'dungeonScoreGap'];
  const DIFF_FR = { mythic: 'Mythique', heroic: 'Héroïque', normal: 'Normal' }, DIFF_1 = { mythic: 'M', heroic: 'H', normal: 'N' };
  const tierObjective = (ev, x) => {
    const t = x.tier, need = isNum(ev.need) ? ev.need : 4, miss = Math.max(0, need - t.count), ch = x.S.catalyst && x.S.catalyst.charges;
    return {
      type: 'tierCountBelow', title: need + ' pièces', go: null, sheet: 'tier',
      progress: t.known === 0 ? '?/' + need + ' détectées' : t.count + '/' + need + (t.unknown ? ' (' + t.unknown + ' ?)' : ''),
      next: t.unknown ? 'Confirme tes pièces de tier (≈ 2 min)'
        : t.catalystPick && isNum(ch) && ch > 0 ? 'Catalyse ' + (K.SLOT_FR[t.catalystPick.slot] || '').toLowerCase() + ' (' + F.num(t.catalystPick.ilvl) + ') → ' + (t.count + 1) + '/' + need
          : (miss > 1 ? miss + ' pièces dépendent' : miss + ' pièce dépend') + ' du loot · détails dans Stuff'
    };
  };
  const campaignOf = (q, x, hero) => {
    const c = q.filter(a => CAMPAIGN.includes(a.type) && a.evaluable && a.hit && a.conf !== 'basse' && !a.disputed)
      .sort((a, b) => (isNum(a.priority) ? a.priority : 9) - (isNum(b.priority) ? b.priority : 9) || CAMPAIGN.indexOf(a.type) - CAMPAIGN.indexOf(b.type))[0];
    let o;
    if (c) {
      if (c.type === 'tierCountBelow') o = tierObjective(c, x);
      else if (c.type === 'raidNotCleared') {
        const b = x.R.raid.bosses.slice().sort((i, j) => (i.order || 0) - (j.order || 0))[c.killed];
        const g = x.gates.filter(z => z.state === true).length;
        o = { type: c.type, title: 'Raid ' + DIFF_FR[c.diff], go: 'analyse', progress: c.killed + '/' + c.total + ' ' + DIFF_1[c.diff] + ' · ' + g + '/5 portes ouvertes',
          next: b && b.name ? 'Prochain boss ' + DIFF_FR[c.diff] + ' : ' + b.name + ' (ordre supposé)' : 'Prochain boss : ordre inconnu' };
      } else if (c.type === 'avgIlvlBelow') {
        const hv = isNum(x.S.settings.newItemIlvl) ? x.S.settings.newItemIlvl : x.R.raid.ilvlByDifficulty.heroic, pr = projection(x.M, c.th, hv);
        o = { type: c.type, title: 'iLvl ' + c.th, go: 'gear', progress: F.ilvl(x.M.ilvl) + ' / ' + c.th,
          next: !pr ? 'Projection indisponible' : pr.k == null ? 'Cible inatteignable avec des objets à ' + hv + ', vise plus haut'
            : F.count(pr.k, 'objet', 'objets') + ' à ' + hv + ' pour ' + c.th + ' (≈ estimation)' };
      } else {
        const best = U.maxBy((c.weak || []).filter(d => isNum(d.gain)), 'gain');
        o = { type: c.type, title: 'Cote M+', go: 'week', progress: F.count(c.magnitude, 'donjon en retard', 'donjons en retard'),
          next: best ? (best.short || best.name) + ' en +' + best.target + ' ≈ +' + F.int(best.gain) + ' (±' + F.int(x.radar.fit.sigma) + ')' : 'Voir le radar de clés dans Semaine' };
      }
      o.a = c;
    } else {
      const tierRule = q.find(a => a.type === 'tierCountBelow' && a.evaluable);
      if (!tierRule && x.M.gearPresent && x.tier.count < 4) { o = tierObjective({ need: 4 }, x); o.builtin = true; o.a = null; }
      else {
        const nx = CAMPAIGN.find(t => q.some(a => a.type === t && a.hit && (!a.evaluable || a.conf === 'basse' || a.disputed)));
        const NX = { tierCountBelow: 'tier à confirmer', raidNotCleared: 'raid', avgIlvlBelow: 'iLvl', dungeonScoreGap: 'cote M+' };
        o = { type: null, met: true, a: null, go: 'analyse', title: 'Objectif de saison atteint', progress: '', next: 'prochain : ' + (nx ? NX[nx] : 'pousse ta cote') };
      }
    }
    o.sameAsHero = !!(o.a && hero && o.a === hero);
    return o;
  };

  /* ---------- build ---------- */
  const build = ctx => {
    const { M, R, T, S, W, time } = ctx;
    const x = { M, R, T, S, W, time, h: time.left / 36e5, tier: tierState(M, S), radar: radar(M), um: unitMin(M) };
    const q = [], seen = new Set();
    if (M.weekly !== undefined) {                          // system action (calcul KATA): one more key opens the next vault cell
      const n = allWeeklyRuns(M, W).length, i = C.vault.mplus.findIndex(t => t > n), toNext = i >= 0 ? C.vault.mplus[i] - n : null;
      const opened = C.vault.mplus.filter(t => t <= n).length;
      q.push(mk({ id: 'sys-vault-next', rule: null, system: true, type: 'vaultNext', priority: 2, effort: 'moyen', detail: '',
        title: toNext === 1 ? 'Clé : ouvre la ' + ord(i + 1) + ' case du Coffre' : 'Coffre M+ : ' + opened + '/' + C.vault.mplus.length + ' cases ouvertes' },
      { evaluable: true, hit: toNext === 1, magnitude: 1, runsToNext: toNext, n, cell: i + 1, evidence: [] }, x));
    }
    const pv = prevVault(M, W, time);
    if (pv && pv.inWindow && pv.total > 0) {                // system action (calcul KATA): closes only when «Récupéré» is tapped
      q.push(mk({ id: 'sys-vault-open', rule: null, system: true, type: 'vaultOpen', priority: 1, effort: 'faible', detail: '', title: 'Ouvre ton Grand Coffre' },
        { evaluable: true, hit: !pv.claimed, magnitude: pv.total, evidence: [], pv, declaredOnly: true }, x));
    }
    R.actionRules.forEach(r => {
      if (!r.id || seen.has(r.id)) return;
      seen.add(r.id);
      const type = r.when.type || '', fn = own(EVAL, type) ? EVAL[type] : null;
      let ev;
      if (!fn) ev = { evaluable: false, hit: false, reason: 'type inconnu', unknownType: true };
      else { try { ev = fn(U.obj(r.when.params), x); } catch (e) { K.report('eval:' + r.id, e); ev = nev('Évaluation impossible'); } }
      q.push(mk({ id: r.id, rule: r, system: false, type, priority: r.priority, effort: r.effort, title: U.str(r.title) || r.id, detail: U.str(r.detail) }, ev, x));
    });
    const byId = {};
    q.forEach(a => { byId[a.id] = a; });
    const ench = q.find(a => a.type === 'missingEnchant' && !(a.rule && U.arr(a.rule.when.params.slots).length)) || EVAL.missingEnchant({}, x);
    x.gates = gates(M, T, x.tier, ench);

    const rn = raidNight(S, time), budget = budgetMin(S, time);
    const cands = q.filter(isCand).sort(rank);
    const fits = cands.filter(a => a.est <= budget);
    const hero = fits[0] || cands[0] || null, top = cands[0] || null;
    const plan = planOf(q, hero, budget, rn && !(S.budget > 0));
    const inPlan = new Set(plan.items.map(i => i.a)), week7 = time.now - 7 * 864e5;
    const groups = {};
    GROUPS.forEach(g => { groups[g[0]] = []; });
    q.forEach(a => { a.group = groupOf(a, inPlan, week7); if (a.group) groups[a.group].push(a); });
    Object.keys(groups).forEach(k => groups[k].sort(k === 'done' ? (a, b) => String(b.confirmed || b.closed || b.doneAt).localeCompare(String(a.confirmed || a.closed || a.doneAt)) : rank));
    groups.tonight.sort((a, b) => plan.items.findIndex(i => i.a === a) - plan.items.findIndex(i => i.a === b));

    const E = { queue: q, byId, cands, hero, heroOverflow: !!hero && !fits.length, footnote: top && hero && top !== hero && top.est > budget ? top : null,
      budget, budgetLabel: S.budget > 0 ? BLABEL[S.budget] || fmtMin(S.budget) : (rn ? 'avant le raid' : 'soirée') + ' (' + fmtMin(budget) + ')',
      raidNight: rn, plan, groups, GROUPS, tier: x.tier, vault: vault(M, W, T), prevVault: pv, radar: x.radar, gates: x.gates, unitMin: x.um, ench };
    E.campaign = campaignOf(q, x, hero);
    L.engine = {
      budget, hero: hero ? hero.id : null, objective: E.campaign.a ? E.campaign.a.id : E.campaign.builtin ? 'builtin-tier' : null,
      plan: plan.items.map(i => i.a.id), evaluated: q.filter(a => a.evaluable).map(a => ({ id: a.id, hit: !!a.hit, conf: a.conf, group: a.group })),
      notEvaluable: q.filter(a => !a.evaluable).map(a => ({ id: a.id, reason: a.reason || '' }))
    };
    return E;
  };
  K.derive('engine', build);

  K.engine = { get: () => K.get('engine'), build, EVAL, tierState, tierIds, vault, allWeeklyRuns, radar, fitLevelScore, dungeonPool, gates, projection, projCurve, prevVault,
    eveningsLeft, budgetMin, raidNight, fmtMin, ord, isCand, unitMin, GROUPS, DIFF_FR };

  /* ---------- P0-7 proof of completion: only on a LIVE evaluation; nothing auto-confirmed offline ---------- */
  K.on('model', ev => {
    if (!ev || ev.source !== 'live' || K.M.source !== 'live') return;
    const S = K.S, q = build(K.ctx()).queue, now = new Date().toISOString(), wk = K.time.info().weekKey;
    q.forEach(a => {
      if (a.declaredOnly) return;                                                  // never «détecté en direct»
      const d = S.done[a.id], ok = U.isObj(d) && (!a.weekly || d.weekKey === wk);
      if (ok && a.evaluable) {
        if (!a.hit) { if (!d.liveConfirmed) d.liveConfirmed = now; }
        else if (d.liveConfirmed) delete S.done[a.id];                             // proven, then the gap re-opened
      }
      if (a.evaluable && a.hit && S.closed[a.id]) delete S.closed[a.id];
      if (S.fired[a.id] === true && a.evaluable && !a.hit && !ok && !S.closed[a.id]) S.closed[a.id] = now;   // «Écart fermé le JJ/MM»
    });
    K.store.save();
  });
  K.on('live-rendered', () => {
    if (K.M.source !== 'live') return;
    const S = K.S, t = Date.now(), wk = K.time.info().weekKey;
    K.guard('fired', () => build(K.ctx()).queue.forEach(a => { if (a.evaluable && !a.declaredOnly) S.fired[a.id] = !!a.hit; }), true);
    Object.keys(S.snooze).forEach(k => { if (!(Date.parse(S.snooze[k]) > t)) delete S.snooze[k]; });
    Object.keys(S.done).forEach(k => { const d = S.done[k]; if (!U.isObj(d) || (d.weekKey && d.weekKey !== wk)) delete S.done[k]; });
    Object.keys(S.closed).forEach(k => { if (!(Date.parse(S.closed[k]) > t - 30 * 864e5)) delete S.closed[k]; });
    K.store.save();
  });

  /* ---------- Diagnostic: rules evaluated / not evaluable (no numeric score, ever) ---------- */
  const GL = {};
  GROUPS.forEach(g => { GL[g[0]] = g[1]; });
  K.diag.extend('engine', 'Moteur de décision', () => {
    const E = K.get('engine'), ev = E.queue.filter(a => a.evaluable), ne = E.queue.filter(a => !a.evaluable);
    return K.h`<p class="t-call">${ev.length} règles évaluées · ${ne.length} non évaluables · budget ${fmtMin(E.budget)}</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Règle</th><th class="nowrap">Résultat</th><th class="nowrap">Confiance</th><th>Groupe</th></tr></thead><tbody>
      ${E.queue.map(a => K.h`<tr><td class="mono">${a.id}</td><td>${!a.evaluable ? 'non évaluable · ' + (a.reason || '') : a.hit ? 'écart' : 'ok'}</td><td>${a.conf || F.DASH}</td><td>${a.group ? GL[a.group] : F.DASH}</td></tr>`)}
      </tbody></table></div>
      <p class="t-cap muted">Radar : ${E.radar.fit ? 'pente ≈ ' + F.num(E.radar.fit.b, 1) + '/niveau, σ ≈ ' + F.num(E.radar.fit.sigma, 1) : 'ajustement impossible'} · additivité ${E.radar.additive ? 'vérifiée' : 'non vérifiée'} (Σ ${F.num(E.radar.sum, 1)} vs cote ${F.num(K.M.score, 1)})</p>`;
  });
})(KATA);
