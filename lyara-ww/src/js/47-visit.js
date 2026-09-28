/* 47-visit.js — P1-1: local journal + «Depuis ta dernière visite» (DiffCard) + meters animated from the last visit.
   Stage 5. Writes happen ONLY after a live render ('live-rendered'): one journal entry per local day and character
   (kata.v1.journal, ≤ CONFIG.journalMax), then S.lastSeen. Offline / cache: nothing is written, nothing is shown.
   Baseline of this visit = S.lastSeen of the same character, frozen for the whole page session (so the card does not
   vanish once lastSeen is rewritten), else — first visit of the research player — the 21/08 gear snapshot
   («depuis le 21/08»: gear and ilvl only; score / raid are never invented).
   K.visit: card(E, ctx) → Safe DiffCard (data-qa="diff"; '' when hidden) · spark(meterId, ctx) → journal sparkline for
     the meter sheet · values(E, ctx) · baseAt() → ms|null (session baseline, used by the Guide «nouveau» badge) ·
     charKey(). __LYARA__.visit = {base 'visit'|'snap'|null, n (changes), journal (entries of this character)}. */
(function (K) {
  'use strict';
  const { h } = K;
  const U = K.util, F = K.fmt, UI = K.ui, isNum = U.isNum;
  const L = window.__LYARA__;
  const SF = s => K.SLOT_FR[s] || s;
  const n1 = v => Math.round(v * 10) / 10;
  const numOr = v => (isNum(v) ? v : null);
  const charKey = () => { const s = K.S.settings; return [s.region, s.realm, s.name].map(x => String(x || '').toLowerCase()).join('/'); };

  /* ---------- the numbers the meters show, in a storable shape ---------- */
  const gearOf = M => {
    const g = {};
    K.SLOTS.forEach(s => { const x = M.gear[s]; if (x && x.present) g[s] = [x.id != null ? x.id : null, numOr(x.ilvl)]; });
    return g;
  };
  const values = (E, c) => {
    const M = c.M, r = M.raid, v = E.vault, NU = K.nowUI;
    const oc = NU.optimCells(c), known = oc.filter(x => x.st !== 'inconnu');
    const ench = oc.filter(x => x.k === 'ench' && x.st !== 'inconnu');
    const cnt = cells => cells.filter(x => x.state === 'open').length;
    const si = NU.scoreInfo(c);
    return {
      ilvl: isNum(M.ilvl) ? n1(M.ilvl) : null, ilvlCalc: isNum(M.ilvlCalc) ? Math.round(M.ilvlCalc * 100) / 100 : null,
      score: numOr(M.score),
      raid: r ? { h: numOr(r.heroic_bosses_killed), m: numOr(r.mythic_bosses_killed), tot: numOr(r.total_bosses) } : null,
      weeklyN: M.weekly ? M.weekly.length : null, vaultOpen: v.unknown ? null : v.open,
      tier: M.gearPresent ? E.tier.count : null,
      enchOk: ench.length ? ench.filter(x => x.st === 'ok').length : null,
      optim: known.length ? oc.filter(x => x.st === 'ok').length : null,
      gear: gearOf(M),
      meters: { tier: M.gearPresent ? E.tier.count : null, vault: [v.unknown ? null : cnt(v.mplus), cnt(v.raid), cnt(v.world)],
        score: si ? si.sc : null, raid: r && isNum(r.mythic_bosses_killed) ? r.mythic_bosses_killed : null,
        optimOk: oc.filter(x => x.st === 'ok').map(x => x.k + ':' + x.s) }
    };
  };

  /* ---------- baseline of this visit (frozen per character for the page session) ---------- */
  const base = {};
  const snapBase = () => {
    if (!K.research.isPlayer()) return null;
    const sm = K.model.fromSnapshot();
    return sm.gearPresent && U.isISO(sm.at) ? { kind: 'snap', at: sm.at, ilvlCalc: numOr(sm.ilvlCalc), gear: gearOf(sm) } : null;
  };
  const baseFor = () => {
    const k = charKey();
    if (!Object.prototype.hasOwnProperty.call(base, k)) {
      const ls = K.S.lastSeen;
      base[k] = U.isObj(ls) && ls.c === k && U.isISO(ls.at) ? Object.assign({}, ls, { kind: 'visit' }) : snapBase();
    }
    return base[k];
  };

  /* ---------- diff vs the baseline (live only) ---------- */
  const diff = (E, c) => {
    const b = baseFor();
    if (!b || c.M.source !== 'live') return null;
    const v = values(E, c), head = [], items = [];
    const di = b.kind === 'snap' ? (isNum(v.ilvlCalc) && isNum(b.ilvlCalc) ? v.ilvlCalc - b.ilvlCalc : null)
      : isNum(v.ilvl) && isNum(b.ilvl) ? v.ilvl - b.ilvl : null;
    if (isNum(di) && Math.abs(di) >= 0.05) head.push(F.signed(n1(di), 1) + ' iLvl' + (b.kind === 'snap' ? ' (moyenne des objets)' : ''));
    if (isNum(v.score) && isNum(b.score)) { const d = Math.floor(v.score) - Math.floor(b.score); if (d) head.push(F.signed(d) + ' cote'); }
    const rb = U.obj(b.raid), rv = v.raid || {};
    if (isNum(rv.m) && isNum(rb.m) && rv.m > rb.m) head.push('Boss Mythique +' + (rv.m - rb.m));
    if (isNum(rv.h) && isNum(rb.h) && rv.h > rb.h) head.push('Boss HM +' + (rv.h - rb.h));
    if (b.kind === 'visit') {
      const since = Date.parse(b.at);
      const n = E.queue.filter(a => [a.confirmed, a.closed].some(x => typeof x === 'string' && Date.parse(x) > since)).length;
      if (n) head.push(n > 1 ? n + ' actions faites (détectées)' : '1 action faite (détectée)');
    }
    K.SLOTS.forEach(s => {
      const now = v.gear[s], old = U.obj(b.gear)[s];
      if (!now || !Array.isArray(old)) return;
      if (now[0] != null && old[0] != null && now[0] !== old[0]) items.push([isNum(now[1]) && isNum(old[1]) ? now[1] - old[1] : 0, 'Nouvel objet · ' + SF(s) + (isNum(now[1]) ? ' ' + now[1] : '')]);
      else if (now[0] != null && now[0] === old[0] && isNum(now[1]) && isNum(old[1]) && now[1] > old[1]) items.push([now[1] - old[1], 'Amélioration · ' + SF(s) + ' ' + old[1] + ' → ' + now[1]]);
    });
    items.sort((x, y) => y[0] - x[0]);
    return { b, list: head.concat(items.map(x => x[1])) };
  };
  const card = (E, c) => {
    const x = diff(E, c);
    L.visit = Object.assign(L.visit || {}, { base: x ? x.b.kind : null, n: x ? x.list.length : 0 });
    if (!x || !x.list.length) return '';
    const b = x.b, first = x.list.slice(0, 5), rest = x.list.slice(5);
    const since = b.kind === 'snap' ? 'Depuis le ' + F.ddmm(b.at) + ' · comparé à l\'équipement du snapshot (première visite)' : 'Depuis le ' + F.ddmm(b.at) + ' à ' + F.hhmm(b.at) + ' · ta dernière visite en direct';
    const chips = l => h`<ul class="chips vis-c">${l.map(t => h`<li class="chip">${t}</li>`)}</ul>`;
    return h`<div class="card vis" data-qa="diff"><div class="card-h"><h3 class="card-t">Depuis ta dernière visite</h3>${UI.provM(c.M)}</div>
      <p class="t-cap ink2">${since}</p>${chips(first)}
      ${rest.length ? h`<details class="vis-more" data-key="vis-more"><summary class="t-call"><span class="chip">+ ${rest.length}</span><span class="ink2">voir tout</span></summary>${chips(rest)}</details>` : ''}</div>`;
  };

  /* ---------- journal sparkline (meter sheets) ---------- */
  const SERIES = {
    tier: [e => e.tier, 'Tier', v => v + '/4'], vault: [e => e.vaultOpen, 'Grand Coffre', v => v + '/9'],
    score: [e => e.score, 'Cote M+', v => F.int(v)], raid: [e => (U.isObj(e.raid) ? e.raid.m : null), 'Raid Mythique', v => v + ' M'],
    optim: [e => e.optim, 'Optimisation', v => F.num(v) + ' ok']
  };
  const mine = () => { const k = charKey(); return K.store.journal().filter(e => U.isObj(e) && typeof e.d === 'string' && (e.c || k) === k); };
  const spark = (id, c) => {
    const s = SERIES[id];
    if (!s) return '';
    const pts = mine().slice(-30).map(e => ({ t: U.isISO(e.t) ? Date.parse(e.t) : Date.parse(e.d + 'T12:00:00Z'), v: s[0](e) })).filter(p => isNum(p.v));
    return h`<div class="vis-h"><p class="over">Historique · journal local</p>${K.chart.spark(pts, { label: s[1], fmt: s[2], key: id })}
      <p class="t-cap muted">Une valeur par jour, notée à chaque passage en direct et gardée sur cet appareil (30 derniers jours affichés).${c.M.source !== 'live' ? ' Rien n\'est noté hors ligne.' : ''}</p></div>`;
  };

  /* ---------- meter fills animate once, from the last visit to now (never under reduced motion) ---------- */
  let animated = false;
  const reduced = () => { try { return !window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } };
  const animate = (E, c) => {
    if (animated) return;
    animated = true;
    const b = baseFor(), root = document.querySelector('[data-screen="now"] [data-qa="meters"]');
    if (!b || b.kind !== 'visit' || !U.isObj(b.meters) || reduced() || K.router.current() !== 'now' || !root || typeof root.animate !== 'function') return;
    const bm = b.meters, v = values(E, c).meters, OPT = { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' };
    const pop = (el, i) => el.animate([{ opacity: 0.15, transform: 'scaleX(.3)' }, { opacity: 1, transform: 'none' }], Object.assign({ delay: i * 60 }, OPT));
    const run = (scope, sel, from, to) => { if (!scope || !isNum(from) || !isNum(to) || to <= from) return; const cs = scope.querySelectorAll(sel); for (let i = from; i < to && i < cs.length; i++) pop(cs[i], i - from); };
    const row = id => root.querySelector('.mrow[data-arg="' + id + '"]');
    run(row('tier'), '.c-on', bm.tier, v.tier);
    run(row('raid'), '.c-on', bm.raid, v.raid);
    const grps = row('vault') ? row('vault').querySelectorAll('.grp') : [];
    U.arr(bm.vault).forEach((n, g) => run(grps[g], '.c-on, .c-decl', n, v.vault[g]));
    const was = new Set(U.arr(bm.optimOk)), oc = K.nowUI.optimCells(c), ocs = row('optim') ? row('optim').querySelectorAll('.c') : [];
    let k = 0;
    oc.forEach((x, i) => { if (x.st === 'ok' && !was.has(x.k + ':' + x.s) && ocs[i]) pop(ocs[i], k++); });
    const si = K.nowUI.scoreInfo(c), sr = row('score');
    if (si && isNum(bm.score) && bm.score !== si.sc && sr) {
      const p0 = (U.clamp((bm.score - si.lo) / (si.hi - si.lo), 0, 1) * 100).toFixed(1) + '%', p1 = si.p.toFixed(1) + '%';
      const f = sr.querySelector('.fill'), g = sr.querySelector('.gapo');
      if (f) f.animate([{ width: p0 }, { width: p1 }], OPT);
      if (g) g.animate([{ left: p0 }, { left: p1 }], OPT);
    }
  };

  /* ---------- writes: after a LIVE render only ---------- */
  K.on('live-rendered', () => {
    if (K.M.source !== 'live') return;
    K.guard('visit', () => {
      baseFor();                                                     // freeze this visit's baseline first
      const c = K.ctx(), E = K.engine.get(), v = values(E, c), k = charKey(), now = new Date(), d = K.time.dayKey(now.getTime());
      K.guard('visit-anim', () => animate(E, c), true);
      if (d) {
        const j = K.store.journal().filter(e => U.isObj(e) && typeof e.d === 'string' && !(e.d === d && (e.c || k) === k));
        j.push({ d, t: now.toISOString(), c: k, ilvl: v.ilvl, score: v.score, raid: v.raid ? { h: v.raid.h, m: v.raid.m } : null,
          weeklyN: v.weeklyN, vaultOpen: v.vaultOpen, tier: v.tier, enchOk: v.enchOk, optim: v.optim, gear: v.gear });
        j.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : String(a.t).localeCompare(String(b.t))));
        K.store.saveJournal(j);
      }
      K.S.lastSeen = { at: now.toISOString(), c: k, ilvl: v.ilvl, ilvlCalc: v.ilvlCalc, score: v.score, raid: v.raid, gear: v.gear, meters: v.meters };
      K.store.save();
      L.visit = Object.assign(L.visit || {}, { journal: mine().length });
    }, true);
  });
  K.on('booted', () => { K.guard('visit-boot', () => { baseFor(); L.visit = Object.assign(L.visit || {}, { journal: mine().length }); }, true); });

  K.visit = { card, spark, values, charKey, journal: mine, baseAt: () => { const b = baseFor(); return b && b.kind === 'visit' ? Date.parse(b.at) : null; } };
})(KATA);
