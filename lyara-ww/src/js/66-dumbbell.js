/* 66-dumbbell.js — P1-4 «Depuis le 21/08» dumbbell (Stuff, after the craft card). Stage 5.
   One row per slot present both in R.gearSnapshot and in the live / cached gear (the research player only — the
   snapshot is his): hollow mist dot = snapshot ilvl, jade dot = current ilvl, 2 px connector. Row status «Nouveau» (item
   id differs), «Amélioré» (same item, higher ilvl) or «=». Sorted by Δ (largest first), one ilvl axis, readout on tap
   (rows snap on y), legend (2 series) and a «Voir en tableau» twin. Hidden offline (snapshot vs itself) and while loading.
   GU.dumbbell(ctx) → Safe | '' (data-qa="dumbbell"). */
(function (K) {
  'use strict';
  const { h } = K;
  const F = K.fmt, U = K.util, UI = K.ui, isNum = U.isNum;
  const GU = (K.gearUI = K.gearUI || {});
  const SF = s => K.SLOT_FR[s] || s;

  const rowsOf = c => {
    const M = c.M, snap = c.R.gearSnapshot, seen = new Set(), out = [];
    snap.items.forEach(it => {
      const s = it.slot, g = M.gear[s];
      if (!K.SLOTS.includes(s) || seen.has(s) || !isNum(it.ilvl) || !g || !g.present || !isNum(g.ilvl)) return;
      seen.add(s);
      const same = isNum(it.itemId) && g.id != null && it.itemId === g.id, d = g.ilvl - it.ilvl;
      out.push({ s, a: it.ilvl, b: g.ilvl, d, st: !same ? 'Nouveau' : d > 0 ? 'Amélioré' : '=' });
    });
    return out.sort((x, y) => y.d - x.d || K.SLOTS.indexOf(x.s) - K.SLOTS.indexOf(y.s));
  };

  const dumbbell = c => {
    const M = c.M;
    if ((M.source !== 'live' && M.source !== 'cached') || !K.research.isPlayer() || !M.gearPresent) return '';
    const rows = rowsOf(c);
    if (!rows.length) return '';
    const vals = rows.reduce((o, r) => o.concat([r.a, r.b]), []);
    const lo = Math.floor(Math.min(...vals) - 2), hi = Math.ceil(Math.max(...vals) + 2);
    const phone = window.innerWidth < 768, W = phone ? 360 : 560, RH = 26, pt = 8, pb = 26, pl = 88, pr = 104;
    const H = pt + rows.length * RH + pb, X = v => Math.round((pl + (v - lo) / Math.max(1, hi - lo) * (W - pl - pr)) * 10) / 10, Y = i => pt + i * RH + RH / 2;
    const rng = hi - lo, step = rng <= 12 ? 2 : rng <= 30 ? 5 : 10, ticks = [];
    for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
    const dtxt = r => (r.d ? F.signed(r.d) : '±0');
    const key = K.chart.tip(rows.map((r, i) => ({ y: Y(i), text: SF(r.s) + ' · ' + F.ddmm(c.R.gearSnapshot.date) + ' ' + r.a + ' → ' + r.b + ' (' + dtxt(r) + ') · ' + r.st.toLowerCase() })));
    const nNew = rows.filter(r => r.st === 'Nouveau').length, nUp = rows.filter(r => r.st === 'Amélioré').length;
    const aria = 'Depuis le ' + F.ddmm(c.R.gearSnapshot.date) + ' : ' + nNew + ' nouveaux objets, ' + nUp + ' améliorés, ' + (rows.length - nNew - nUp) + ' inchangés';
    return h`<div class="card ch db" data-qa="dumbbell"><div class="card-h"><h2 class="card-t">Depuis le ${F.ddmm(c.R.gearSnapshot.date)}</h2><span class="nowrap">${UI.prov('snapshot', F.ddmm(c.R.gearSnapshot.date))} → ${UI.provM(M)}</span></div>
      <p class="t-call ink2">${F.count(nNew, 'nouvel objet', 'nouveaux objets')} · ${F.count(nUp, 'amélioré', 'améliorés')} · ${rows.length - nNew - nUp} inchangé${rows.length - nNew - nUp > 1 ? 's' : ''} (même objet, même ilvl)</p>
      <svg class="ch-svg" viewBox="0 0 ${W} ${H}" data-tip="${key}" data-axis="y" data-vh="${H}" data-vw="${W}" role="img" aria-label="${aria}" tabindex="0">
        ${ticks.map(t => h`<line class="pj-grid" x1="${X(t)}" x2="${X(t)}" y1="${pt}" y2="${H - pb}"></line><text class="pj-ax" x="${X(t)}" y="${H - 8}" text-anchor="middle">${t}</text>`)}
        <line class="ch-x" x1="${pl - 80}" x2="${W - 4}" y1="0" y2="0" visibility="hidden"></line>
        ${rows.map((r, i) => h`<text class="pj-lb" x="${pl - 10}" y="${Y(i) + 4}" text-anchor="end">${SF(r.s)}</text>
          ${r.d ? h`<line class="db-c" x1="${X(r.a)}" x2="${X(r.b)}" y1="${Y(i)}" y2="${Y(i)}"></line>` : ''}
          <circle class="db-a" cx="${X(r.a)}" cy="${Y(i)}" r="4"></circle><circle class="ch-dot" cx="${X(r.b)}" cy="${Y(i)}" r="4.5"></circle>
          <text class="${r.st === '=' ? 'pj-lb' : 'ch-lb'}" x="${W - pr + 10}" y="${Y(i) + 4}">${r.st === '=' ? '=' : r.st + ' ' + dtxt(r)}</text>`)}
      </svg>
      <p class="ch-tip t-cap ink2" aria-live="polite">Touche une ligne pour lire l'emplacement.</p>
      <ul class="ch-leg t-cap ink2"><li><i class="lgk-dot lgk-dot-a" aria-hidden="true"></i>snapshot du ${F.ddmm(c.R.gearSnapshot.date)}</li><li><i class="lgk-dot lgk-dot-b" aria-hidden="true"></i>maintenant (${M.source === 'live' ? 'raider.io' : 'cache'})</li></ul>
      <details class="ch-tw" data-key="tw-db"><summary class="t-call">Voir en tableau</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Emplacement</th><th>${F.ddmm(c.R.gearSnapshot.date)}</th><th>Maintenant</th><th>Δ</th><th>Statut</th></tr></thead><tbody>
        ${rows.map(r => h`<tr><td>${SF(r.s)}</td><td class="num">${r.a}</td><td class="num">${r.b}</td><td class="num">${dtxt(r)}</td><td>${r.st}</td></tr>`)}
      </tbody></table></div></details></div>`;
  };
  GU.dumbbell = dumbbell;
})(KATA);
