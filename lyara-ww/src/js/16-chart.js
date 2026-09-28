/* 16-chart.js — tiny inline-SVG chart kit (dataviz rules: one axis, 2 px lines, ≥ 8 px end markers with a 2 px
   surface ring, text in ink tokens only, tap/pointer readout + a «Voir en tableau» twin). Stage 5 (P1).
   K.chart.tip(points) → key for <svg data-tip="key" data-vw="W"> (or data-axis="y" data-vh="H" for rows: points {y, text});
     points = [{x (viewBox units), text}] (FR text built
     here from numbers/dates only — never API text). Pointer/tap on the svg snaps a crosshair (.ch-x) to the nearest
     point and writes the readout into the sibling <p class="ch-tip"> with textContent.
   K.chart.spark(pts, {label, fmt}) → Safe: sparkline of [{t (ms), v}] — 2 px jade line, labelled end value,
     no axis, readout + table twin. 0/1 point → a sentence instead of a chart. */
(function (K) {
  'use strict';
  const { h } = K;
  const U = K.util, F = K.fmt, isNum = U.isNum;
  const CH = (K.chart = {});
  const n1 = v => Math.round(v * 10) / 10;

  /* ---------- readout registry + one delegated pointer handler ---------- */
  const tips = new Map();
  let seq = 0;
  CH.tip = pts => {
    const k = 't' + (++seq).toString(36);
    tips.set(k, U.arr(pts).filter(p => isNum(p.x) || isNum(p.y)));
    if (tips.size > 120) tips.delete(tips.keys().next().value);
    return k;
  };
  const show = (svg, clientX, clientY) => {
    const pts = tips.get(svg.getAttribute('data-tip'));
    if (!pts || !pts.length) return;
    const Yax = svg.getAttribute('data-axis') === 'y', k = Yax ? 'y' : 'x';     // rows (dumbbell) snap on y, series on x
    const r = svg.getBoundingClientRect(), span = Number(svg.getAttribute(Yax ? 'data-vh' : 'data-vw')) || (Yax ? r.height : r.width) || 1;
    const c = Yax ? clientY : clientX, size = Yax ? r.height : r.width;
    const v = c == null || !size ? pts[pts.length - 1][k] : (c - (Yax ? r.top : r.left)) / size * span;
    let best = pts[0];
    pts.forEach(p => { if (Math.abs(p[k] - v) < Math.abs(best[k] - v)) best = p; });
    const ln = svg.querySelector('.ch-x');
    if (ln) { ln.setAttribute(k + '1', best[k]); ln.setAttribute(k + '2', best[k]); ln.setAttribute('visibility', 'visible'); }
    const wrap = svg.closest('.ch'), out = wrap && wrap.querySelector('.ch-tip');
    if (out) out.textContent = best.text;
  };
  const onPtr = e => {
    const svg = e.target instanceof Element ? e.target.closest('svg[data-tip]') : null;
    if (svg) K.guard('chart-tip', () => show(svg, e.clientX, e.clientY), true);
  };
  document.addEventListener('pointermove', onPtr);
  document.addEventListener('pointerdown', onPtr);
  document.addEventListener('focusin', e => {                    // keyboard focus → last point (a tap already placed it)
    const t = e.target;
    if (t instanceof Element && t.matches('svg[data-tip]')) K.guard('chart-tip', () => { if (t.matches(':focus-visible')) show(t, null, null); }, true);
  });

  /* ---------- sparkline ---------- */
  CH.spark = (pts, o) => {
    o = o || {};
    const fmt = o.fmt || (v => F.num(v));
    const P = U.arr(pts).filter(p => isNum(p.t) && isNum(p.v)).sort((a, b) => a.t - b.t);
    const table = () => h`<details class="ch-tw" data-key="${'tw-' + (o.key || 'spark')}"><summary class="t-call">Voir en tableau</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Jour</th><th>${o.label || 'Valeur'}</th></tr></thead><tbody>${P.slice().reverse().map(p => h`<tr><td class="num">${F.ddmm(p.t)}</td><td class="num">${fmt(p.v)}</td></tr>`)}</tbody></table></div></details>`;
    if (P.length < 2) {
      return h`<p class="t-call ink2">${P.length ? 'Un seul relevé (' + F.ddmm(P[0].t) + ' : ' + fmt(P[0].v) + ') : la courbe apparaît dès le 2e jour de relevé en direct.' : 'Pas encore de relevé : le journal note une valeur par jour, à chaque passage en direct.'}</p>`;
    }
    const W = 320, H = 64, pl = 6, pr = 64, pt = 10, pb = 10;
    const t0 = P[0].t, t1 = P[P.length - 1].t, vs = P.map(p => p.v);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const X = t => n1(pl + (t1 > t0 ? (t - t0) / (t1 - t0) : 1) * (W - pl - pr));
    const Y = v => n1(pt + (hi - v) / (hi - lo) * (H - pt - pb));
    const d = P.map((p, i) => (i ? 'L' : 'M') + X(p.t) + ' ' + Y(p.v)).join(' ');
    const e = P[P.length - 1], ex = X(e.t), ey = Y(e.v);
    const key = CH.tip(P.map(p => ({ x: X(p.t), text: F.ddmm(p.t) + ' · ' + fmt(p.v) })));
    const aria = (o.label || 'Série') + ' : ' + P.length + ' relevés du ' + F.ddmm(t0) + ' au ' + F.ddmm(t1) + ', de ' + fmt(P[0].v) + ' à ' + fmt(e.v);
    return h`<div class="ch ch-spark"><svg class="ch-svg" viewBox="0 0 ${W} ${H}" data-tip="${key}" data-vw="${W}" role="img" aria-label="${aria}" tabindex="0">
      <line class="ch-x" x1="0" x2="0" y1="2" y2="${H - 2}" visibility="hidden"></line>
      <path class="ch-l" d="${d}"></path><circle class="ch-dot" cx="${ex}" cy="${ey}" r="4"></circle>
      <text class="ch-lb" x="${n1(ex + 9)}" y="${n1(Math.min(H - 4, Math.max(12, ey + 4)))}">${fmt(e.v)}</text></svg>
      <p class="ch-tip t-cap ink2" aria-live="polite">${P.length} relevés · du ${F.ddmm(t0)} au ${F.ddmm(t1)} · touche la courbe pour lire une valeur</p>${table()}</div>`;
  };
})(KATA);
