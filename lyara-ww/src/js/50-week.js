/* 50-week.js — «Semaine» screen (spec P0-8, §3.3). Stage 3a.
   Phone: reset → affixes → Grand Coffre (+ «Le plus rentable maintenant», pacing) → Radar de clés (52-radar.js) →
   «Tes clés cette semaine» → Raid déclaré → Monde · gouffres. Desktop ≥ 1024: 7/12 (reset, coffre, radar) + 5/12.
   Vault maths come from K.engine (vault, allWeeklyRuns, eveningsLeft); cells from K.nowUI.vaultRows.
   Sheets: 'sem-vault' (rules + «Repères d'ilvl (recherche)»), 'sem-affix', 'sem-add' (manual key form).
   Verbs: sem-open-add · sem-dj (change) · sem-lv · sem-add · sem-rm (addedAt) · sem-boss (order) · sem-raid-hm ·
   sem-raid-clear · sem-tier (change) · sem-delve · sem-delve-rm (index). Declared data lives in W (per week).
   Hooks: data-qa="reset" | "vault" | "vault-hint" | "runs" | "raid-decl" | "world". */
(function (K) {
  'use strict';
  const { h, icon, raw } = K;
  const F = K.fmt, U = K.util, UI = K.ui, C = K.CONFIG, isNum = U.isNum;
  const EN = () => K.engine;
  const SS = (id, fn) => UI.safeSection('week:' + id, fn);
  const DOW = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const RD = { N: 'N', H: 'HM', M: 'M' }, CYCLE = { '': 'N', N: 'H', H: 'M', M: '' };
  const plu = (n, one, many) => F.count(n, one, many);
  const chipSrc = (ic, txt) => h`<span class="prov">${icon(ic)}<span>${txt}</span></span>`;
  const loading = M => M.source === 'none' && K.net && (K.net.profile.state === 'loading' || K.net.profile.state === 'retrying');
  const saveW = t => { K.store.saveWeek(); K.invalidate(t || 'week'); };

  /* ---------- reset card + 7-day strip (Wednesday → Tuesday) ---------- */
  const resetCard = c => {
    const t = c.time, today = K.time.dayKey(t.now), nights = U.arr(c.S.settings.raidNights), days = [];
    for (let i = 0; i < 7; i++) {
      const at = t.weekStart + 12 * 36e5 + i * K.time.DAY, p = K.time.parts(at), k = K.time.dayKey(at);
      if (p) days.push({ p, today: k === today, past: k < today, raid: nights.includes(p.dow) });
    }
    return h`<div class="card sem-reset" data-qa="reset"><div class="card-h"><p class="over">Reset hebdomadaire</p>${t.source === 'raider.io' ? chipSrc('dot', 'raider.io') : h`<span class="nowrap">${chipSrc('approx', 'calcul · à vérifier')} ${UI.conf(C.reset.conf)}</span>`}</div>
      <p class="sem-cd"><span class="t-h2">Reset dans </span><span class="t-display num" data-sem-cd>${F.countdown(t.left)}</span></p>
      <p class="t-call ink2">${F.dayLong(t.resetAt)}</p>
      <ol class="sem-days" aria-label="Semaine en cours">${days.map(d => h`<li class="sem-d${d.today ? ' is-today' : ''}${d.past ? ' is-past' : ''}"><span>${DOW[d.p.dow]}</span><span class="num">${d.p.d}</span>${d.raid ? raw('<i class="sem-rn" aria-hidden="true"></i>') : ''}${d.today ? h`<span class="sr-only">aujourd'hui</span>` : ''}${d.raid ? h`<span class="sr-only">soir de raid</span>` : ''}</li>`)}</ol>
      ${nights.length ? h`<p class="t-cap muted">Point : soir de raid (Réglages)</p>` : ''}</div>`;
  };

  /* ---------- affixes (live names only; descriptions in a sheet; never icon_url) ---------- */
  const affixList = c => { const a = c.aux.affixes; return a.data && a.data.list && a.data.list.length ? a.data.list : null; };
  const affixCard = c => {
    const a = c.aux.affixes, list = affixList(c), rs = U.str(c.R.mplus.affixes.thisWeek), sys = U.str(c.R.mplus.affixes.system);
    const chip = list ? (a.state === 'cached' ? UI.prov('cached', F.rel(a.at)) : UI.prov('live', F.hhmm(a.at))) : rs ? UI.provResearch() : '';
    return h`<div class="card sem-aff"><div class="card-h"><h2 class="card-t">Affixes</h2><span class="nowrap">${chip}${list || sys ? h`<button type="button" class="btn btn-ghost btn-sm" data-act="sheet" data-sheet="sem-affix">${icon('info', 'i-sm')}<span>Détails</span></button>` : ''}</span></div>
      ${list ? h`<div class="chips-x">${list.map(x => h`<span class="chip">${x.name}</span>`)}</div>`
        : a.state === 'pending' ? h`<div class="chips">${UI.skel(24, '96px')}${UI.skel(24, '140px')}</div>`
          : rs ? h`<p class="t-call">${rs}</p>` : UI.empty('Affixes indisponibles')}</div>`;
  };
  K.sheet.define('sem-affix', {
    title: 'Affixes de la semaine',
    render(arg, c) {
      const a = c.aux.affixes, list = affixList(c), sys = U.str(c.R.mplus.affixes.system);
      return h`${list ? h`<div><div class="card-h"><p class="over">${U.str(a.data.title) ? a.data.title : 'raider.io'}</p>${a.state === 'cached' ? UI.prov('cached', F.rel(a.at)) : UI.prov('live', F.hhmm(a.at))}</div>
        <ul class="rows">${list.map(x => h`<li class="row"><span class="grow"><span class="ink">${x.name}</span>${x.description ? h`<br><span class="t-call ink2 any">${x.description}</span>` : ''}</span></li>`)}</ul></div>` : UI.empty('Affixes indisponibles')}
        ${sys ? h`<div><div class="card-h"><p class="over">Système de la saison</p><span class="nowrap">${UI.provResearch()} ${K.pv.conf(c.R.mplus.affixes.confidence, c.R.mplus.affixes.sources)}</span></div><p class="t-call ink2">${sys}</p></div>` : ''}`;
    }
  });

  /* ---------- Grand Coffre: rows (engine), «Le plus rentable maintenant», pacing ---------- */
  const hint = (E, c) => {
    const v = E.vault, max = v.max, ord = EN().ord;
    let p = null;
    [['m', v.mplus], ['r', v.raid], ['w', v.world]].forEach(([k, cells]) => cells.forEach((x, i) => {
      if (x.state === 'locked' && (!p || x.need < p.x.need)) p = { k, x, i };
    }));
    if (p) {
      const n = p.x.need, one = n < 2, cell = ord(p.i + 1) + ' case';
      if (p.k === 'm') return (one ? '1 clé de plus ouvre la ' : n + ' clés de plus ouvrent la ') + cell + (isNum(max) ? ' (≥ +' + max + ' pour qu\'elle soit au max)' : '');
      if (p.k === 'r') return plu(n, 'boss', 'boss') + ' de plus (déclaré' + (one ? '' : 's') + ') ouvre' + (one ? '' : 'nt') + ' la ' + cell + ' Raid';
      return plu(n, 'activité', 'activités') + ' de plus (gouffre, monde) ouvre' + (one ? '' : 'nt') + ' la ' + cell + ' Monde';
    }
    const i = v.mplus.findIndex(x => x.state === 'open' && x.maxed === false);
    if (i >= 0 && isNum(v.atMax)) { const n = Math.max(1, v.mplus[i].th - v.atMax); return plu(n, 'clé', 'clés') + ' ≥ +' + max + ' pour maximiser la case ' + (i + 1); }
    return v.open >= 9 ? 'Coffre complet cette semaine' : null;
  };
  const pace = (E, c) => {
    const v = E.vault, ev = EN().eveningsLeft(c.time);
    if (v.unknown) return null;
    if (v.runsTo8 === 0) return 'Coffre M+ complet cette semaine';
    return ev > 0 ? '≈ ' + Math.ceil(v.runsTo8 / ev) + ' clés/soir pour 8/8 (' + plu(ev, 'soir', 'soirs') + ' avant le reset)' : 'Dernier soir avant le reset passé';
  };
  const vaultCard = (E, c) => {
    const v = E.vault, hn = hint(E, c), pc = pace(E, c);
    const head = v.unknown ? (v.open ? v.open + '/9 · donjons ?' : '?/9') : (v.capped ? '≥ ' : '') + v.open + '/9';
    return h`<div class="card sem-vault" data-qa="vault"><div class="card-h"><h2 class="card-t">Grand Coffre · <span class="num">${head}</span></h2><button type="button" class="btn btn-ghost btn-sm" data-act="sheet" data-sheet="sem-vault">${icon('info', 'i-sm')}<span>Règles</span></button></div>
      <div class="vgrid">${K.nowUI.vaultRows(E, c)}</div>
      ${v.unknown ? h`<div class="btn-row sem-mt"><button type="button" class="btn" data-act="sem-open-add">${icon('pencil')}<span>Ajouter une clé à la main</span></button></div>` : ''}
      ${v.capped ? h`<p class="t-cap muted">Liste raider.io plafonnée : au moins ${v.n} clés.</p>` : ''}
      ${hn ? h`<div class="callout sem-hint" data-qa="vault-hint"><p class="over">Le plus rentable maintenant</p><p class="t-call ink">${hn}</p></div>` : ''}
      ${pc ? h`<p class="t-call ink2 vpace">${pc}</p>` : ''}</div>`;
  };
  K.sheet.define('sem-vault', {
    title: 'Grand Coffre · règles',
    render(arg, c) {
      const P = c.R.progression;
      return h`<div><div class="card-h"><p class="over">Seuils utilisés</p><span class="nowrap">${UI.prov('calc')} ${UI.conf(C.vault.conf)}</span></div>
        <dl class="kv"><dt>Donjons</dt><dd class="num">${C.vault.mplus.join(' / ')} clés</dd><dt>Raid</dt><dd class="num">${C.vault.raid.join(' / ')} boss</dd><dt>Monde</dt><dd class="num">${C.vault.world.join(' / ')} activités</dd></dl>
        <p class="t-cap muted">Règles TWW reconduites · à confirmer. Chaque case vaut la plus basse de tes N meilleures activités. Aucun ilvl de récompense n'est affiché dans les cases.</p></div>
        ${P.vaultRules.length ? h`<div><div class="card-h"><p class="over">Ce que dit la recherche</p>${UI.provResearch()}</div><ul class="list-dot">${P.vaultRules.map(x => h`<li>${x}</li>`)}</ul></div>` : ''}
        ${P.ilvlTable.length ? h`<details data-key="sem-ilvl"><summary class="t-call">Repères d'ilvl (recherche)</summary><ul class="rows">${P.ilvlTable.map(r => h`<li class="row"><span class="grow"><span class="ink">${U.str(r.source)}</span>${r.note ? h`<br><span class="t-cap ink2">${U.str(r.note)}</span>` : ''}</span><span class="num nowrap">${U.str(r.ilvl) || F.DASH} ${UI.conf(r.confidence)}</span></li>`)}</ul></details>` : ''}`;
    }
  });

  /* ---------- «Tes clés cette semaine» (live weekly runs + manual runs, dedup as in the engine) ---------- */
  const matched = (M, m) => (M.weekly || []).some(r => U.sameDungeon(r, m) && r.level === m.level && Date.parse(r.at) >= (isNum(m.addedAt) ? m.addedAt : 0) - 72e5);
  const manualOf = (M, W) => U.arr(W.manualRuns).filter(m => U.isObj(m) && isNum(m.level) && !matched(M, m));
  const runsCard = (E, c) => {
    const M = c.M, W = c.W, man = manualOf(M, W);
    const live = (M.weekly || []).slice().sort((a, b) => (b.level || 0) - (a.level || 0) || String(b.at).localeCompare(String(a.at)));
    const row = r => h`<li class="row sem-run"><span class="num sem-lv">+${isNum(r.level) ? r.level : '?'}</span><span class="grow"><span class="ink any">${r.dungeon || r.short || 'Donjon'}</span>${r.rd ? '' : h` <span class="t-cap muted">· correspondance incertaine</span>`}<br><span class="t-cap ink2">${r.timed === true ? 'dans les temps (' + F.margin(r.clear, r.par) + ')' : r.timed === false ? h`${icon('alert', 'i-sm')} hors temps (${F.margin(r.clear, r.par)})` : F.DASH} · ${F.ddmm(r.at)}</span></span></li>`;
    const mrow = m => h`<li class="row sem-run"><span class="num sem-lv">+${m.level}</span><span class="grow"><span class="ink any">${U.str(m.dungeon) || U.str(m.short) || 'Donjon'}</span><br><span class="t-cap ink2">${icon('hand', 'i-sm')} ajoutée à la main · ${F.ddmm(m.addedAt)}</span></span><button type="button" class="btn btn-ghost btn-sm" data-act="sem-rm" data-arg="${m.addedAt}" aria-label="Retirer cette clé">${icon('cross')}</button></li>`;
    let body;
    if (loading(M)) body = h`<div class="stack">${UI.skel(44)}${UI.skel(44)}${UI.skel(44)}</div>`;
    else if (M.weekly === undefined) body = h`<p class="t-call ink2">${UI.unknown('raider.io n\'a pas renvoyé les clés de la semaine')} Clés de la semaine indisponibles · Ajouter à la main</p>`;
    else if (!live.length && !man.length) body = UI.empty('Aucune clé cette semaine');
    return h`<div class="card" data-qa="runs"><div class="card-h"><h2 class="card-t">Tes clés cette semaine</h2>${M.weekly !== undefined ? UI.provM(M) : man.length ? UI.prov('declared') : ''}</div>
      ${body || ''}${live.length || man.length ? h`<ul class="rows">${live.map(row)}${man.map(mrow)}</ul>` : ''}
      ${E.vault.capped ? h`<p class="t-cap muted">raider.io plafonne cette liste : tu en as peut-être plus.</p>` : ''}
      <div class="btn-row sem-mt"><button type="button" class="btn" data-act="sem-open-add">${icon('pencil')}<span>Ajouter une clé</span></button></div>
      ${man.length ? h`<p class="t-cap muted">Une clé ajoutée à la main disparaît d'elle-même quand raider.io la voit.</p>` : ''}</div>`;
  };

  /* manual key form (dungeon from the pool, level stepper) */
  let form = null;
  const pool = () => { try { return EN().get().radar.pool; } catch (e) { return EN().dungeonPool(K.M); } };
  const lvDefault = () => {
    const s = K.store.get('ui.wkLv', null), E = EN().get(), cf = E.radar.comfort;
    return isNum(s) ? s : isNum(cf) ? Math.round(cf) : isNum(K.R.targets.vaultMplusLevel) ? K.R.targets.vaultMplusLevel : 10;
  };
  K.sheet.define('sem-add', {
    title: 'Ajouter une clé',
    qa: 'sem-add',
    render() {
      const ds = pool();
      if (!form) form = { i: 0, lv: lvDefault() };
      if (!ds.length) return UI.empty('Liste des donjons indisponible');
      if (form.i >= ds.length) form.i = 0;
      return h`<p class="t-call ink2">Pour une clé que raider.io ne voit pas encore. Elle compte dans le Grand Coffre (Déclaré).</p>
        <label class="field"><span>Donjon</span><select class="input" data-change="sem-dj" data-key="sem-dj">${ds.map((d, i) => h`<option value="${i}"${i === form.i ? raw(' selected') : ''}>${d.short ? d.short + ' · ' : ''}${d.name || F.DASH}</option>`)}</select></label>
        <div class="field"><span>Niveau</span>${UI.stepper('sem-lv', 'niveau de la clé', '+' + form.lv, { lo: form.lv <= 2, hi: form.lv >= 30 })}</div>
        <div class="btn-row"><button type="button" class="btn btn-primary" data-act="sem-add">${icon('check')}<span>Ajouter la clé</span></button></div>`;
    }
  });
  K.act('sem-open-add', el => { form = null; K.sheet.open('sem-add', null, el); });
  K.onChange('sem-dj', el => { if (form) form.i = U.clamp(parseInt(el.value, 10) || 0, 0, 99); });
  K.act('sem-lv', el => { if (!form) return; form.lv = U.clamp(form.lv + UI.stepDir(el), 2, 30); K.sheet.refresh(); });
  K.act('sem-add', () => {
    const d = pool()[form ? form.i : -1];
    if (!d || !form) { K.toast('Choisis un donjon'); return; }
    const W = K.store.week(), lv = form.lv;
    W.manualRuns.push({ dungeon: d.name || '', short: d.short || '', level: lv, addedAt: Date.now() });
    K.store.set('ui.wkLv', lv);
    form = null;
    K.sheet.close();
    saveW();
    K.toast('Clé +' + lv + ' ajoutée · Déclaré');
  });
  K.act('sem-rm', el => {
    const at = Number(el.getAttribute('data-arg')), W = K.store.week(), prev = W.manualRuns.slice();
    W.manualRuns = W.manualRuns.filter(m => !(U.isObj(m) && m.addedAt === at));
    saveW();
    K.toast('Clé retirée', { undo: () => { K.store.week().manualRuns = prev; saveW(); } });
  });

  /* ---------- Raid (declared): one chip per research boss, cycles — → N → HM → M → — ---------- */
  const bosses = R => R.raid.bosses.filter(b => isNum(b.order)).sort((a, b) => a.order - b.order);
  const raidCard = c => {
    const W = c.W, M = c.M, r = M.raid, bs = bosses(c.R), api = M.source === 'live' || M.source === 'cached';
    const mk = r && isNum(r.mythic_bosses_killed) && isNum(r.total_bosses) && r.mythic_bosses_killed > 0 ? ' · ' + r.mythic_bosses_killed + '/' + r.total_bosses + ' M' : '';
    const any = bs.some(b => RD[W.raid[b.order]]);
    return h`<div class="card" data-qa="raid-decl"><div class="card-h"><h2 class="card-t">Raid · boss de la semaine</h2>${UI.prov('declared')}</div>
      ${api ? (r && r.summary ? h`<p class="t-call sem-season">Saison : ${r.summary}${mk}${r.supposed ? ' · raid supposé' : ''} ${UI.provM(M)}</p>` : h`<p class="t-call ink2">${UI.unknown('raider.io n\'a pas renvoyé la progression raid')} Progression raid indisponible</p>`) : ''}
      <p class="t-cap muted">raider.io ne donne pas tes kills de la semaine : touche un boss pour le déclarer (— → N → HM → M).</p>
      ${bs.length ? h`<div class="sem-bosses">${bs.map(b => { const v = RD[W.raid[b.order]] ? W.raid[b.order] : ''; return h`<button type="button" class="sem-boss" data-act="sem-boss" data-arg="${b.order}" aria-pressed="${v ? 'true' : 'false'}"><span class="sem-bn">${b.name || 'Boss ' + b.order}</span><span class="sem-bv num">${v ? RD[v] : F.DASH}</span></button>`; })}</div>
        <div class="btn-row sem-mt"><button type="button" class="btn" data-act="sem-raid-hm">${icon('check')}<span>J'ai fait le raid HM complet</span></button>${any ? h`<button type="button" class="btn btn-ghost" data-act="sem-raid-clear">${icon('cross')}<span>Effacer</span></button>` : ''}<button type="button" class="btn btn-ghost" data-act="pv-open" data-arg="r">${icon('shield')}<span>Préparer le raid</span></button></div>` : UI.empty('Liste des boss indisponible')}</div>`;
  };
  K.act('sem-boss', el => {
    const o = String(Number(el.getAttribute('data-arg'))), W = K.store.week();
    const nx = CYCLE[RD[W.raid[o]] ? W.raid[o] : ''];
    if (nx) W.raid[o] = nx; else delete W.raid[o];
    saveW();
  });
  K.act('sem-raid-hm', () => { const W = K.store.week(); bosses(K.R).forEach(b => { W.raid[String(b.order)] = 'H'; }); saveW(); K.toast('Raid HM déclaré · ' + F.count(bosses(K.R).length, 'boss', 'boss')); });
  K.act('sem-raid-clear', () => {
    const W = K.store.week(), prev = Object.assign({}, W.raid);
    W.raid = {};
    saveW();
    K.toast('Kills de la semaine effacés', { undo: () => { K.store.week().raid = prev; saveW(); } });
  });

  /* ---------- Monde · gouffres (declared tiers 1–11) ---------- */
  const tierPick = () => { const v = K.store.get('ui.delveTier', 8); return isNum(v) ? U.clamp(v, 1, 11) : 8; };
  const worldCard = c => {
    const W = c.W, sel = tierPick(), list = U.arr(W.world).map((t, i) => [t, i]).filter(x => isNum(x[0]));
    return h`<div class="card" data-qa="world"><div class="card-h"><h2 class="card-t">Monde · gouffres</h2>${UI.prov('declared')}</div>
      <div class="sem-addrow"><label class="field"><span>Palier</span><select class="input" data-change="sem-tier" data-key="sem-tier">${Array.from({ length: 11 }, (_, i) => h`<option value="${i + 1}"${i + 1 === sel ? raw(' selected') : ''}>Palier ${i + 1}</option>`)}</select></label>
        <button type="button" class="btn" data-act="sem-delve">${icon('plus')}<span>Gouffre</span></button></div>
      ${list.length ? h`<div class="chips sem-mt">${list.map(x => h`<button type="button" class="chip chip-btn" data-act="sem-delve-rm" data-arg="${x[1]}" aria-label="${'Retirer palier ' + x[0]}"><span>Palier ${x[0]}</span>${icon('cross', 'i-sm')}</button>`)}</div>` : h`<p class="t-call ink2 sem-mt">Aucune activité déclarée cette semaine.</p>`}</div>`;
  };
  K.onChange('sem-tier', el => { const v = parseInt(el.value, 10); if (v >= 1 && v <= 11) K.store.set('ui.delveTier', v); });
  K.act('sem-delve', () => { const W = K.store.week(), t = tierPick(); W.world.push(t); saveW(); K.toast('Gouffre palier ' + t + ' déclaré'); });
  K.act('sem-delve-rm', el => {
    const i = Number(el.getAttribute('data-arg')), W = K.store.week(), prev = W.world.slice();
    if (!(i >= 0 && i < W.world.length)) return;
    W.world.splice(i, 1);
    saveW();
    K.toast('Activité retirée', { undo: () => { K.store.week().world = prev; saveW(); } });
  });

  /* ---------- P1-7 «Coffre de la semaine dernière» (72 h after the reset; «Récupéré» = W.vaultClaimed, declared) ---------- */
  const prevCard = (E, c) => {
    const pv = E.prevVault;
    if (!pv || !pv.inWindow) return '';
    return h`<div class="card" data-qa="vault-prev"><div class="card-h"><h2 class="card-t">Coffre de la semaine dernière</h2><span class="nowrap">${UI.provM(c.M)}${pv.raid || pv.world ? UI.prov('declared') : ''}</span></div>
      ${!pv.total ? h`<p class="t-call ink2">Rien à récupérer : aucune case ouverte la semaine dernière.</p>`
        : pv.claimed ? h`<p class="t-call">${icon('check', 'i-sm')} Récupéré · Déclaré</p><div class="btn-row sem-mt"><button type="button" class="btn btn-ghost" data-act="vault-unclaim">${icon('cross')}<span>Pas encore récupéré</span></button></div>`
          : h`<p class="t-call ink">À récupérer : ${K.nowUI.prevTxt(pv)}</p><p class="t-cap ink2">À ouvrir en jeu : raider.io ne voit pas la récupération. Rappel pendant 72 h après le reset (calcul KATA), encore ≈ ${F.countdown(pv.leftMs)}.</p>
            <div class="btn-row sem-mt"><button type="button" class="btn btn-primary" data-act="vault-claim">${icon('check')}<span>Récupéré</span></button></div>`}</div>`;
  };

  /* ---------- screen ---------- */
  K.screens.register('week', {
    render(c) {
      const E = EN().get(), M = c.M;
      const lk = (M.source === 'snapshot' || M.source === 'none') && K.research.isPlayer();
      const radar = K.weekUI && K.weekUI.radar ? SS('radar', () => K.weekUI.radar(E, c)) : '';
      return h`<div class="sem">
        <div class="sem-l">
          <div class="o-w1">${SS('reset', () => resetCard(c))}</div>
          <div class="o-w3">${SS('vault', () => vaultCard(E, c))}</div>
          <div class="o-w4">${radar}</div>
        </div>
        <div class="sem-r">
          <div class="o-w2">${SS('affixes', () => affixCard(c))}</div>
          <div class="o-w5">${SS('runs', () => runsCard(E, c))}</div>
          <div class="o-w6">${SS('raid', () => raidCard(c))}</div>
          <div class="o-w7">${SS('world', () => worldCard(c))}</div>
          ${lk ? h`<div class="o-w8">${UI.lastKnownCard()}</div>` : ''}
          <div class="o-w9">${SS('vault-prev', () => prevCard(E, c))}</div>
        </div>
      </div>`;
    }
  });

  /* countdown in place on the 30 s tick (no re-render) */
  K.on('tick', () => {
    const el = document.querySelector('[data-sem-cd]');
    if (el) el.textContent = F.countdown(K.time.info().left);
  });
  /* live: manual runs that raider.io now sees are removed (dedup rule of P0-8) */
  K.on('model', ev => {
    if (!ev || ev.source !== 'live' || !K.M.weekly) return;
    const W = K.store.week(), keep = U.arr(W.manualRuns).filter(m => !(U.isObj(m) && matched(K.M, m)));
    if (keep.length !== W.manualRuns.length) { W.manualRuns = keep; K.store.saveWeek(); }
  });
})(KATA);
