/* 62-tier.js — «Tier 4 pièces» + Catalyseur (spec P0-11). Stage 3a.
   Detection comes from K.engine.tierState (manual override by itemId › research set item id › API `tier` › name
   heuristic › «?»), so the Stuff card, the Maintenant meter and the objective always agree. Rows, hint and
   Oui/Non buttons are the shared K.nowUI.tierRows / tierLabel / tierHint / tierBtns.
   GU.tier(ctx) card.
   Verbs: tier-set (45-now.js) · gear-cat (- | +: catalyst charges 0–9, S.catalyst.charges). Hook data-qa="tier". */
(function (K) {
  'use strict';
  const { h, icon, raw } = K;
  const F = K.fmt, U = K.util, UI = K.ui, isNum = U.isNum;
  const SF = s => K.SLOT_FR[s] || s;
  const GU = (K.gearUI = K.gearUI || {});
  const NU = () => K.nowUI;
  const tierIds = R => K.engine.tierIds(R);

  /* catalyst path: the non-tier tier-slot pieces with the highest ilvl first */
  const path = (t, ch, c) => {
    const need = 4, miss = Math.max(0, need - t.count);
    if (!miss) return { txt: '4 pièces confirmées : le bonus 4 pièces est actif.', loot: [] };
    const cand = t.perSlot.filter(p => p.isTier !== true && p.g && isNum(p.g.ilvl)).sort((a, b) => b.g.ilvl - a.g.ilvl);
    const cat = cand.slice(0, Math.min(ch, miss)), rest = cand.slice(cat.length).map(p => p.slot);
    const sl = xs => xs.map(p => SF(p.slot).toLowerCase() + ' (' + F.num(p.g.ilvl) + ')').join(', ');
    const txt = cat.length >= miss ? 'Avec ' + F.count(miss, 'charge', 'charges') + ' : catalyse ' + sl(cat) + ' → 4/4'
      : (miss - cat.length > 1 ? (miss - cat.length) + ' pièces dépendent du loot' : '1 pièce dépend du loot') + (cat.length ? ' · avec ' + F.count(cat.length, 'charge', 'charges') + ' : catalyse ' + sl(cat) : '');
    const ids = tierIds(c.R), loot = [];
    if (cat.length < miss) rest.forEach(s => { const r = ids[s]; if (!r) return; c.R.raid.bosses.forEach(b => { if (b.loot.some(x => K.loot.ids(x).includes(r.id))) loot.push([s, b.name]); }); });
    return { txt, loot, unk: t.unknown };
  };

  const tier = c => {
    const M = c.M, S = c.S, t = K.engine.tierState(M, S), R = c.R, ts = R.tierSet;
    const ch = isNum(S.catalyst.charges) ? U.clamp(S.catalyst.charges, 0, 9) : 0;
    const val = !M.gearPresent ? F.DASH : t.text;
    const ord = t.perSlot.slice().sort((a, b) => (b.isTier === true) - (a.isTier === true) || (a.isTier === false) - (b.isTier === false));
    const cells = [];
    ord.forEach((p, i) => { if (i === 4) cells.push(raw('<i class="tick" aria-hidden="true"></i>')); cells.push(raw('<i class="c' + (p.isTier === true ? ' c-on' : p.isTier === null ? ' c-unk' : '') + '"></i>')); });
    const pa = M.gearPresent ? path(t, ch, c) : null;
    const snap = M.source === 'snapshot' || M.source === 'none';
    return h`<div class="card tr-card" data-qa="tier"><div class="card-h"><h2 class="card-t">Tier · 4 pièces</h2>${snap ? UI.prov('declared') : UI.provM(M)}</div>
      <div class="tr-top"><span class="cells tr-cells" role="img" aria-label="${'Tier ' + (t.count) + ' confirmées sur 4, ' + t.unknown + ' à vérifier'}">${cells}</span><span class="t-h2 num">${val}</span></div>
      <p class="t-cap ink2">Seules les pièces détectées par raider.io ou confirmées ici comptent.${snap ? ' Hors ligne : confirmations manuelles uniquement.' : ''}</p>
      ${NU().tierRows(c)}
      <div class="tr-cat"><span class="grow"><span class="t-call ink">Charges de Catalyseur</span><br><span class="t-cap muted">Déclaré · compte-les en jeu</span></span>
        ${UI.stepper('gear-cat', 'charges de Catalyseur', String(ch), { lo: ch <= 0, hi: ch >= 9 })}</div>
      ${pa ? h`<div class="callout"><p class="t-call ink">${icon('spiral', 'i-sm')} ${pa.txt}</p>${pa.unk ? h`<p class="t-cap ink2">Les pièces « ? » sont comptées hors tier : confirme-les pour un chemin exact.</p>` : ''}
        ${pa.loot.length ? h`<p class="t-cap ink2">Sources (recherche) : ${pa.loot.map(x => SF(x[0]) + ' → ' + x[1]).join(' · ')}</p>` : ''}</div>` : ''}
      ${ts.catalyst.length ? h`<details data-key="tr-cat"><summary class="t-call">Catalyseur (recherche) ${UI.conf(ts.catalystConfidence || ts.confidence)}</summary><ul class="list-dot">${ts.catalyst.map(x => h`<li>${x}</li>`)}</ul></details>` : ''}
      ${ts.acquisition.length ? h`<details data-key="tr-acq"><summary class="t-call">Obtention (recherche) ${UI.conf(ts.acquisitionConfidence || ts.confidence)}</summary><ul class="list-dot">${ts.acquisition.map(x => h`<li>${x}</li>`)}</ul></details>` : ''}
      ${ts.twoPiece || ts.fourPiece ? h`<details data-key="tr-bonus"><summary class="t-call">Bonus · ${ts.name || 'set de tier'} ${UI.conf(ts.nameConfidence)}</summary><dl class="kv kv-why"><dt>2 pièces</dt><dd>${U.str(ts.twoPiece) || F.DASH}</dd><dt>4 pièces</dt><dd>${U.str(ts.fourPiece) || F.DASH}</dd></dl></details>` : ''}</div>`;
  };
  GU.tier = tier;

  K.act('gear-cat', el => {
    const d = UI.stepDir(el), S = K.S, v = isNum(S.catalyst.charges) ? S.catalyst.charges : 0;
    S.catalyst.charges = U.clamp(v + d, 0, 9);
    K.store.save(); K.invalidate('tier');
  });
})(KATA);
