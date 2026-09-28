/* 73-projection.js — P1-2 projection band + measured pace + plateau insight (Analyse › Portes du Mythique). Stage 5.
   One axis (ilvl) over weeks S0–S8. Blue line «réaliste» = S.settings.itemsPerWeek items/week at the new-item ilvl
   (same model as K.engine.projection, fractional items interpolated), inside a 15 % blue band «prudent» (×0,5) →
   «optimiste» (×1,5). Jade line «rythme mesuré» = OLS slope of the journal ilvl per day × 7, only with ≥ 3 entries over
   ≥ 5 days. Research targets = horizontal hairlines drawn by confidence, labelled on the right; the debated ceiling is a
   band (+ «Débat» pill in the legend). Targets far above the curves are listed «hors du cadre» instead of squashing it.
   Crosshair readout on tap/pointer (K.chart.tip), «Voir en tableau» twin, «Estimation · hypothèses modifiables» chip.
   K.projChart(ctx) → Safe · K.plateau(ctx) → Safe («Le HC (305) n'améliore plus que … »), '' when > 2 slots below HC. */
(function (K) {
  'use strict';
  const { h, icon } = K;
  const F = K.fmt, U = K.util, UI = K.ui, isNum = U.isNum;
  const SF = s => K.SLOT_FR[s] || s;
  const r1 = v => Math.round(v * 10) / 10;
  const confOf = (R, v) => { const r = R.progression.ilvlTable.find(x => parseInt(U.str(x.ilvl), 10) === v); return r && r.confidence ? r.confidence : 'moyenne'; };
  const srcOf = (R, v) => { const r = R.progression.ilvlTable.find(x => parseInt(U.str(x.ilvl), 10) === v); return r ? r.sources : null; };

  /* measured pace (journal of this character) */
  const pace = () => {
    const js = (K.visit ? K.visit.journal() : []).filter(e => isNum(e.ilvl))
      .map(e => ({ t: U.isISO(e.t) ? Date.parse(e.t) : Date.parse(e.d + 'T12:00:00Z'), v: e.ilvl })).filter(p => isNum(p.t));
    if (js.length < 3) return { ok: false, n: js.length };
    const t0 = Math.min(...js.map(p => p.t)), span = (Math.max(...js.map(p => p.t)) - t0) / 864e5;
    if (span < 5) return { ok: false, n: js.length, days: Math.round(span) };
    const xs = js.map(p => (p.t - t0) / 864e5), ys = js.map(p => p.v), mx = U.sum(xs) / xs.length, my = U.sum(ys) / ys.length;
    const sxx = U.sum(xs.map(x => (x - mx) * (x - mx)));
    if (!sxx) return { ok: false, n: js.length };
    return { ok: true, perWeek: U.sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / sxx * 7, n: js.length, days: Math.round(span) };
  };

  const chart = c => {
    const M = c.M, R = c.R, T = c.T, st = c.S.settings, ib = R.raid.ilvlByDifficulty;
    const per = isNum(st.itemsPerWeek) && st.itemsPerWeek > 0 ? st.itemsPerWeek : 1.5, v = isNum(st.newItemIlvl) ? st.newItemIlvl : ib.heroic;
    const f = K.engine.projCurve(M, v);
    if (!f) return h`<p class="t-cap muted">Courbe indisponible : équipement ou ilvl des nouveaux objets inconnus.</p>`;
    const WK = 8, weeks = Array.from({ length: WK + 1 }, (_, w) => w);
    const S = [0.5, 1, 1.5].map(m => weeks.map(w => f(w * per * m)));            // prudent · réaliste · optimiste
    const now = S[1][0], pc = pace(), meas = pc.ok ? weeks.map(w => now + pc.perWeek * w) : null;
    const lo0 = Math.min(...S[0]), top = Math.max(...S[2]);
    const tg = [];
    if (isNum(T.mythicEntryIlvl)) tg.push({ v: T.mythicEntryIlvl, l: 'entrée M', conf: 'moyenne' });
    if (isNum(ib.mythic) && ib.mythic !== T.mythicEntryIlvl) tg.push({ v: ib.mythic, l: 'drop M', conf: confOf(R, ib.mythic) });
    const capR = K.pv.rangeNums(R.progression.maxIlvl.value, 'maxIlvl'), caps = capR.nums.map(Number).filter(isNum).sort((a, b) => a - b);
    const near = x => x <= top + 12 && x >= Math.min(lo0, now) - 12;
    const tIn = tg.filter(t => near(t.v)), tOut = tg.filter(t => !near(t.v)), capIn = caps.length > 0 && near(caps[0]);
    const yLo = Math.floor(Math.min(lo0, now, ...tIn.map(t => t.v)) - 1);
    const yHi = Math.ceil(Math.max(top, ...tIn.map(t => t.v), capIn ? caps[caps.length - 1] : -Infinity) + 1);
    const phone = window.innerWidth < 768, W = phone ? 360 : 640, H = phone ? 220 : 250, pl = 34, pr = phone ? 64 : 96, pt = 10, pb = 24;
    const X = w => r1(pl + w / WK * (W - pl - pr)), Y = y => r1(pt + (yHi - y) / Math.max(1, yHi - yLo) * (H - pt - pb));
    const rng = yHi - yLo, step = rng <= 10 ? 2 : rng <= 25 ? 5 : 10, ticks = [];
    for (let t = Math.ceil(yLo / step) * step; t <= yHi; t += step) ticks.push(t);
    const line = ys => ys.map((y, i) => (i ? 'L' : 'M') + X(i) + ' ' + Y(y)).join(' ');
    const band = S[2].map((y, i) => X(i) + ',' + Y(y)).concat(S[0].map((y, i) => X(i) + ',' + Y(y)).reverse()).join(' ');
    const key = K.chart.tip(weeks.map(w => ({ x: X(w), text: 'S' + w + ' · réaliste ≈ ' + F.ilvl(S[1][w]) + ' · prudent → optimiste ≈ ' + F.ilvl(S[0][w]) + ' → ' + F.ilvl(S[2][w]) + (meas ? ' · rythme mesuré ≈ ' + F.ilvl(meas[w]) : '') })));
    const clip = 'pjc-' + key, e8 = S[1][WK];
    const aria = 'Projection d\'ilvl sur ' + WK + ' semaines : ' + F.ilvl(now) + ' aujourd\'hui, ≈ ' + F.ilvl(e8) + ' en S' + WK + ' (réaliste, ' + F.num(per, per % 1 ? 1 : 0) + ' objet(s) par semaine à ' + v + ')';
    const tl = t => (t.conf === 'moyenne' ? '~' : '') + t.v + (t.conf === 'basse' ? ' ?' : '') + ' ' + t.l;
    return h`<div class="ch pj" data-qa="proj-chart"><div class="card-h"><p class="over">Projection sur ${WK} semaines</p>${UI.prov('estimate', '· hypothèses modifiables')}</div>
      <svg class="ch-svg" viewBox="0 0 ${W} ${H}" data-tip="${key}" data-vw="${W}" role="img" aria-label="${aria}" tabindex="0">
        <defs><clipPath id="${clip}"><rect x="${pl}" y="${pt}" width="${W - pl - pr}" height="${H - pt - pb}"></rect></clipPath></defs>
        ${ticks.map(t => h`<line class="pj-grid" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"></line><text class="pj-ax" x="${pl - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`)}
        ${weeks.filter(w => !phone || w % 2 === 0).map(w => h`<text class="pj-ax" x="${X(w)}" y="${H - 6}" text-anchor="middle">S${w}</text>`)}
        ${capIn && caps.length > 1 ? h`<rect class="pj-cap" x="${pl}" width="${W - pl - pr}" y="${Y(caps[caps.length - 1])}" height="${Math.max(1, Y(caps[0]) - Y(caps[caps.length - 1]))}"></rect><text class="pj-lb" x="${W - pr + 6}" y="${r1((Y(caps[0]) + Y(caps[caps.length - 1])) / 2 + 4)}">${caps[0]}–${caps[caps.length - 1]} débat</text>` : ''}
        ${capIn && caps.length === 1 ? h`<line class="pj-tg" x1="${pl}" x2="${W - pr}" y1="${Y(caps[0])}" y2="${Y(caps[0])}"></line><text class="pj-lb" x="${W - pr + 6}" y="${Y(caps[0]) + 4}">~${caps[0]} plafond</text>` : ''}
        ${tIn.map(t => h`${t.conf !== 'basse' ? h`<line class="pj-tg${t.conf === 'haute' ? ' pj-tg-h' : ''}" x1="${pl}" x2="${W - pr}" y1="${Y(t.v)}" y2="${Y(t.v)}"></line>` : ''}<text class="pj-lb" x="${W - pr + 6}" y="${Y(t.v) + 4}">${tl(t)}</text>`)}
        <polygon class="pj-band" points="${band}"></polygon>
        <path class="pj-real" d="${line(S[1])}"></path>
        ${meas ? h`<path class="pj-meas" d="${line(meas)}" clip-path="url(#${clip})"></path>` : ''}
        <line class="ch-x" x1="0" x2="0" y1="${pt}" y2="${H - pb}" visibility="hidden"></line>
        <circle class="ch-dot pj-dot" cx="${X(WK)}" cy="${Y(e8)}" r="4"></circle>
        <text class="ch-lb" x="${X(WK) - 6}" y="${Y(e8) - 9}" text-anchor="end">≈ ${F.ilvl(e8)}</text>
      </svg>
      <p class="ch-tip t-cap ink2" aria-live="polite">Touche le graphique pour lire une semaine.</p>
      <ul class="ch-leg t-cap ink2">
        <li><i class="lgk lgk-real" aria-hidden="true"></i>réaliste · ${F.num(per, per % 1 ? 1 : 0)} ${per >= 2 ? 'objets' : 'objet'}/sem. à ${v}</li>
        <li><i class="lgk lgk-band" aria-hidden="true"></i>prudent → optimiste (×0,5 → ×1,5)</li>
        ${meas ? h`<li><i class="lgk lgk-meas" aria-hidden="true"></i>rythme mesuré ≈ ${F.signed(r1(pc.perWeek), 1)}/sem. (journal : ${pc.n} relevés sur ${pc.days} j)</li>`
          : h`<li><i class="lgk lgk-none" aria-hidden="true"></i>rythme mesuré : il faut au moins 3 relevés sur 5 jours (journal local, ${F.count(pc.n || 0, 'relevé', 'relevés')})</li>`}
        <li><i class="lgk lgk-tg" aria-hidden="true"></i>repères de la recherche (~ : confiance moyenne)</li>
      </ul>
      ${tOut.length || (caps.length && !capIn) ? h`<p class="t-cap muted">Hors du cadre : ${tOut.map(t => tl(t)).join(' · ')}${tOut.length && caps.length && !capIn ? ' · ' : ''}${caps.length && !capIn ? h`plafond ${K.pv.range(R.progression.maxIlvl.value, 'maxIlvl')}` : ''}</p>` : ''}
      <details class="ch-tw" data-key="tw-proj"><summary class="t-call">Voir en tableau</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Semaine</th><th>Prudent</th><th>Réaliste</th><th>Optimiste</th>${meas ? h`<th>Mesuré</th>` : ''}</tr></thead><tbody>
        ${weeks.map(w => h`<tr><td class="num">S${w}</td><td class="num">≈ ${F.ilvl(S[0][w])}</td><td class="num">≈ ${F.ilvl(S[1][w])}</td><td class="num">≈ ${F.ilvl(S[2][w])}</td>${meas ? h`<td class="num">≈ ${F.ilvl(meas[w])}</td>` : ''}</tr>`)}
      </tbody></table></div></details></div>`;
  };

  const plateau = c => {
    const M = c.M, R = c.R, T = c.T, ib = R.raid.ilvlByDifficulty, hc = ib.heroic;
    if (!isNum(hc) || !M.gearPresent) return '';
    const below = K.SLOTS.filter(s => M.gear[s].present && isNum(M.gear[s].ilvl) && M.gear[s].ilvl < hc);
    if (below.length > 2) return '';
    const up = [isNum(T.vaultMplusLevel) ? 'Coffre à +' + T.vaultMplusLevel : null, isNum(ib.mythic) ? 'Mythique (' + ib.mythic + ')' : null].filter(Boolean);
    const n = below.length;
    const txt = 'Le HC (' + hc + ') ' + (n ? 'n\'améliore plus que ' + F.count(n, 'emplacement', 'emplacements') + ' : ' + below.map(SF).join(', ') : 'n\'améliore plus aucun emplacement') + '.' + (up.length ? ' Pour monter : ' + up.join(' ou ') + '.' : '');
    return h`<div class="callout pj-plat" data-qa="plateau"><p class="t-call ink">${icon('info', 'i-sm')} ${txt}</p><p class="t-cap ink2">${UI.provResearch()} ilvl HC ${K.pv.conf(confOf(R, hc), srcOf(R, hc))} · mesuré : ${M.source === 'live' ? 'raider.io' : M.source === 'cached' ? 'cache' : 'snapshot du ' + F.ddmm(M.at)}</p></div>`;
  };

  K.projChart = chart;
  K.plateau = plateau;
})(KATA);
