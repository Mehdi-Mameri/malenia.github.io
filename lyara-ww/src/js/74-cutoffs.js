/* 74-cutoffs.js — P1-3 cutoff strip (Analyse › Miroir + «Cote M+» meter sheet). Stage 5.
   Data: K.aux.cutoffs.data.{p999,p990,p900}.value (raider.io season-cutoffs, EU, all classes; tentative field names),
   shown only when the cutoffs are live or cached AND the score is known (otherwise hidden: never a guessed threshold).
   One horizontal axis from min(score, p900) − 100 to p999 + 100: orange ticks «top 10 %», «top 1 %», «top 0,1 %»,
   a jade «toi» dot, blue research milestone ticks drawn by confidence (no label: readout + table twin carry them).
   Line: «−{p900 − score} pour le top 10 % EU (seuils raider.io, toutes classes)» or «Top 10 % EU atteint».
   K.cutoffStrip(ctx) → Safe | '' (data-qa="cutoffs"). The ranks row (P1-3) lives in 72-analyse (M.ranks). */
(function (K) {
  'use strict';
  const { h } = K;
  const F = K.fmt, U = K.util, UI = K.ui, isNum = U.isNum;
  const r1 = v => Math.round(v * 10) / 10;
  const TOPS = [['p900', 'top 10 %'], ['p990', 'top 1 %'], ['p999', 'top 0,1 %']];

  const strip = c => {
    const a = c.aux.cutoffs, M = c.M, sc = M.score;
    if (!a || (a.state !== 'live' && a.state !== 'cached') || !U.isObj(a.data) || !isNum(sc) || (M.source !== 'live' && M.source !== 'cached')) return '';
    const tops = TOPS.map(t => ({ k: t[0], l: t[1], v: a.data[t[0]] && isNum(a.data[t[0]].value) ? a.data[t[0]].value : null })).filter(t => t.v !== null);
    const p900 = tops.find(t => t.k === 'p900');
    if (!p900) return '';
    const lo = Math.min(sc, p900.v) - 100, hi = Math.max(...tops.map(t => t.v), sc) + 100;
    const ms = c.R.mplus.milestones.filter(m => isNum(m.rating) && m.rating > lo && m.rating < hi && m.confidence !== 'basse');
    const phone = window.innerWidth < 768, W = phone ? 360 : 640, H = 92, pl = 14, pr = 14, ay = 50;
    const X = v => r1(pl + (v - lo) / (hi - lo) * (W - pl - pr));
    let prev = -1e9, lvl = 0;
    const tk = tops.slice().sort((x, y) => x.v - y.v).map(t => { const x = X(t.v); lvl = x - prev < 64 ? 1 - lvl : 0; prev = x; return Object.assign({ x, lvl }, t); });
    const tx = X(sc), gap = p900.v - sc, p990 = tops.find(t => t.k === 'p990');
    const msg = gap > 0 ? F.MINUS + F.int(Math.ceil(gap)) + ' pour le top 10 % EU (seuils raider.io, toutes classes)'
      : 'Top 10 % EU atteint' + (p990 && p990.v > sc ? ' · ' + F.MINUS + F.int(Math.ceil(p990.v - sc)) + ' pour le top 1 %' : p990 ? ' · top 1 % atteint' : '');
    const pts = tk.map(t => ({ x: t.x, text: t.l + ' EU · ' + F.int(t.v) + ' (seuil raider.io)' }))
      .concat(ms.map(m => ({ x: X(m.rating), text: 'palier de la recherche · ' + (m.confidence === 'moyenne' ? '~' : '') + F.int(m.rating) })), [{ x: tx, text: 'toi · ' + F.int(sc) }]);
    const key = K.chart.tip(pts);
    const aria = 'Seuils raider.io EU : ' + tk.map(t => t.l + ' ' + F.int(t.v)).join(', ') + ' ; ta cote ' + F.int(sc);
    const chip = a.state === 'cached' ? UI.prov('cached', F.rel(a.at)) : UI.prov('live', F.hhmm(a.at));
    return h`<div class="ch cut" data-qa="cutoffs"><div class="card-h"><p class="over">Seuils du top EU</p>${chip}</div>
      <p class="t-call ink">${msg}</p>
      <svg class="ch-svg" viewBox="0 0 ${W} ${H}" data-tip="${key}" data-vw="${W}" role="img" aria-label="${aria}" tabindex="0">
        <line class="cut-ax" x1="${pl}" x2="${W - pr}" y1="${ay}" y2="${ay}"></line>
        ${ms.map(m => h`<line class="cut-ms${m.confidence === 'haute' ? ' cut-ms-h' : ''}" x1="${X(m.rating)}" x2="${X(m.rating)}" y1="${ay - 6}" y2="${ay + 6}"></line>`)}
        ${tk.map(t => h`<line class="cut-top" x1="${t.x}" x2="${t.x}" y1="${ay - 9}" y2="${ay + 9}"></line><text class="cut-lb" x="${t.x}" y="${t.lvl ? 12 : 28}" text-anchor="middle">${t.l}</text>`)}
        <line class="ch-x" x1="0" x2="0" y1="4" y2="${H - 22}" visibility="hidden"></line>
        <circle class="ch-dot" cx="${tx}" cy="${ay}" r="5"></circle>
        <text class="ch-lb" x="${U.clamp(tx, pl + 24, W - pr - 24)}" y="${ay + 26}" text-anchor="middle">toi ${F.int(sc)}</text>
      </svg>
      <p class="ch-tip t-cap ink2" aria-live="polite">Orange : seuils raider.io · bleu : paliers de la recherche · touche pour lire.</p>
      <details class="ch-tw" data-key="tw-cut"><summary class="t-call">Voir en tableau</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Repère</th><th>Cote</th><th>Source</th></tr></thead><tbody>
        ${tk.slice().reverse().map(t => h`<tr><td>${t.l} EU</td><td class="num">${F.int(t.v)}</td><td>raider.io</td></tr>`)}
        <tr><td class="ink">toi</td><td class="num ink">${F.int(sc)}</td><td>raider.io</td></tr>
        ${ms.map(m => h`<tr><td>${m.name || 'palier'}</td><td class="num">${m.confidence === 'moyenne' ? '~' : ''}${F.int(m.rating)}</td><td>recherche</td></tr>`)}
      </tbody></table></div></details></div>`;
  };
  K.cutoffStrip = strip;
})(KATA);
