/* 45-now.js — «Maintenant» screen (spec §3.1 phone / §3.2 desktop) + «Pourquoi ?» and «Jauge» sheets +
   action verbs. Stage 2. Hooks: data-qa="meters" | "objective" | "budget" | "hero" | "plan" | "queue".
   Verbs: done · undone · snooze · pin · budget (30|60|120|0 = Soirée) · tier-set (slot:1|0|x).
   Sheets: 'why' (arg = action id) · 'meter' (arg = tier|vault|score|raid|optim).
   Reusable renderers on K.nowUI: row(a) · stateTag(a) · why(a, ctx) · pips(n, max, label) · tierRows(ctx) · tierLabel(p) ·
   tierHint(p, ctx) · tierBtns(p) · vaultRows(E). */
(function (K) {
  'use strict';
  const { h, icon, raw } = K;
  const F = K.fmt, U = K.util, UI = K.ui, C = K.CONFIG;
  const isNum = U.isNum;
  const EN = () => K.engine;
  const fm = m => K.engine.fmtMin(m);
  const SF = s => K.SLOT_FR[s] || s;
  const EFF = { faible: 1, moyen: 2, 'élevé': 3 };
  const TI = { vaultOpen: 'chest', missingEnchant: 'spark', missingGem: 'gem', slotIlvlBelow: 'helm', avgIlvlBelow: 'helm', weeklyRunsBelow: 'chest', vaultNext: 'chest',
    dungeonScoreGap: 'key', tierCountBelow: 'crown', raidNotCleared: 'skull', always: 'book' };
  const SHORT = { vaultOpen: 'Coffre', missingEnchant: 'Enchants', missingGem: 'Gemmes', slotIlvlBelow: 'Objets', avgIlvlBelow: 'iLvl', weeklyRunsBelow: 'Clés', vaultNext: 'Clé',
    dungeonScoreGap: 'Clé', tierCountBelow: 'Tier', raidNotCleared: 'Raid', always: 'Conseil' };

  /* P1-7 «À récupérer : Donjons 3/3 (+12, +12, +11) · Raid 1/3 (déclaré)» */
  const prevTxt = pv => [pv.n ? 'Donjons ' + (pv.capped ? '≥ ' : '') + pv.n + '/3 (' + pv.levels.map(l => '+' + l).join(', ') + ')' : 'Donjons : aucune case',
    pv.raid ? 'Raid ' + pv.raid + '/3 (déclaré)' : '', pv.world ? 'Monde ' + pv.world + '/3 (déclaré)' : ''].filter(Boolean).join(' · ');
  const doneLabel = a => (a.type === 'vaultOpen' ? 'Récupéré' : 'Fait');
  const pips = (n, max, label) => h`<span class="pips" role="img" aria-label="${label} ${n} sur ${max}">${Array.from({ length: max }, (_, i) => raw(i < n ? '<i class="on"></i>' : '<i></i>'))}</span>`;
  const provA = (a, M) => (a.system ? UI.prov('calc') : UI.provM(M));
  const snapLine = M => (M.source === 'snapshot' ? 'd\'après le snapshot du ' + F.ddmm(M.at) : null);

  /* one «pourquoi» line built from the evidence (FR literals + numbers + slot labels; API text only in text nodes) */
  const why = (a, c) => {
    const M = c.M, T = c.T, sl = xs => xs.map(SF).join(', ');
    if (!a.evaluable) return a.reason ? 'Non vérifiable : ' + a.reason : 'Non vérifiable';
    switch (a.type) {
      case 'missingEnchant': return a.hit ? F.count(a.magnitude, 'emplacement', 'emplacements') + ' sans enchant : ' + sl(a.evidence) + (a.loot ? '' : ' · gain immédiat, sans RNG') : 'Tous les emplacements visés sont enchantés';
      case 'missingGem': return a.hit ? F.count(a.magnitude, 'emplacement', 'emplacements') + ' sans gemme visible : ' + sl(a.evidence) + ' · si l\'objet a une châsse · à vérifier en jeu' : 'Gemmes vues sur les emplacements visés';
      case 'slotIlvlBelow': return F.count(a.evidence.length, 'emplacement', 'emplacements') + ' sous ' + a.th + (a.evidence.length ? ' : ' + a.evidence.map(s => SF(s) + ' ' + F.num(M.gear[s].ilvl)).join(', ') : '');
      case 'avgIlvlBelow': return 'iLvl ' + F.ilvl(M.ilvl) + ' pour ' + a.th + ' (' + F.signed(Math.round((M.ilvl - a.th) * 10) / 10, 1) + ')';
      case 'weeklyRunsBelow': return a.nAt + '/' + a.cnt + ' clés ≥ +' + a.min + ' cette semaine' + (a.runsToNext ? ' · ' + F.count(a.runsToNext, 'clé', 'clés') + ' de plus pour la case suivante' : '');
      case 'vaultOpen': return a.hit ? 'À récupérer : ' + prevTxt(a.pv) + ' · à ouvrir en jeu, raider.io ne le voit pas' : 'Coffre marqué récupéré (déclaré)';
      case 'vaultNext': return F.count(a.n, 'clé', 'clés') + ' cette semaine' + (a.hit ? ' · 1 de plus ouvre la ' + EN().ord(a.cell) + ' case' + (isNum(T.vaultMplusLevel) ? ' (≥ +' + T.vaultMplusLevel + ' pour qu\'elle soit au max)' : '') : '');
      case 'dungeonScoreGap': return F.count(a.magnitude, 'donjon', 'donjons') + (isNum(a.minScore) ? ' sous ' + a.minScore + ' points' : ' en retard') + (a.weak.length ? ' : ' + a.evText : '');
      case 'tierCountBelow': { const t = EN().get().tier; return a.needsConfirm ? t.count + '/' + a.need + ' confirmées · ' + F.count(t.unknown, 'pièce', 'pièces') + ' à vérifier' : t.count + '/' + a.need + ' · ' + F.count(a.magnitude, 'pièce manquante', 'pièces manquantes'); }
      case 'raidNotCleared': return a.killed + '/' + a.total + ' ' + EN().DIFF_FR[a.diff] + ' · encore ' + F.count(a.magnitude, 'boss', 'boss');
      default: return 'Conseil général de la recherche';
    }
  };

  const stateTag = a => (a.confirmed ? h`<span class="tag tag-ok">${icon('check', 'i-sm')}<span>Fait · détecté en direct le ${F.ddmm(a.confirmed)}</span></span>`
    : a.closed ? h`<span class="tag tag-ok">${icon('check', 'i-sm')}<span>Écart fermé le ${F.ddmm(a.closed)}</span></span>`
      : a.contradiction ? h`<span class="tag">${icon('alert', 'i-sm')}<span>Coché, mais raider.io voit encore : ${a.evText || 'l\'écart'} · la synchro peut prendre du temps</span></span>`
        : a.done ? h`<span class="tag">${icon('check', 'i-sm')}<span>Coché · à confirmer en direct</span></span>`
          : a.snoozed ? h`<span class="tag">${icon('clock', 'i-sm')}<span>Reporté jusqu'à ${F.dayLong(a.snoozed)}</span></span>` : '');

  const meta = a => (!a.evaluable ? h`<span>${a.reason || 'non vérifiable'}</span>`
    : h`<span>≈ ${fm(a.est)}${a.divisible ? ' par clé' : ''}</span>${a.system ? h`<span>· Calcul KATA</span>` : ''}${a.pinned ? h`<span>· ${icon('pin', 'i-sm')} ce soir</span>` : ''}${pips(a.pips, 5, 'Gain')}${UI.conf(a.conf)}`);
  const row = a => h`<li><button type="button" class="arow${a.conf === 'basse' || !a.evaluable ? ' is-basse' : ''}" data-act="sheet" data-sheet="why" data-arg="${a.id}">${icon(TI[a.type] || 'info')}<span class="arow-b"><span class="arow-t">${a.title}</span><span class="arow-m">${meta(a)}</span>${stateTag(a)}</span>${icon('chevron')}</button></li>`;

  /* ---------- meters (P0-5) ---------- */
  const cell = k => raw('<i class="c' + (k ? ' c-' + k : '') + '"></i>');
  const TICK = raw('<i class="tick" aria-hidden="true"></i>');
  const mq = raw('<span class="m-q" aria-hidden="true">?</span>');
  const mrow = (id, label, track, val) => h`<button type="button" class="mrow" data-act="sheet" data-sheet="meter" data-arg="${id}"><span class="m-l">${label}</span><span class="m-t">${track}</span><span class="m-v num">${val}</span></button>`;
  const tierCells = t => {
    const o = t.perSlot.slice().sort((a, b) => (b.isTier === true) - (a.isTier === true) || (a.isTier === false) - (b.isTier === false));
    const out = [];
    o.forEach((p, i) => { if (i === 4) out.push(TICK); out.push(cell(p.isTier === true ? 'on' : p.isTier === null ? 'unk' : '')); });
    if (o.length === 4) out.push(TICK);
    return h`<span class="cells">${out}</span>`;
  };
  const tierVal = (t, M) => (!M.gearPresent ? h`—${mq}` : t.text);
  const vcell = c => cell(c.state === 'open' ? (c.declared ? 'decl' : 'on') : c.state === 'unknown' ? 'unk' : '');
  const scoreInfo = c => {
    const sc = c.M.score;
    if (!isNum(sc)) return null;
    const ms = c.R.mplus.milestones.filter(m => isNum(m.rating)).sort((a, b) => a.rating - b.rating);
    const prev = ms.filter(m => m.rating <= sc).pop(), next = ms.find(m => m.rating > sc);
    const lo = prev ? prev.rating : Math.floor(sc / 500) * 500, hi = next ? next.rating : lo + 500;
    const cut = c.aux.cutoffs, p900 = cut && (cut.state === 'live' || cut.state === 'cached') && cut.data && cut.data.p900 ? cut.data.p900.value : null;
    return { sc, lo, hi, next, p: U.clamp((sc - lo) / (hi - lo), 0, 1) * 100, p900: isNum(p900) ? p900 : null };
  };
  const optimCells = c => {
    const M = c.M, g = s => M.gear[s];
    const es = K.expandSlots(c.R.enchants.map(e => e.slot)).filter(s => g(s) && g(s).present).map(s => ({ s, k: 'ench', st: g(s).ench.state }));
    const gs = U.arr(c.S.settings.socketSlots).filter(s => g(s) && g(s).present).map(s => ({ s, k: 'gem', st: g(s).gems.state }));
    return es.concat(gs);
  };
  const meters = (E, c) => {
    const M = c.M, t = E.tier, v = E.vault, r = M.raid, si = scoreInfo(c), oc = optimCells(c);
    const okN = oc.filter(x => x.st === 'ok').length, unk = oc.filter(x => x.st === 'inconnu' || x.st === 'vide?').length;
    const rOk = r && isNum(r.total_bosses) && isNum(r.mythic_bosses_killed) && r.total_bosses > 0 && r.total_bosses <= 20;
    const cf = si && si.next ? si.next.confidence : null;
    const bar = !si ? h`<span class="bar"></span>` : h`<span class="lab num">${F.int(si.lo)}</span><span class="bar"><i class="fill"${K.vars({ '--p': si.p.toFixed(1) + '%' })}></i><i class="gapo"${K.vars({ '--p': si.p.toFixed(1) + '%' })}></i>${si.next && cf !== 'basse' ? raw('<i class="tk tk-' + (cf === 'haute' ? 'h' : 'm') + '"></i>') : ''}${si.p900 !== null && si.p900 > si.lo && si.p900 < si.hi ? h`<i class="tk tk-top"${K.vars({ '--x': ((si.p900 - si.lo) / (si.hi - si.lo) * 100).toFixed(1) + '%' })}></i>` : ''}</span><span class="lab num">${si.next && cf === 'moyenne' ? '~' : ''}${F.int(si.hi)}</span>`;
    return h`<div class="card meters" data-qa="meters"><div class="card-h"><p class="over">Jauges</p>${UI.provM(M)}</div><div class="m-list">
      ${mrow('tier', 'Tier', tierCells(t), tierVal(t, M))}
      ${mrow('vault', 'Coffre', h`<span class="cells g3"><span class="grp">${v.mplus.map(vcell)}</span><span class="grp">${v.raid.map(vcell)}</span><span class="grp">${v.world.map(vcell)}</span></span>`, v.unknown ? h`—${mq}` : v.open + '/9')}
      ${mrow('score', 'Cote M+', bar, si ? h`${F.int(si.sc)}${si.next && cf === 'basse' ? mq : ''}` : h`—${mq}`)}
      ${mrow('raid', 'Raid Myth.', h`<span class="cells">${rOk ? Array.from({ length: r.total_bosses }, (_, i) => cell(i < r.mythic_bosses_killed ? 'on' : '')) : ''}</span>`, rOk ? r.mythic_bosses_killed + '/' + r.total_bosses + ' M' : h`—${mq}`)}
      ${mrow('optim', 'Optimisation', h`<span class="cells">${oc.map(x => cell(x.st === 'ok' ? 'on' : x.st === 'manquant' ? 'gap' : 'unk'))}</span>`, !oc.length ? h`—${mq}` : unk === oc.length ? '?' : okN + '/' + oc.length + (unk ? ' (' + unk + ' ?)' : ''))}
    </div></div>`;
  };

  /* ---------- objective strip (P0-4), budget (P0-6), hero (P0-3), plan strip ---------- */
  const objective = (E, c) => {
    const o = E.campaign, snap = c.M.source === 'snapshot';
    const target = o.sheet ? raw(' data-act="sheet" data-sheet="meter" data-arg="' + o.sheet + '"') : raw(' data-go="' + (o.go || 'analyse') + '"');
    const chip = o.builtin ? UI.prov('calc') : snap ? UI.prov('snapshot', F.ddmm(c.M.at)) : o.met ? '' : UI.provM(c.M);
    return h`<button type="button" class="obj" data-qa="objective"${target}>${icon('crown', 'i-lg')}<span class="obj-b"><span class="obj-o"><span class="over">Objectif de saison</span>${chip}</span>
      <span class="obj-l">${o.met ? h`${o.title} · ${o.next}` : h`${o.title} · ${o.progress}`}</span>
      ${o.met ? '' : h`<span class="obj-n">→ ${o.sameAsHero ? 'c\'est ta prochaine action ↓' : o.next}</span>`}</span>${icon('chevron')}</button>`;
  };
  const budget = (E, c) => {
    const S = c.S, P = [[30, '30 min'], [60, '1 h'], [120, '2 h'], [0, E.raidNight ? 'Avant le raid' : 'Soirée']];
    return h`<div class="budget" role="group" aria-label="Budget de temps" data-qa="budget">${P.map(p => h`<button type="button" data-act="budget" data-arg="${p[0]}" aria-pressed="${S.budget === p[0] || (p[0] === 0 && !(S.budget > 0)) ? 'true' : 'false'}">${p[1]}</button>`)}</div>`;
  };
  const tiles = E => {
    const t = E.radar.pool.filter(d => isNum(d.gain)).sort((a, b) => b.gain - a.gain).slice(0, 2);
    return t.length ? h`<div class="tiles2">${t.map(d => h`<button type="button" class="tile2" data-go="week"><span class="t-cap ink2">${d.short || ''}</span><span class="t-call ell">${d.name}</span><span class="t-cap">${d.best ? '+' + d.target : 'Pas encore fait'} · ≈ +${F.int(d.gain)} (±${F.int(E.radar.fit.sigma)})</span></button>`)}</div>` : '';
  };
  const hero = (E, c) => {
    const a = E.hero, M = c.M;
    if (!a) {
      if (M.source === 'none' && !E.queue.some(x => x.evaluable && x.rule) && (K.net.profile.state === 'loading' || K.net.profile.state === 'retrying')) {
        return h`<div class="card e2 hero hero-sk" data-qa="hero" aria-busy="true">${UI.skel(16, '55%')}${UI.skel(48)}${UI.skel(40)}${UI.skel(44)}</div>`;
      }
      return h`<div class="card e2 hero" data-qa="hero"><p class="over">Prochaine action</p><p class="t-h2">Rien d'urgent. Pousse ta cote ou prépare ton raid.</p>${tiles(E)}</div>`;
    }
    const sn = snapLine(M), est = fm(a.est) + (a.divisible ? ' par clé' : '');
    return h`<article class="card e2 hero" data-qa="hero" aria-labelledby="hero-t">
      <p class="hero-o"><span class="over">Prochaine action</span>${sn ? h`<span class="t-cap ink2">· ${sn}</span>` : h`<span class="t-cap ink2">· ≈ ${est}</span>${provA(a, M)}`}</p>
      <h2 class="hero-t" id="hero-t">${a.title}</h2>
      <p class="hero-w">${why(a, c)}</p>
      <div class="hero-m"><span>Gain ${pips(a.pips, 5, 'Gain')}</span><span>Effort ${pips(EFF[a.effort] || 2, 3, 'Effort')}${sn ? ' · ≈ ' + est : ''}</span><span>Confiance ${UI.conf(a.conf)}</span>${a.system && sn ? UI.prov('calc') : ''}${E.heroOverflow ? h`<span class="ink2">· plus longue que ton budget</span>` : ''}</div>
      <div class="hero-b">
        <button type="button" class="btn btn-primary" data-act="done" data-arg="${a.id}">${icon('check')}<span>${doneLabel(a)}</span></button>
        <button type="button" class="btn" data-act="snooze" data-arg="${a.id}">${icon('clock')}<span>Plus tard</span></button>
        <button type="button" class="btn" data-act="sheet" data-sheet="why" data-arg="${a.id}"><span>Pourquoi ?</span></button>
      </div>
      ${E.footnote ? h`<p class="card-foot">La plus importante (≈ ${fm(E.footnote.est)}) attend ta soirée : ${E.footnote.title}</p>` : ''}
    </article>`;
  };
  const segLabel = (i, T) => {
    const t = i.a.type, lv = isNum(T.vaultMplusLevel) ? ' +' + T.vaultMplusLevel : '';
    const base = t === 'weeklyRunsBelow' ? (i.units > 1 ? i.units + ' clés' : 'Clé') + lv : t === 'vaultNext' ? 'Clé' + lv : SHORT[t] || 'Action';
    return base + ' ' + Math.round(i.est);
  };
  /* P1-9 «Vérifier en direct» (one refetch past the 60 s throttle) + «Copier le plan» (plain text for Discord) */
  const planBtns = empty => h`<div class="btn-row plan-b"><button type="button" class="btn btn-ghost btn-sm" data-act="verify" data-qa="verify">${icon('refresh', 'i-sm')}<span>Vérifier en direct</span></button>${empty ? '' : h`<button type="button" class="btn btn-ghost btn-sm" data-act="plan-copy" data-qa="plan-copy">${icon('copy', 'i-sm')}<span>Copier le plan</span></button>`}</div>`;
  const planText = (E, c) => {
    const P = E.plan, out = ['KATA · plan de ce soir (' + E.budgetLabel + ') · ' + F.ddmm(c.now)];
    P.items.forEach((i, k) => out.push((k + 1) + '. ' + i.a.title + (i.units > 1 ? ' ×' + i.units : '') + ' · ≈ ' + fm(i.est) + (i.a.pinned ? ' (épinglé)' : '')));
    out.push('Total ≈ ' + fm(P.used) + (P.over ? ' · dépasse de ≈ ' + fm(P.over) : ''));
    if (c.M.source === 'snapshot') out.push('D\'après le snapshot du ' + F.ddmm(c.M.at));
    return out.join('\n');
  };
  const plan = (E, c) => {
    const P = E.plan, n = P.items.length, scale = Math.max(P.budget, P.used) || 1, sn = snapLine(c.M);
    if (!n) return h`<div class="card plan" data-qa="plan"><p class="t-call ink2">Rien à planifier dans ce budget</p>${sn ? h`<p class="t-cap muted">Plan basé sur le snapshot du ${F.ddmm(c.M.at)}</p>` : ''}${planBtns(true)}</div>`;
    const aria = 'Plan ' + E.budgetLabel + ' : ' + n + (n > 1 ? ' actions' : ' action') + ', environ ' + Math.round(P.used) + ' minutes';
    const wide = i => i.est / scale >= 0.26, legend = P.items.map((i, k) => (wide(i) ? null : (k + 1) + ' ' + segLabel(i, c.T))).filter(Boolean);
    return h`<div class="card plan" data-qa="plan"><div class="pbar" role="img" aria-label="${aria}">${P.items.map((i, k) => h`<span class="pseg"${K.vars({ '--w': (i.est / scale * 100).toFixed(2) + '%' })}>${wide(i) ? segLabel(i, c.T) : k + 1}</span>`)}${P.over ? h`<i class="pbud"${K.vars({ '--x': (P.budget / scale * 100).toFixed(2) + '%' })}></i>` : ''}</div>
      ${legend.length ? h`<p class="t-cap ink2 plan-c">${legend.join(' · ')}</p>` : ''}
      <p class="t-cap ink2 plan-c">Plan ${E.budgetLabel} : ${F.count(n, 'action', 'actions')} · ≈ ${Math.round(P.used)} min${P.over ? ' · dépasse de ≈ ' + Math.round(P.over) + ' min' : ''}${P.keys ? ' · ' + F.count(P.keys, 'clé', 'clés') + ' (≈ ' + E.unitMin + ' min' + (P.keys > 1 ? ' chacune)' : ')') : ''}</p>
      ${sn ? h`<p class="t-cap muted">Plan basé sur le snapshot du ${F.ddmm(c.M.at)}</p>` : ''}${planBtns()}</div>`;
  };
  const queue = E => {
    const blocks = E.GROUPS.filter(g => g[0] !== 'done').map(g => {
      const list = E.groups[g[0]].filter(a => a !== E.hero);
      if (!list.length) return '';
      const body = h`<ul class="rows">${list.map(row)}</ul>`;
      return g[0] === 'general'
        ? h`<details class="qg" data-key="qg-general"><summary><span class="over">${g[1]} (${list.length})</span>${icon('chevron', 'i-sm')}</summary>${body}</details>`
        : h`<section class="qg"><h3 class="over">${g[1]} (${list.length})</h3>${body}</section>`;
    });
    return h`<div class="card queue" data-qa="queue"><p class="t-h2">Ensuite</p>${blocks.some(b => b !== '') ? blocks : UI.empty('Rien d\'autre en attente')}</div>`;
  };
  const doneCard = E => (E.groups.done.length ? h`<div class="card"><h3 class="over">Fait · détecté en direct (${E.groups.done.length})</h3><ul class="rows">${E.groups.done.map(row)}</ul></div>` : '');

  /* ---------- desktop right column extras: vault mini-grid + pacing, affixes ---------- */
  const RD = { N: 'N', H: 'HM', M: 'M' };
  const vaultRows = (E, c) => {
    const v = E.vault, max = v.max;
    const txt = (c0, kind) => (c0.state === 'unknown' ? F.DASH : c0.state === 'locked' ? 'encore ' + (kind === 'm' ? F.count(c0.need, 'clé', 'clés') : kind === 'r' ? c0.need + ' boss' : c0.need)
      : kind === 'm' ? '+' + c0.item.level + (c0.maxed === true ? ' · max' : c0.maxed === false ? ' · sous le max' : '') : kind === 'r' ? RD[c0.item.d] : 'Palier ' + c0.item.tier);
    const line = (label, ic, cells, kind, prov) => h`<div class="vrow"><span class="vl">${icon(ic, 'i-sm')}<span>${label}</span>${prov}</span>${cells.map(x => h`<span class="vc vc-${x.state}${x.declared ? ' vc-decl' : ''}">${txt(x, kind)}</span>`)}</div>`;
    return h`${line('Donjons', 'key', v.mplus, 'm', v.unknown ? '' : UI.provM(c.M))}${line('Raid', 'skull', v.raid, 'r', UI.prov('declared'))}${line('Monde', 'lantern', v.world, 'w', UI.prov('declared'))}
      ${v.unknown ? h`<p class="t-cap ink2">Donjons : — indisponible · Ajouter à la main</p>` : ''}
      ${!v.unknown && isNum(max) ? h`<p class="t-cap muted">Case «&nbsp;max&nbsp;» : clé ≥ +${max} (recherche, une seule source)</p>` : ''}`;
  };
  const vaultMini = (E, c) => {
    const v = E.vault, ev = EN().eveningsLeft(c.time);
    const pace = v.unknown ? '' : v.runsTo8 === 0 ? 'Coffre M+ complet cette semaine' : ev > 0 ? '≈ ' + Math.ceil(v.runsTo8 / ev) + ' clés/soir pour 8/8 (' + F.count(ev, 'soir', 'soirs') + ' avant le reset)' : 'Dernier soir avant le reset passé';
    return h`<div class="card"><div class="card-h"><h3 class="card-t">Grand Coffre · ${v.unknown ? F.DASH : v.open}/9</h3><button type="button" class="btn btn-ghost btn-sm" data-go="week"><span>Semaine</span>${icon('chevron', 'i-sm')}</button></div>
      <div class="vgrid">${vaultRows(E, c)}</div>${pace ? h`<p class="t-call ink2 vpace">${pace}</p>` : ''}</div>`;
  };
  const affixes = c => {
    const a = c.aux.affixes, list = a.data && a.data.list && a.data.list.length ? a.data.list : null, rs = c.R.mplus.affixes && c.R.mplus.affixes.thisWeek;
    return h`<div class="card"><div class="card-h"><h3 class="card-t">Affixes</h3>${list ? UI.prov(a.state === 'cached' ? 'cached' : 'live', a.state === 'cached' ? F.rel(a.at) : F.hhmm(a.at)) : typeof rs === 'string' && rs ? UI.provResearch() : ''}</div>
      ${list ? h`<div class="chips">${list.map(x => h`<span class="chip">${x.name}</span>`)}</div>` : typeof rs === 'string' && rs ? h`<p class="t-call">${rs}</p>` : UI.empty('Affixes indisponibles')}</div>`;
  };

  /* ---------- screen ---------- */
  const S_ = (id, fn) => UI.safeSection('now:' + id, fn);
  K.screens.register('now', {
    render(c) {
      const E = K.engine.get(), M = c.M;
      const lk = (M.source === 'snapshot' || M.source === 'none' || K.net.profile.state === 'fail') && K.research.isPlayer();
      return h`<div class="now">
        <div class="now-l">
          <div class="o-obj">${S_('objective', () => objective(E, c))}</div>
          <div class="o-budget">${S_('budget', () => budget(E, c))}</div>
          <div class="o-hero">${S_('hero', () => hero(E, c))}</div>
          <div class="o-plan">${S_('plan', () => plan(E, c))}</div>
          <div class="o-queue">${S_('queue', () => queue(E))}</div>
        </div>
        <div class="now-r">
          <div class="o-meters">${S_('meters', () => meters(E, c))}</div>
          <div class="o-desk">${S_('vault', () => vaultMini(E, c))}${S_('affixes', () => affixes(c))}</div>
          ${lk ? h`<div class="o-lk">${UI.lastKnownCard()}</div>` : ''}
          <div class="o-pv">${K.preflight ? S_('preflight', () => K.preflight.button()) : ''}</div>
          <div class="o-diff">${S_('diff', () => (K.visit ? K.visit.card(E, c) : ''))}</div>
          <div class="o-done">${S_('done', () => doneCard(E))}</div>
        </div>
      </div>`;
    }
  });

  /* ---------- «Pourquoi ?» sheet (P0-3) ---------- */
  const find = id => { try { return K.engine.get().byId[id] || null; } catch (e) { return null; } };
  const kv = rows => h`<dl class="kv kv-why">${rows.filter(Boolean).map(r => h`<dt>${r[0]}</dt><dd>${r[1]}</dd>`)}</dl>`;
  const srcLinks = ids => { const s = K.research.src(ids); return s.length ? h`<span class="srcs">${s.map(x => (x.url ? h`<a class="inline" href="${x.url}" target="_blank" rel="noopener noreferrer">${x.label}</a>` : h`<span>${x.label}</span>`))}</span>` : ''; };
  const seen = (a, c) => {
    const M = c.M, g = s => M.gear[s];
    const item = (s, tail) => h`<li><span class="ink">${SF(s)}</span> · ${g(s).present ? h`<span class="any">${g(s).name || F.DASH}</span> · ${F.num(g(s).ilvl)}` : 'Non renvoyé par raider.io'}${tail ? h` · ${tail}` : ''}</li>`;
    const EN_ = { ok: 'enchanté', manquant: 'aucun enchant', inconnu: '?' }, GE = { ok: 'gemme sertie', 'vide?': 'châsse ? à vérifier', inconnu: '?' };
    if (!a.evaluable) return h`<p class="t-call">${UI.unknown(a.reason)} Non vérifiable : ${a.reason || 'donnée absente'}</p>`;
    switch (a.type) {
      case 'missingEnchant': return h`<ul class="list-dot">${a.seen.map(z => item(z[0], h`${EN_[z[1]]}${g(z[0]).ench.names.length ? h` (${g(z[0]).ench.names.join(', ')})` : z[1] === 'ok' ? ' (présent, nom non fourni par raider.io)' : ''}`))}</ul>`;
      case 'missingGem': return h`<ul class="list-dot">${a.seen.map(z => item(z[0], GE[z[1]]))}</ul><p class="t-cap muted">raider.io ne donne pas le nombre de châsses : vérifie en jeu.</p>`;
      case 'slotIlvlBelow': return a.evidence.length ? h`<ul class="list-dot">${a.evidence.map(s => item(s, 'sous ' + a.th))}</ul>` : h`<p class="t-call">Aucun emplacement sous ${a.th}.</p>`;
      case 'avgIlvlBelow': return h`<p class="t-call">iLvl équipé ${F.ilvl(M.ilvl)} (${M.ilvlSource || F.DASH}) · repère ${a.th}</p>`;
      case 'vaultOpen': return h`<p class="t-call">${prevTxt(a.pv)}</p><p class="t-cap ink2">Donjons : clés de la semaine dernière vues par raider.io · Raid et Monde : ce que tu avais déclaré. Fenêtre de 72 h après le reset (calcul KATA), encore ≈ ${F.countdown(a.pv.leftMs)}.</p>`;
      case 'weeklyRunsBelow': case 'vaultNext': {
        const runs = EN().allWeeklyRuns(M, c.W);
        return runs.length ? h`<ul class="list-dot">${runs.map(r => h`<li><span class="num">+${r.level}</span> · <span class="any">${r.dungeon || r.short || 'Donjon'}</span> · ${r.manual ? 'ajoutée à la main' : r.timed === true ? 'dans les temps' : r.timed === false ? 'hors temps' : F.DASH}</li>`)}</ul>` : h`<p class="t-call">Aucune clé cette semaine.</p>`;
      }
      case 'dungeonScoreGap': return h`<ul class="list-dot">${a.weak.map(d => h`<li><span class="ink">${d.short || ''}</span> <span class="any">${d.name}</span> · ${d.best ? h`+${d.best.level} · ${F.int(d.best.score)} points${d.best.timed === false ? ' · hors temps' : ''}` : 'Pas encore fait'}</li>`)}</ul>`;
      case 'tierCountBelow': return tierRows(c);
      case 'raidNotCleared': return h`<p class="t-call">${M.raid && M.raid.summary ? h`Saison : ${M.raid.summary} · ` : ''}${a.killed}/${a.total} ${EN().DIFF_FR[a.diff]}${M.raid && M.raid.supposed ? ' · raid supposé' : ''}</p>`;
      default: return h`<p class="t-call ink2">Rien à mesurer : conseil général.</p>`;
    }
  };
  const research = (a, c) => {
    const R = c.R, T = c.T;
    if (a.system) return h`<p class="t-call">Seuils du Grand Coffre : ${C.vault.mplus.join(', ')} clés ${UI.conf(C.vault.conf)} (règles TWW reconduites · à confirmer).</p>`;
    switch (a.type) {
      case 'missingEnchant': {
        const rs = U.uniq((a.rule && U.arr(a.rule.when.params.slots).length ? a.rule.when.params.slots : R.enchants.map(e => e.slot)));
        const es = rs.map(s => R.enchants.find(e => e.slot === s)).filter(Boolean);
        return h`<ul class="list-dot">${es.map(e => h`<li><span class="ink">${SF(e.slot)}</span> · ${e.name || F.DASH} ${K.pv.conf(e.confidence, e.sources)}${e.alt ? h`<br><span class="lead">${e.alt}</span>` : ''}</li>`)}</ul>${srcLinks(U.uniq(es.reduce((o, e) => o.concat(U.arr(e.sources)), [])))}`;
      }
      case 'missingGem': return h`<ul class="list-dot">${R.gems.map(g => h`<li><span class="ink">${g.name}</span> ${K.pv.conf(g.confidence, g.sources)}${g.role ? h`<br><span class="lead">${g.role}</span>` : ''}</li>`)}</ul>`;
      case 'tierCountBelow': return h`<p class="t-call">${R.tierSet.name || 'Set de tier'} ${K.pv.conf(R.tierSet.nameConfidence, R.tierSet.sources)}</p><details data-key="why-tier"><summary class="t-call">Obtention et Catalyseur</summary><ul class="list-dot">${R.tierSet.acquisition.concat(R.tierSet.catalyst).map(x => h`<li>${x}</li>`)}</ul></details>`;
      case 'raidNotCleared': return h`<p class="t-call">${R.raid.name || 'Raid'} · ${R.raid.bosses.length} boss (ordre de la recherche, supposé)</p>${R.raid.mythicAdvice.length ? h`<ul class="list-dot">${R.raid.mythicAdvice.slice(0, 3).map(x => h`<li>${x}</li>`)}</ul>` : ''}`;
      case 'weeklyRunsBelow': case 'dungeonScoreGap': return h`<ul class="list-dot">${U.arr(R.mplus.keyTargets).filter(U.isObj).map(k => h`<li><span class="ink">${U.str(k.goal)}</span>${k.level ? h` · ${U.str(k.level)}` : ''}${k.why ? h`<br><span class="t-cap ink2">${U.str(k.why)}</span>` : ''}</li>`)}</ul>`;
      case 'slotIlvlBelow': case 'avgIlvlBelow': return T.note ? h`<p class="t-call ink2">${U.str(T.note)}</p>` : '';
      default: return '';
    }
  };
  const weakLink = a => (a.conf === 'haute' ? 'aucun maillon faible'
    : a.type === 'missingEnchant' ? 'l\'enchant conseillé est en confiance ' + a.conf
      : a.type === 'missingGem' ? 'raider.io ne donne pas le nombre de châsses'
        : a.type === 'weeklyRunsBelow' || a.type === 'vaultNext' || a.type === 'vaultOpen' ? 'seuils du Coffre en confiance ' + C.vault.conf
          : a.type === 'tierCountBelow' && a.needsConfirm ? 'pièces de tier non confirmées'
            : K.M.source !== 'live' ? 'données hors direct' : 'repère de la recherche en confiance ' + a.conf);
  const dataLine = M => (M.source === 'live' ? 'mesuré en direct à ' + F.hhmm(M.at) : M.source === 'cached' ? 'cache du ' + F.ddmm(M.at) + ' à ' + F.hhmm(M.at)
    : M.source === 'snapshot' ? 'snapshot du ' + F.ddmm(M.at) : 'aucune donnée');
  K.sheet.define('why', {
    title: id => { const a = find(id); return a ? a.title : 'Pourquoi ?'; },
    qa: 'why',
    render(id, c) {
      const a = find(id);
      if (!a) return UI.empty('Cette action n\'est plus dans la file.');
      const E = K.engine.get(), open = a.evaluable && a.hit;
      const pr = isNum(a.priority) ? 'n°' + a.priority + ' sur 5' : F.DASH;
      return h`
        ${stateTag(a)}
        <div><div class="card-h"><p class="over">Ce qu'on voit</p>${a.system ? UI.prov('calc') : UI.provM(c.M)}</div>${seen(a, c)}<p class="t-call ink2 why-l">${why(a, c)}</p></div>
        ${a.rule || a.system ? h`<div><div class="card-h"><p class="over">${a.system ? 'Règle utilisée' : 'Ce que recommande la recherche'}</p>${a.system ? UI.prov('calc') : UI.provResearch()}</div>${research(a, c) || h`<p class="t-call ink2">Voir le détail ci-dessous.</p>`}${a.rule ? srcLinks(a.rule.sources) : ''}</div>` : ''}
        <div><p class="over">Pourquoi ce rang ?</p>${kv([
          ['Priorité recherche', a.system ? 'calcul KATA' : pr],
          a.evaluable ? ['Gain', pips(a.pips, 5, 'Gain')] : null,
          ['Effort', (a.effort || F.DASH) + ' · ≈ ' + fm(a.est) + (a.divisible ? ' par clé' : '') + ' (estimation)'],
          ['Confiance', a.conf ? h`${a.rule ? K.pv.conf(a.conf, a.rule.sources) : UI.conf(a.conf)} ${weakLink(a)}` : 'non évaluable'],
          ['Reset', a.weekly ? (a.type === 'raidNotCleared' ? 'hebdomadaire' : a.type === 'vaultOpen' ? 'à récupérer après le reset' : 'compte pour le Coffre') + ' · reset dans ' + F.countdown(c.time.left) + ' → remonté' : 'non hebdomadaire'],
          ['Dépend du loot', a.loot ? 'oui → rétrogradé' : 'non'],
          ['Données', dataLine(c.M)],
          a === E.hero ? ['Place', 'prochaine action'] : a.group ? ['Groupe', (E.GROUPS.find(g => g[0] === a.group) || [])[1]] : null
        ])}</div>
        ${a.detail ? h`<div><div class="card-h"><p class="over">Détail</p>${UI.provResearch()}</div><p class="t-call any">${a.detail}</p></div>` : ''}
        ${a.disputed ? h`<p class="callout">${icon('split', 'i-sm')} Débat ouvert dans la recherche : pas de recommandation.</p>` : h`<div class="btn-row">
          ${open && !a.done ? h`<button type="button" class="btn btn-primary" data-act="done" data-arg="${a.id}">${icon('check')}<span>${doneLabel(a)}</span></button>` : ''}
          ${a.done && !a.confirmed ? h`<button type="button" class="btn" data-act="undone" data-arg="${a.id}">${icon('cross')}<span>Annuler la coche</span></button>` : ''}
          ${open && !a.done && !a.snoozed ? h`<button type="button" class="btn" data-act="snooze" data-arg="${a.id}">${icon('clock')}<span>Plus tard</span></button>` : ''}
          ${!a.confirmed && !a.closed && (open || !a.evaluable) ? h`<button type="button" class="btn" data-act="pin" data-arg="${a.id}">${icon('pin')}<span>${a.pinned ? 'Retirer de ce soir' : '→ Ajouter à ce soir'}</span></button>` : ''}
        </div>`}
        <p><button type="button" class="btn btn-ghost" data-go="analyse"><span>Voir dans l'Analyse</span>${icon('chevron', 'i-sm')}</button></p>`;
    }
  });

  /* ---------- «Jauge» sheet ---------- */
  const PV = { live: 'détecté en direct', manuel: 'confirmé à la main', set: 'n° d\'objet du set (recherche)', 'supposé': 'supposé (nom de l\'objet)', inconnu: '?' };
  /* shared tier UI (meter sheet, Stuff tier card, slot sheet) */
  const tierLabel = p => (p.absent ? 'Non renvoyé par raider.io' : p.isTier === true ? 'tier · ' + PV[p.prov] : p.isTier === false ? 'pas tier · ' + PV[p.prov]
    : p.changed ? 'à confirmer · L\'objet a changé : confirme à nouveau' : p.prov === 'supposé' ? PV['supposé'] + ' · à confirmer' : 'à confirmer');
  const tierHint = (p, c) => {
    const r = EN().tierIds(c.R)[p.slot];
    return r && p.g && p.g.id != null && p.isTier === null && p.g.id !== r.id
      ? h`<p class="t-cap ink2">${icon('book', 'i-sm')} N° d'objet ≠ pièce du set (${r.id}, recherche) : sans doute pas du tier.</p>` : '';
  };
  const tierBtns = p => (p.g && p.g.id != null ? h`<span class="btn-row trow-b"><button type="button" class="btn btn-sm" data-act="tier-set" data-arg="${p.slot + ':1'}" aria-pressed="${p.prov === 'manuel' && p.isTier ? 'true' : 'false'}">Oui, c'est du tier</button><button type="button" class="btn btn-sm" data-act="tier-set" data-arg="${p.slot + ':0'}" aria-pressed="${p.prov === 'manuel' && p.isTier === false ? 'true' : 'false'}">Non</button></span>` : '');
  const tierRows = c => {
    const t = EN().tierState(c.M, c.S);
    return h`<ul class="rows">${t.perSlot.map(p => h`<li class="row trow"><span class="grow"><span class="ink">${SF(p.slot)}</span> · ${p.g ? h`<span class="any">${p.g.name || F.DASH}</span> · <span class="num">${F.num(p.g.ilvl)}</span>` : 'Non renvoyé par raider.io'}<br><span class="t-cap ink2">${tierLabel(p)}</span>${tierHint(p, c)}</span>${tierBtns(p)}</li>`)}</ul>`;
  };
  const MT = { tier: 'Tier', vault: 'Grand Coffre', score: 'Cote M+', raid: 'Raid Mythique', optim: 'Optimisation' };
  K.sheet.define('meter', {
    title: id => 'Jauge · ' + (MT[id] || ''),
    qa: 'meter',
    render(id, c) { return h`${meterBody(id, c)}${K.visit ? UI.safeSection('meter-spark', () => K.visit.spark(id, c)) : ''}`; }
  });
  const meterBody = (id, c) => {
      const E = K.engine.get(), M = c.M, R = c.R, T = c.T;
      const head = h`<div class="card-h"><p class="over">${MT[id] || ''}</p>${UI.provM(M)}</div>`;
      if (id === 'tier') {
        const t = E.tier, o = E.campaign;
        return h`${head}<p class="t-h2 num">${tierVal(t, M)}</p><p class="t-call ink2">Le bonus 4 pièces est une règle du jeu : la cible est tracée en trait plein. Seules les pièces détectées par raider.io ou confirmées ici comptent.</p>
          ${o.type === 'tierCountBelow' && !o.met ? h`<p class="callout">→ ${o.next}</p>` : ''}${tierRows(c)}
          <p class="t-cap muted">${R.tierSet.name ? h`Set : ${R.tierSet.name} ` : ''}${K.pv.conf(R.tierSet.nameConfidence, R.tierSet.sources)} · emplacements : ${t.slots.map(SF).join(', ')}</p>
          <button type="button" class="btn" data-go="gear"><span>Catalyseur et sources dans Stuff</span>${icon('chevron', 'i-sm')}</button>`;
      }
      if (id === 'vault') {
        const v = E.vault;
        return h`${head}<p class="t-h2 num">${v.unknown ? F.DASH : v.open + '/9'}</p><div class="vgrid">${vaultRows(E, c)}</div>
          <p class="t-cap ink2">Seuils : donjons ${C.vault.mplus.join('/')}, raid ${C.vault.raid.join('/')}, monde ${C.vault.world.join('/')} ${UI.conf(C.vault.conf)} · règles TWW reconduites · à confirmer. Aucun ilvl de récompense n'est affiché.</p>
          ${v.capped ? h`<p class="t-cap muted">Liste raider.io plafonnée : au moins ${v.n} clés.</p>` : ''}<button type="button" class="btn" data-go="week"><span>Ouvrir Semaine</span>${icon('chevron', 'i-sm')}</button>`;
      }
      if (id === 'score') {
        const si = scoreInfo(c), cut = c.aux.cutoffs, cs = K.cutoffStrip ? UI.safeSection('cutoffs', () => K.cutoffStrip(c)) : '';
        return h`${head}<p class="t-h2 num">${si ? F.int(si.sc) : UI.unknown('Cote non renvoyée par raider.io')}</p>
          ${si ? h`<p class="t-call ink2">Échelle ${F.int(si.lo)} → ${F.int(si.hi)} (la barre ne part pas de zéro).</p>` : ''}
          <div class="card-h"><p class="over">Paliers (recherche)</p>${UI.provResearch()}</div>
          <ul class="list-dot">${R.mplus.milestones.filter(m => isNum(m.rating)).map(m => h`<li><span class="num">${m.confidence === 'moyenne' ? '~' : ''}${F.int(m.rating)}</span> · ${m.name || ''} ${K.pv.conf(m.confidence, m.sources)}${si && m.rating > si.sc ? h` · encore ${F.int(m.rating - si.sc)}` : ''}</li>`)}</ul>
          ${String(cs) ? cs : (cut && cut.data && cut.data.p900 ? h`<p class="t-call">Top 10 % EU : ${F.int(cut.data.p900.value)} (seuils raider.io, toutes classes)</p>` : h`<p class="t-cap muted">Seuils du top EU indisponibles.</p>`)}`;
      }
      if (id === 'raid') {
        const r = M.raid, bs = R.raid.bosses.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        const ok = r && isNum(r.mythic_bosses_killed) && isNum(r.total_bosses);
        return h`${head}<p class="t-h2 num">${ok ? r.mythic_bosses_killed + '/' + r.total_bosses + ' M' : UI.unknown('Progression raid indisponible')}</p>
          ${r && r.summary ? h`<p class="t-call">Saison : ${r.summary}${r.supposed ? ' · raid supposé' : ''}</p>` : ''}
          ${ok && bs[r.mythic_bosses_killed] ? h`<p class="callout">→ Prochain boss Mythique : ${bs[r.mythic_bosses_killed].name} (ordre supposé)</p>` : ''}
          ${M.source !== 'live' && M.source !== 'cached' && K.research.isPlayer() ? UI.lastKnownCard() : ''}`;
      }
      const oc = optimCells(c), ST = { ok: 'ok', manquant: 'manquant', 'vide?': 'châsse ? à vérifier', inconnu: '?' };
      return h`${head}<ul class="rows">${oc.map(x => h`<li class="row"><span class="grow">${SF(x.s)} · ${x.k === 'ench' ? 'enchant' : 'gemme'}</span><span class="t-cap ink2">${ST[x.st]}</span></li>`)}</ul>
        ${!oc.length ? UI.empty('Équipement indisponible') : ''}<p class="t-cap muted">Enchants attendus : ${K.expandSlots(R.enchants.map(e => e.slot)).map(SF).join(', ') || F.DASH} · châsses probables : ${U.arr(c.S.settings.socketSlots).map(SF).join(', ')} (raider.io ne donne pas le nombre de châsses).</p>
        ${M.source === 'snapshot' ? h`<p class="t-cap muted">Le snapshot ne contient ni enchants ni gemmes : tout est «&nbsp;?&nbsp;».</p>` : ''}`;
  };

  /* ---------- verbs ---------- */
  const save = t => { K.store.save(); K.invalidate(t); };
  const idOf = el => el.getAttribute('data-arg') || '';
  K.act('done', el => {
    const id = idOf(el), a = find(id);
    if (!a) return;
    if (a.type === 'vaultOpen') { if (K.sheet.isOpen()) K.sheet.close(); claim(true); return; }
    const S = K.S, prev = S.done[id];
    S.done[id] = { at: new Date().toISOString(), weekKey: a.weekly ? K.time.info().weekKey : null, liveConfirmed: null };
    S.pinned = S.pinned.filter(x => x !== id);
    if (K.sheet.isOpen()) K.sheet.close();
    save('done');
    K.toast('Coché · à confirmer en direct', { undo: () => { if (prev) S.done[id] = prev; else delete S.done[id]; save('done'); } });
  });
  /* P1-7: W.vaultClaimed (declared; raider.io cannot see the claim) */
  const claim = on => {
    const W = K.store.week(), prev = !!W.vaultClaimed;
    W.vaultClaimed = !!on;
    K.store.saveWeek(); K.invalidate('vault-claim');
    K.toast(on ? 'Grand Coffre marqué récupéré · Déclaré' : 'Coffre à nouveau à récupérer', { undo: () => { K.store.week().vaultClaimed = prev; K.store.saveWeek(); K.invalidate('vault-claim'); } });
  };
  K.act('vault-claim', () => claim(true));
  K.act('vault-unclaim', () => claim(false));
  K.act('undone', el => { delete K.S.done[idOf(el)]; save('done'); });
  K.act('snooze', el => {
    const id = idOf(el), S = K.S, prev = S.snooze[id], wasPinned = S.pinned.includes(id);
    S.snooze[id] = new Date(Date.now() + 864e5).toISOString();
    S.pinned = S.pinned.filter(x => x !== id);
    if (K.sheet.isOpen()) K.sheet.close();
    save('snooze');
    K.toast('Reporté de 24 h', { undo: () => { if (prev) S.snooze[id] = prev; else delete S.snooze[id]; if (wasPinned) S.pinned.push(id); save('snooze'); } });
  });
  K.act('pin', el => {
    const id = idOf(el), S = K.S, on = !S.pinned.includes(id);
    S.pinned = on ? S.pinned.concat(id) : S.pinned.filter(x => x !== id);
    if (on) delete S.snooze[id];
    save('pin');
    K.toast(on ? 'Ajouté à ce soir' : 'Retiré de ce soir');
  });
  K.act('plan-copy', () => K.copy(planText(K.engine.get(), K.ctx()), { title: 'Copier le plan', done: 'Plan copié' }));
  let verifying = null;
  const proven = () => { const S = K.S, out = new Set(); Object.keys(S.done).forEach(k => { if (U.isObj(S.done[k]) && S.done[k].liveConfirmed) out.add(k); }); Object.keys(S.closed).forEach(k => out.add(k)); return out; };
  K.act('verify', () => {
    if (K.net.busy) { K.toast('Mise à jour déjà en cours…'); return; }
    verifying = proven();
    K.toast('Vérification en direct…');
    K.net.refresh({ force: true });
  });
  K.on('settled', () => {
    if (!verifying) return;
    const before = verifying;
    verifying = null;
    if (K.net.profile.state !== 'ok') { K.toast('Vérification impossible : raider.io injoignable · réessaie plus tard'); return; }
    const n = Array.from(proven()).filter(id => !before.has(id)).length;
    K.toast(n ? n + (n > 1 ? ' actions détectées comme faites' : ' action détectée comme faite') : 'Aucune action détectée comme faite · la synchro raider.io peut prendre du temps');
  });
  K.act('budget', el => { const v = Number(idOf(el)); if ([30, 60, 120, 0].includes(v)) { K.S.budget = v; save('budget'); } });
  K.act('tier-set', el => {
    const p = idOf(el).split(':'), slot = p[0], g = K.M.gear[slot];
    if (!g || !g.present || g.id == null || !['0', '1', 'x'].includes(p[1])) { K.toast('Objet inconnu : confirmation impossible'); return; }
    const cur = K.S.tierManual[slot];
    if (p[1] === 'x' || (U.isObj(cur) && cur.itemId === g.id && cur.isTier === (p[1] === '1'))) delete K.S.tierManual[slot];
    else K.S.tierManual[slot] = { itemId: g.id, isTier: p[1] === '1' };
    save('tier');
  });

  K.nowUI = { planText, prevTxt, row, stateTag, why, pips, tierRows, tierLabel, tierHint, tierBtns, vaultRows, optimCells, scoreInfo };
})(KATA);
