/* 52-radar.js — «Radar de clés» (spec P0-9) + the loot map (P1-5: item id, else normalised name, + trinket sources). Stage 3a/5.
   Maths come from K.engine.radar(M) (Theil–Sen fit ±σ on his own timed runs, one additivity test, pool =
   research dungeons ∪ API runs matched by name first, short name second).
   K.weekUI.radar(E, ctx) → Safe (card with sort control, header line, tiles incl. ghost tiles, table twin).
   K.loot.get() → {byDungeon: Map(rd|boss → [{id|null, name, slots[], where, kind 'donjon'|'raid', byName, via?}]), bySlot: {slot: [same]}, good}
     (weak slot = ilvl < T.slotIlvlGood; id match when both sides have one, else name; worn items excluded).
   K.loot.li(entry, withWhere) · K.loot.foot(good) — shared list line + footnote (dungeon sheet, slot sheet).
   K.loot.ids(text) → 6-digit ids in a research string. Sheet 'sem-dungeon' (arg = pool index). Verb sem-sort. */
(function (K) {
  'use strict';
  const { h, icon, raw } = K;
  const F = K.fmt, U = K.util, UI = K.ui, C = K.CONFIG, isNum = U.isNum;
  const ids = s => (U.str(s).match(/\b\d{6}\b/g) || []).map(Number);
  const nameOf = s => U.str(s).split(/\s[(—]/)[0].trim();

  /* ---------- loot map (P1-5): weak slots (ilvl < T.slotIlvlGood) × research dungeon / boss loot ----------
     Wanted = research BiS text per slot + research trinkets. A loot line matches by item id when both sides carry one,
     otherwise by normalised name (entry.byName → «correspondance par nom»); a research trinket whose `source` names the
     dungeon / boss also counts (entry.via = 'source'). Items already worn (same id or same name) are skipped. */
  const TRK = ['trinket1', 'trinket2'];
  const flat = t => U.fold(t).replace(/['’‘`´]/g, '');
  const idAfter = (text, name) => {                            // id written right after the name in the BiS text, if any
    const f = flat(text), n = flat(name), i = f.indexOf(n);
    if (i < 0 || !n) return null;
    const m = /^[^()+]{0,40}?\(([^)]*)\)/.exec(f.slice(i + n.length));
    const x = m && m[1].match(/\b\d{6}\b/);
    return x ? Number(x[0]) : null;
  };
  K.derive('loot', ctx => {
    const M = ctx.M, R = ctx.R, good = ctx.T.slotIlvlGood, g = s => M.gear[s];
    const weak = s => g(s) && g(s).present && isNum(g(s).ilvl) && isNum(good) && g(s).ilvl < good;
    const worn = new Set(K.SLOTS.map(s => g(s).present && g(s).id).filter(isNum));
    const wornN = new Set(K.SLOTS.map(s => (g(s).present ? U.normName(g(s).name) : '')).filter(Boolean));
    const want = R.bisBySlot.map(b => {
      const raw = U.str(b.raid) + ' + ' + U.str(b.mplus);
      return { slots: K.expandSlots([b.slot]).filter(x => K.SLOTS.includes(x)), ids: ids(raw), raw, nt: U.normName(raw) };
    });
    const trk = R.trinkets.mplus.concat(R.trinkets.raid).filter(t => U.str(t.name));
    trk.forEach(t => want.push({ slots: TRK, ids: isNum(t.itemId) ? [t.itemId] : [], nk: U.normName(t.name), tid: isNum(t.itemId) ? t.itemId : null }));
    const byDungeon = new Map(), bySlot = {};
    const add = (src, e) => {
      const list = byDungeon.get(src) || [];
      if (list.some(x => (e.id != null && x.id === e.id) || U.normName(x.name) === U.normName(e.name))) return;
      list.push(e); byDungeon.set(src, list);
      e.slots.forEach(s => { (bySlot[s] = bySlot[s] || []).push(e); });
    };
    const scan = (src, lines, where, kind) => lines.forEach(line => {
      const id = ids(line)[0] || null, name = nameOf(line), nk = U.normName(name);
      if ((id != null && worn.has(id)) || (nk && wornN.has(nk))) return;
      let sl = [], byName = false;
      want.forEach(w => {
        let hit = id != null && w.ids.includes(id), nm = false;
        if (!hit && nk.length >= 6) {
          if (w.nk) nm = w.nk === nk && !(w.tid != null && id != null && w.tid !== id);
          else if (w.nt.includes(nk)) { const wid = idAfter(w.raw, name); nm = !(wid != null && id != null && wid !== id); }
          hit = nm;
        }
        if (!hit) return;
        const ws = w.slots.filter(weak);
        if (ws.length) { sl = sl.concat(ws); if (nm) byName = true; }
      });
      sl = U.uniq(sl);
      if (sl.length) add(src, { id, name, slots: sl, where, kind, byName });
    });
    const pools = R.mplus.dungeons.map(d => [d, d.loot, d.name, 'donjon']).concat(R.raid.bosses.map(b => [b, b.loot, b.name, 'raid']));
    pools.forEach(p => scan(p[0], p[1], p[2], p[3]));
    trk.forEach(t => {                                         // «source» of a research trinket = this dungeon / boss
      const src = U.normName(nameOf(t.source)), ws = TRK.filter(weak);
      if (!src || !ws.length || (isNum(t.itemId) && worn.has(t.itemId)) || wornN.has(U.normName(t.name))) return;
      pools.forEach(p => { if (U.normName(p[2]) === src) add(p[0], { id: isNum(t.itemId) ? t.itemId : null, name: U.str(t.name), slots: ws, where: p[2], kind: p[3], byName: false, via: 'source' }); });
    });
    const all = []; byDungeon.forEach(l => l.forEach(e => all.push(e)));
    window.__LYARA__.loot = { weak: K.SLOTS.filter(weak).length, entries: all.length, byName: all.filter(e => e.byName).length, sources: byDungeon.size };
    return { byDungeon, bySlot, good };
  });
  /* one line of the loot map (dungeon sheet, slot sheet): name → slots · «correspondance par nom» */
  const lootLi = (e, withWhere) => h`<li><span class="ink">${e.name}</span>${withWhere ? h` · ${e.kind === 'raid' ? 'raid, ' : ''}${e.where}` : h` → ${e.slots.map(s => K.SLOT_FR[s]).join(', ')}`}${e.byName ? h` <span class="chip">correspondance par nom</span>` : ''}${e.via === 'source' ? h` <span class="chip">source indiquée par la recherche</span>` : ''}</li>`;
  const lootFoot = good => h`<p class="t-cap muted">Calcul KATA : emplacements sous ${isNum(good) ? good : F.DASH} (seuil « bon » de la recherche). Correspondance par numéro d'objet avec la BiS et les bijoux de la recherche, sinon par nom (signalé) ; butin tel que noté par la recherche.</p>`;
  K.loot = { get: () => K.get('loot'), ids, nameOf, li: lootLi, foot: lootFoot };

  /* ---------- tiles ---------- */
  const parTips = rd => { for (const t of U.arr(rd && rd.tips)) { const m = /Minuteur (\d{1,2}):(\d\d)/.exec(t); if (m) return (+m[1] * 60 + +m[2]) * 1e3; } return null; };
  const parOf = d => (d.best && isNum(d.best.par) ? d.best.par : d.week && isNum(d.week.par) ? d.week.par : parTips(d.rd));
  const lootN = (d, L) => (d.rd && L.byDungeon.get(d.rd) ? L.byDungeon.get(d.rd).length : 0);
  const speed = d => { const p = parOf(d); return isNum(d.gain) && isNum(p) ? d.gain / (p / 6e4 + C.keyOverheadMin) : null; };
  const marginR = d => (d.best && isNum(d.best.clear) && isNum(d.best.par) && d.best.par > 0 ? (d.best.par - d.best.clear) / d.best.par : null);
  const desc = f => (a, b) => { const x = f(a), y = f(b); return (isNum(y) ? y : -Infinity) - (isNum(x) ? x : -Infinity); };
  const SORTS = {
    cote: desc(d => d.gain),
    loot: (a, b, L) => lootN(b, L) - lootN(a, L) || desc(d => d.gain)(a, b),
    speed: desc(speed),
    marge: (a, b) => { const x = marginR(a), y = marginR(b); return (isNum(x) ? x : Infinity) - (isNum(y) ? y : Infinity); }
  };
  const MODES_FIT = [['cote', 'Cote'], ['loot', 'Loot'], ['speed', 'Rapidité']], MODES_NOFIT = [['marge', 'Marge'], ['loot', 'Loot']];
  const P2 = (C.chest.plus2 / 1.15 * 100).toFixed(2) + '%', P3 = (C.chest.plus3 / 1.15 * 100).toFixed(2) + '%';

  const timer = b => {
    if (!b || !isNum(b.clear) || !isNum(b.par) || b.par <= 0) return '';
    const r = b.clear / b.par, p = Math.min(r, 1.15) / 1.15 * 100;
    return h`<span class="rt-bar" aria-hidden="true"><i class="rt-f"${K.vars({ '--p': p.toFixed(1) + '%' })}></i><i class="rt-t"${K.vars({ '--x': P3 })}></i><i class="rt-t"${K.vars({ '--x': P2 })}></i><i class="rt-par"></i>${r > 1.15 ? raw('<i class="rt-ov"></i>') : ''}</span>`;
  };
  const gainTxt = (d, fit) => (isNum(d.gain) && fit ? '≈ +' + F.int(d.gain) + ' (±' + F.int(fit.sigma) + ')' : null);
  const tile = (d, i, x) => {
    const b = d.best, fit = x.rd.fit, g = gainTxt(d, fit), ln = lootN(d, x.L);
    if (x.off) {
      return h`<button type="button" class="rt" data-act="sheet" data-sheet="sem-dungeon" data-arg="${i}"><span class="rt-h"><span class="rt-s">${d.short || F.DASH}</span> <span class="rt-n">${d.name || F.DASH}</span></span><span class="rt-l"><span class="num rt-lv">${F.DASH}</span></span><span class="t-cap muted">Conseils de la recherche</span></button>`;
    }
    const up = b && isNum(b.upgrades) && b.upgrades > 1 ? b.upgrades : null;
    return h`<button type="button" class="rt${d.ghost ? ' rt-ghost' : ''}${d.uncertain ? ' is-basse' : ''}" data-act="sheet" data-sheet="sem-dungeon" data-arg="${i}">
      <span class="rt-h"><span class="rt-s">${d.short || F.DASH}</span> <span class="rt-n">${d.name || F.DASH}</span></span>
      ${d.ghost ? h`<span class="rt-g">Pas encore fait${g ? ' · ' + g : ''}</span>`
        : h`<span class="rt-l"><span class="num rt-lv">+${isNum(b.level) ? b.level : '?'}</span>${up ? h`<span class="rt-up num" aria-label="${'coffre +' + up}">+${up}</span>` : ''}<span class="rt-m num">${b.timed === false ? icon('alert', 'i-sm') : ''}${F.margin(b.clear, b.par)}</span></span>${timer(b)}`}
      <span class="rt-b">${g && !d.ghost ? h`<span class="chip">${g}</span>` : ''}${d.retime ? h`<span class="chip rt-re">${icon('clock', 'i-sm')}À re-timer</span>` : ''}${d.extrapolated ? h`<span class="chip">hors de tes niveaux mesurés</span>` : ''}${ln && isNum(d.gain) ? h`<span class="chip">2-en-1</span>` : ''}${d.uncertain ? h`<span class="chip">correspondance incertaine</span>` : ''}</span>
    </button>`;
  };

  const radar = (E, c) => {
    const rd = E.radar, M = c.M, fit = rd.fit, L = K.loot.get();
    const loadingNow = M.source === 'none' && (K.net.profile.state === 'loading' || K.net.profile.state === 'retrying');
    const off = M.best === undefined;
    const modes = fit ? MODES_FIT : MODES_NOFIT;
    let mode = K.store.get('ui.radarSort', 'cote');
    if (!modes.some(m => m[0] === mode)) mode = modes[0][0];
    const idx = rd.pool.map((d, i) => [d, i]);
    if (!off) idx.sort((a, b) => SORTS[mode](a[0], b[0], L) || a[1] - b[1]);
    const top3 = rd.pool.map(d => d.gain).filter(isNum).sort((a, b) => b - a).slice(0, 3);
    const head = off ? 'Hors ligne · conseils de la recherche uniquement'
      : !fit ? 'Gain non estimable : pas assez de runs (3 niveaux différents requis)'
        : rd.additive ? '≈ +' + F.int(U.sum(top3)) + ' sur ta cote cette semaine (estimation, 3 meilleures clés)'
          : 'Gains exprimés en score de donjon · conversion en cote non vérifiée sur tes données';
    const x = { rd, L, off };
    return h`<div class="card sem-radar" data-qa="radar"><div class="card-h"><h2 class="card-t">Radar de clés</h2>${off ? UI.provResearch() : fit ? UI.prov('estimate') : UI.provM(M)}</div>
      ${!off && rd.pool.length ? h`<div class="seg" role="group" aria-label="Trier les donjons">${modes.map(m => h`<button type="button" data-act="sem-sort" data-arg="${m[0]}" aria-pressed="${m[0] === mode ? 'true' : 'false'}">${m[1]}</button>`)}</div>` : ''}
      <p class="t-call ink2 sem-rh">${head}</p>
      ${fit && !off ? h`<p class="t-cap muted">Ajustement sur tes ${fit.n} clés dans les temps : ≈ ${F.num(fit.b, 1)} points par niveau (±${F.num(fit.sigma, 1)}), niveaux +${fit.lo} à +${fit.hi}.</p>` : ''}
      ${loadingNow ? h`<div class="rt-grid">${Array.from({ length: 8 }, () => UI.skel(112))}</div>`
        : rd.pool.length ? h`<div class="rt-grid">${idx.map(p => tile(p[0], p[1], x))}</div>` : UI.empty('Liste des donjons indisponible')}
      ${!off && rd.pool.some(d => d.best && isNum(d.best.par)) ? h`<p class="t-cap muted sem-mt">Barre : ton temps sur le minuteur. Traits fins ~ : seuils +3 et +2 (≈ ${Math.round(C.chest.plus3 * 100)} % et ${Math.round(C.chest.plus2 * 100)} % du temps, à vérifier).</p>` : ''}
      ${!off && rd.pool.length ? h`<details data-key="rt-tbl"><summary class="t-call">Voir en tableau</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Donjon</th><th>Meilleure</th><th>Marge</th><th>Cible</th><th>Gain</th></tr></thead><tbody>
        ${idx.map(p => { const d = p[0], b = d.best; return h`<tr><td>${d.short || d.name}</td><td class="num">${b ? '+' + b.level + (b.timed === false ? ' (hors temps)' : '') : 'Pas encore fait'}</td><td class="num">${b ? F.margin(b.clear, b.par) : F.DASH}</td><td class="num">${isNum(d.target) ? '+' + d.target : F.DASH}</td><td class="num">${gainTxt(d, fit) || F.DASH}</td></tr>`; })}
      </tbody></table></div></details>` : ''}</div>`;
  };
  K.act('sem-sort', el => { const m = el.getAttribute('data-arg'); if (SORTS[m]) { K.store.set('ui.radarSort', m); K.invalidate('radar'); } });

  /* ---------- P1-8 «Et si…»: level stepper → Theil–Sen prediction ±σ and gain vs his best (disabled without a fit) ---------- */
  const wi = { key: null, lv: null };
  const whatIf = (d, E) => {
    const fit = E.radar.fit, b = d.best;
    if (wi.key !== d.key || !isNum(wi.lv)) { wi.key = d.key; wi.lv = isNum(d.target) ? d.target : isNum(E.radar.comfort) ? Math.round(E.radar.comfort) : 10; }
    const L = wi.lv, pred = fit ? fit.a + fit.b * L : null, gain = isNum(pred) ? Math.max(0, pred - (b && isNum(b.score) ? b.score : 0)) : null;
    const ext = !!fit && (L < fit.lo - 1 || L > fit.hi + 1);
    return h`<div data-qa="whatif"><div class="card-h"><p class="over">Et si…</p>${fit ? UI.prov('estimate') : ''}</div>
      <div class="wi-row">${UI.stepper('whatif-lv', 'niveau de clé', '+' + L, { lo: !fit || L <= 2, hi: !fit || L >= 30 })}
        <p class="t-call wi-out">${fit ? h`+${L} dans les temps ≈ <span class="num ink">${F.int(pred)}</span> (±${F.int(fit.sigma)}) → ≈ +${F.int(gain)}` : h`<span class="ink2">${UI.unknown(K.M.best === undefined ? 'Meilleures clés indisponibles' : 'Il faut au moins 4 clés dans les temps sur 3 niveaux différents')} Gain non estimable : pas assez de runs (3 niveaux différents requis)</span>`}</p></div>
      ${fit ? h`<p class="t-cap muted">Score de donjon prédit par l'ajustement sur tes clés dans les temps (≈ ${F.num(fit.b, 1)} points par niveau)${b && isNum(b.score) ? ', comparé à ta meilleure ici (' + F.num(b.score, 1) + ')' : ''}. Aucun minuteur n'est simulé.${ext ? ' Hors de tes niveaux mesurés : estimation fragile.' : ''}</p>` : ''}</div>`;
  };
  K.act('whatif-lv', el => { if (!isNum(wi.lv)) return; wi.lv = U.clamp(wi.lv + UI.stepDir(el), 2, 30); K.sheet.refresh(); });

  /* ---------- dungeon sheet ---------- */
  const poolAt = i => { try { return K.engine.get().radar.pool[Number(i)] || null; } catch (e) { return null; } };
  const runLine = r => h`+${r.level} · ${r.timed === true ? 'dans les temps (' + F.margin(r.clear, r.par) + ')' : r.timed === false ? 'hors temps (' + F.margin(r.clear, r.par) + ')' : F.DASH}${isNum(r.score) ? ' · ' + F.num(r.score, 1) + ' points' : ''} · ${F.ddmm(r.at)}`;
  K.sheet.define('sem-dungeon', {
    title: i => { const d = poolAt(i); return d ? d.name || d.short || 'Donjon' : 'Donjon'; },
    qa: 'dungeon',
    render(i, c) {
      const d = poolAt(i);
      if (!d) return UI.empty('Donjon introuvable');
      const E = K.engine.get(), fit = E.radar.fit, b = d.best, rd = d.rd, par = parOf(d), M = c.M, off = M.best === undefined;
      const lt = rd ? K.loot.get().byDungeon.get(rd) || [] : [];
      const tgt = !isNum(d.target) ? null : !b ? 'ton niveau confortable − 1' : b.timed ? 'un niveau au-dessus de ta meilleure' : 'la même clé, dans les temps';
      return h`${d.uncertain ? h`<p class="callout">${icon('alert', 'i-sm')} Correspondance incertaine avec la recherche : conseils indisponibles pour ce donjon.</p>` : ''}
        <div><div class="card-h"><p class="over">Ta meilleure clé</p>${off ? '' : UI.provM(M)}</div>
          ${off ? h`<p class="t-call ink2">${UI.unknown('Hors ligne : meilleures clés indisponibles')} Indisponible hors ligne</p>` : b ? h`<p class="t-call num">${runLine(b)}</p>${b.url ? h`<p><a class="inline" href="${b.url}" target="_blank" rel="noopener noreferrer">Voir le run sur raider.io</a></p>` : ''}` : h`<p class="t-call">Pas encore fait cette saison.</p>`}
          ${d.week ? h`<p class="t-cap ink2">Cette semaine : ${runLine(d.week)}</p>` : ''}</div>
        ${!off && isNum(d.target) ? h`<div><div class="card-h"><p class="over">Prochaine cible</p>${UI.prov('estimate')}</div>
          <p class="t-h2 num">+${d.target}${isNum(d.gain) && fit ? h` <span class="t-call ink2">≈ +${F.int(d.gain)} (±${F.int(fit.sigma)}) points de donjon</span>` : ''}</p>
          <p class="t-cap ink2">Cible : ${tgt}.${d.extrapolated ? ' Hors de tes niveaux mesurés : estimation fragile.' : ''}${!fit ? ' Gain non estimable : pas assez de runs.' : ''}</p></div>` : ''}
        ${UI.safeSection('whatif', () => whatIf(d, E))}
        ${isNum(par) ? h`<p class="t-call">Minuteur ${F.dur(par)} · +2 sous ≈ ${F.dur(par * C.chest.plus2)} · +3 sous ≈ ${F.dur(par * C.chest.plus3)} ${UI.conf(C.chest.conf)}</p><p class="t-cap muted">${b && isNum(b.par) ? 'Minuteur lu sur raider.io' : 'Minuteur de la recherche'} · seuils +2/+3 à vérifier.</p>` : ''}
        ${rd && rd.tips.length ? h`<div><div class="card-h"><p class="over">Conseils</p><span class="nowrap">${UI.provResearch()} ${K.pv.conf(rd.confidence, rd.sources)}</span></div><ul class="list-dot">${rd.tips.map(t => h`<li>${t}</li>`)}</ul></div>` : ''}
        ${rd && rd.loot.length ? h`<div><p class="over">Butin noté par la recherche</p><ul class="list-dot">${rd.loot.map(t => h`<li>${t}</li>`)}</ul></div>` : ''}
        <div class="btn-row"><button type="button" class="btn" data-act="pv-open" data-arg="${'k:' + Number(i)}">${icon('shield')}<span>Préparer cette clé</span></button></div>
        ${lt.length ? h`<div class="callout" data-qa="loot-dj"><div class="card-h"><p class="over">Butin utile pour toi</p>${UI.prov('calc')}</div><ul class="list-dot">${lt.map(e => lootLi(e, false))}</ul>${lootFoot(c.T.slotIlvlGood)}</div>` : ''}`;
    }
  });

  K.weekUI = Object.assign(K.weekUI || {}, { radar, parOf });
})(KATA);
