/* 80-guide.js — «Guide», the research reference (spec P0-14, layout §3.6). Stage 3b.
   Research only: never a Live chip. Each group is a <details data-key="g-…"> whose 44 px summary carries
   «Recherche du {asOf}» once; every item carries its confidence glyph (tap → Sources sheet); debate pills are
   attached per group via K.pv anchors. A group is hidden when its research key is empty.
   Import strings are rendered ONLY when verbatim === true (mono block + «Copier» + source), otherwise
   «Chaîne non trouvée telle quelle : importe depuis la source». Desktop: CSS columns (column-width 460 px);
   groups start open on desktop, closed on phone. Verb: copy-import (arg = index). */
(function (K) {
  'use strict';
  const { h, icon } = K;
  const F = K.fmt, U = K.util, UI = K.ui;
  const isNum = U.isNum, S_ = U.str, A = U.arr, O = U.obj;
  const SF = s => K.SLOT_FR[s] || s;
  const cg = (l, ids) => K.pv.conf(l, ids);
  const has = x => !!x && String(Array.isArray(x) ? x.join('') : x) !== '';
  const li = xs => { xs = A(xs).filter(x => typeof x === 'string' && x); return xs.length ? h`<ul class="list-dot">${xs.map(x => h`<li>${x}</li>`)}</ul>` : ''; };
  const para = (x, cls) => (S_(x) ? h`<p class="${cls || 't-call'} any">${S_(x)}</p>` : '');
  const sub = (t, body) => (has(body) ? h`<div class="g-sub"><h3 class="over">${t}</h3>${body}</div>` : '');
  const item = (title, meta, body, conf, ids) => h`<div class="g-it"><p class="g-itt"><span class="ink">${title}</span>${meta ? h` <span class="t-cap ink2">${meta}</span>` : ''} ${cg(conf, ids)}</p>${body || ''}</div>`;
  const grp = (key, title, body, pills) => (has(body) ? h`<details class="card g-grp" data-key="g-${key}"><summary><span class="g-st"><span class="card-t">${title}</span>${UI.prov('research', 'du ' + K.research.asOfFR + (K.research.stale ? ' · la méta a pu bouger' : ''))}</span>${icon('chevron')}</summary>
    <div class="g-b">${pills ? h`<p class="g-pills">${pills}</p>` : ''}${body}</div></details>` : '');
  const meta = xs => xs.map(S_).filter(Boolean).join(' · ');

  const ROT = [['singleTarget', 'Mono-cible'], ['aoe', 'Multi-cible'], ['opener', 'Ouverture'], ['cooldowns', 'Temps de recharge'],
    ['defensives', 'Défensifs'], ['mistakes', 'Erreurs fréquentes'], ['heroDiffs', 'Selon l\'arbre héroïque']];
  const CONS = { flacon: 'Flacon', nourriture: 'Nourriture', potion: 'Potion', huile: 'Huile', rune: 'Rune' };
  const PT = { buff: 'Buff', nerf: 'Nerf', fix: 'Correctif', pvp: 'JcJ', annonce: 'Annonce', systeme: 'Système' };
  const DIFF = [['lfr', 'LFR'], ['normal', 'Normal'], ['heroic', 'Héroïque'], ['mythic', 'Mythique']];

  const groups = c => {
    const R = c.R, out = [];
    const ro = R.rotation;
    out.push(grp('rot', 'Rotation', has(ROT.map(r => A(ro[r[0]]).join(''))) ? h`${ROT.map(r => sub(r[1], li(ro[r[0]])))}${ro.confidence ? h`<p class="t-cap ink2">Confiance de la section ${cg(ro.confidence, ro.sources)}</p>` : ''}` : '', K.pv.pills('rotation')));

    const ta = R.talents, imp = A(ta.importStrings).filter(U.isObj);
    const strs = imp.length ? imp.map((s, i) => (s.verbatim === true && typeof s.string === 'string' && s.string
      ? h`<div class="g-imp"><p class="t-call">${S_(s.label) || 'Chaîne d\'import'}</p><pre class="g-str mono">${s.string}</pre>
          <div class="btn-row"><button type="button" class="btn btn-sm" data-act="copy-import" data-arg="${i}">${icon('copy')}<span>Copier</span></button>${K.pv.srcLinks([s.source])}</div></div>`
      : h`<p class="lead">${S_(s.label) ? S_(s.label) + ' : ' : ''}Chaîne non trouvée telle quelle : importe depuis la source ${K.pv.srcLinks([s.source])}</p>`))
      : h`<p class="lead">Chaîne non trouvée telle quelle : importe depuis la source.</p>`;
    const kc = A(ta.keyChoices).filter(x => U.isObj(x) && S_(x.node));
    out.push(grp('tal', 'Talents', has([S_(ta.mplus), S_(ta.raidST), S_(ta.raidAoE)]) || kc.length || imp.length ? h`${sub('M+', para(ta.mplus))}${sub('Raid mono-cible', para(ta.raidST))}${sub('Raid multi-cible', para(ta.raidAoE))}
      ${sub('Choix clés', kc.length ? h`<ul class="list-dot">${kc.map(x => h`<li><span class="ink">${S_(x.node)}</span> → ${S_(x.pickWhen)}</li>`)}</ul>` : '')}
      ${sub('Chaînes d\'import', strs)}${sub('Notes', para(ta.notes, 'sm'))}` : '', K.pv.pills('talents')));

    const ht = R.heroTrees;
    out.push(grp('hero', 'Arbres héroïques', ht.trees.length || ht.recommendation ? h`${para(ht.recommendation)}${ht.trees.map(t => item(t.name, '', h`${t.bestFor ? h`<p class="sm">Idéal pour : ${S_(t.bestFor)}</p>` : ''}${sub('Pour', li(t.pros))}${sub('Contre', li(t.cons))}${t.usage ? h`<p class="sm">Usage : ${S_(t.usage)}</p>` : ''}`, t.confidence, t.sources))}` : '', K.pv.pills('heroTrees')));

    const ts = R.tierSet;
    out.push(grp('tier', 'Set de tier', ts.name ? h`${item(ts.name, ts.slots.map(SF).join(', '), h`${ts.twoPiece ? h`<p class="t-call any"><span class="ink">2 pièces</span> · ${S_(ts.twoPiece)}</p>` : ''}${ts.fourPiece ? h`<p class="t-call any"><span class="ink">4 pièces</span> · ${S_(ts.fourPiece)}</p>` : ''}`, ts.nameConfidence, ts.sources)}
      ${sub(h`Obtention ${cg(ts.acquisitionConfidence)}`, li(ts.acquisition))}${sub(h`Catalyseur ${cg(ts.catalystConfidence)}`, li(ts.catalyst))}${para(ts.confidenceNote, 'sm')}` : '', K.pv.pills('tier')));

    const tk = R.trinkets, tl = xs => xs.filter(x => S_(x.name)).map(x => item((isNum(x.rank) ? 'n°' + x.rank + ' · ' : '') + S_(x.name), meta([x.type, x.source]), para(x.why, 'sm'), x.confidence, x.sources));
    const wp = R.weapons.filter(w => S_(w.name));
    out.push(grp('trk', 'Bijoux et armes', tk.raid.length || tk.mplus.length || wp.length ? h`${sub('Bijoux · raid', tl(tk.raid))}${sub('Bijoux · M+', tl(tk.mplus))}${sub('Règle de paire', para(tk.pairingRule))}
      ${sub('À éviter', tk.avoid.filter(x => S_(x.name)).length ? h`<ul class="list-dot">${tk.avoid.filter(x => S_(x.name)).map(x => h`<li><span class="ink">${S_(x.name)}</span>${x.why ? h` · ${S_(x.why)}` : ''}</li>`)}</ul>` : '')}
      ${sub('Armes', wp.map(w => item(S_(w.name), meta([w.type, w.source]), para(w.note, 'sm'), w.confidence, w.sources)))}${sub('Arme craftée', para(R.crafting.weaponCraftVerdict))}` : '', K.pv.pills(['trinkets', 'weapons'])));

    out.push(grp('bis', 'BiS par emplacement', R.bisBySlot.filter(b => b.slot).map(b => item(SF(b.slot), '', h`${b.raid ? h`<p class="t-call any"><span class="ink2">Raid</span> · ${S_(b.raid)}</p>` : ''}${b.mplus ? h`<p class="t-call any"><span class="ink2">M+</span> · ${S_(b.mplus)}</p>` : ''}${para(b.note, 'sm')}`, b.confidence, b.sources)), K.pv.pills('bis')));

    const cons = R.consumables.filter(x => x.name);
    out.push(grp('egc', 'Enchants, gemmes, consommables', R.enchants.length || R.gems.length || cons.length ? h`${sub('Enchants', R.enchants.filter(e => e.name).map(e => item(SF(e.slot) + ' · ' + e.name, '', e.alt ? h`<p class="sm">Alternatives : ${S_(e.alt)}</p>` : '', e.confidence, e.sources)))}
      ${sub('Gemmes', R.gems.map(g => item(g.name, '', para(g.role, 'sm'), g.confidence, g.sources)))}
      ${sub('Consommables', cons.map(x => item(x.name, CONS[x.type] || x.type, '', x.confidence, x.sources)))}` : '', K.pv.pills(['enchants', 'gems', 'consumables'])));

    out.push(grp('stats', 'Statistiques', S_(R.stats.priority) ? item(S_(R.stats.priority), '', para(R.stats.note, 'sm'), R.stats.confidence, R.stats.sources) : '', K.pv.pills('stats')));

    const mp = R.mplus, kt = A(mp.keyTargets).filter(x => U.isObj(x) && S_(x.goal)), ml = mp.milestones.filter(m => isNum(m.rating));
    out.push(grp('mplus', 'Donjons M+', mp.dungeons.length || kt.length || ml.length ? h`${mp.dungeons.filter(d => d.name).map(d => item(d.name, meta([d.slug, d.origin]), h`${li(d.tips)}${sub('Butin', li(d.loot))}`, d.confidence, d.sources))}
      ${sub('Objectifs de clés', kt.length ? h`<ul class="list-dot">${kt.map(k => h`<li><span class="ink">${S_(k.goal)}</span>${k.level ? h` · ${S_(k.level)}` : ''}${k.why ? h`<br><span class="sm">${S_(k.why)}</span>` : ''}</li>`)}</ul>` : '')}
      ${sub('Paliers de cote', ml.map(m => item(F.int(m.rating) + ' · ' + S_(m.name), '', para(m.reward, 'sm'), m.confidence, m.sources)))}
      ${U.isObj(mp.affixes) && S_(mp.affixes.system) ? sub(h`Affixes ${cg(mp.affixes.confidence)}`, para(mp.affixes.system)) : ''}` : ''));

    const ra = R.raid, ib = ra.ilvlByDifficulty, lr = O(ra.lair), up = O(ra.upcoming);
    out.push(grp('raid', 'Raid', ra.name || ra.bosses.length ? h`${ra.name ? h`<p class="t-h2">${ra.name}</p>` : ''}
      ${DIFF.some(d => isNum(ib[d[0]])) ? h`<div class="chips">${DIFF.filter(d => isNum(ib[d[0]])).map(d => h`<span class="chip">${d[1]} <span class="num ink">${ib[d[0]]}</span></span>`)}</div>` : ''}
      ${sub('Boss (ordre de la recherche)', ra.bosses.filter(b => b.name).slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(b => item((isNum(b.order) ? b.order + '. ' : '') + b.name, '', h`${li(b.tips)}${sub('Butin', li(b.loot))}`, b.confidence, b.sources)))}
      ${sub('Conseils Mythique', li(ra.mythicAdvice))}${sub('Course au premier kill', para(ra.rwf))}
      ${S_(lr.name) ? sub('Repaire', item(S_(lr.name), meta([lr.boss, lr.type]), h`${para(lr.status, 'sm')}${para(lr.detail)}${li(lr.tips)}${A(lr.loot).length ? sub(h`Butin ${cg(lr.lootConfidence)}`, li(lr.loot)) : ''}${S_(lr.ilvl) ? h`<p class="sm">iLvl : ${S_(lr.ilvl)}</p>` : ''}${para(lr.vault, 'sm')}`, lr.confidence, lr.sources)) : ''}
      ${S_(up.name) ? sub('À venir', item(S_(up.name), S_(up.status), para(up.detail, 'sm'), up.confidence, up.sources)) : ''}` : '', K.pv.pills('raid')));

    const pg = R.progression, mx = O(pg.maxIlvl), it = pg.ilvlTable.filter(x => S_(x.source)), cr = pg.crests.filter(x => S_(x.name));
    out.push(grp('prog', 'Progression', S_(mx.value) || it.length || cr.length || pg.vaultRules.length ? h`${S_(mx.value) ? h`<div class="g-it"><p class="g-itt"><span class="ink2">Plafond d'ilvl</span> ${K.pv.range(mx.value, 'maxIlvl')} ${cg(mx.confidence, mx.sources)}</p>${para(mx.note, 'sm')}</div>` : ''}
      ${sub('Repères d\'ilvl', it.map(x => item(S_(x.source), S_(x.ilvl), para(x.note, 'sm'), x.confidence, x.sources)))}
      ${sub('Crests', cr.map(x => item(S_(x.name), S_(x.range), para(x.howToGet, 'sm'))))}
      ${sub('Règles des crests', li(pg.crestRules))}${sub('Grand Coffre', li(pg.vaultRules))}${sub('Catalyseur', li(pg.catalyst))}` : '', K.pv.pills('progression', 'maxIlvl')));

    const today = K.time.dayKey(c.now) || '', last = K.visit ? K.visit.baseAt() : null;   // this visit's baseline (P1-1), not the lastSeen rewritten after the render
    const pt = R.patchTimeline.filter(p => p.title).slice().sort((a, b) => S_(b.date).localeCompare(S_(a.date)));
    out.push(grp('patch', 'Fil de patch', pt.map(p => h`<div class="g-it"><p class="g-itt"><span class="chip">${PT[p.type] || S_(p.type) || 'Note'}</span> <span class="num t-cap ink2">${U.isISO(p.date) ? F.ddmmyyyy(p.date) : S_(p.date)}</span>${S_(p.date) > today ? h` <span class="chip">à venir</span>` : last && U.isISO(p.date) && Date.parse(p.date) > last ? h` <span class="chip">nouveau</span>` : ''} ${cg(p.confidence, p.sources)}</p>
      <p class="t-call ink any">${p.title}</p>${para(p.detail, 'sm')}${p.forYou ? h`<p class="t-call any"><strong>Pour toi : </strong>${S_(p.forYou)}</p>` : ''}</div>`)));

    const src = K.research.src(R.sources.map(s => s.id));
    out.push(grp('src', 'Sources', src.length ? h`<ol class="srcl">${src.map(x => h`<li>${x.url ? h`<a class="inline any" href="${x.url}" target="_blank" rel="noopener noreferrer">${x.label}</a>` : x.label}</li>`)}</ol>` : ''));
    return out;
  };

  let opened = false;
  K.screens.register('guide', {
    render(c) {
      const gs = groups(c).filter(has);
      return h`<div class="guide"><p class="t-call ink2 g-intro">${UI.provResearch()} Référence de la recherche du ${K.research.asOfFR}, jamais une donnée en direct. Touche une jauge de confiance pour voir ses sources.</p>
        ${gs.length ? h`<div class="g-cols">${gs}</div>` : UI.empty('Recherche indisponible : aucune section à afficher.')}</div>`;
    },
    mounted(root) {
      if (opened) return;
      opened = true;
      if (window.matchMedia && matchMedia('(min-width:1024px)').matches) root.querySelectorAll('details.g-grp').forEach(d => { d.open = true; });
    }
  });

  K.act('copy-import', el => {
    const s = A(K.R.talents.importStrings)[Number(el.getAttribute('data-arg'))];
    if (!U.isObj(s) || s.verbatim !== true || typeof s.string !== 'string' || !s.string) { K.toast('Chaîne non trouvée telle quelle : importe depuis la source'); return; }
    K.pv.copy(s.string, 'Chaîne de talents');
  });
})(KATA);
