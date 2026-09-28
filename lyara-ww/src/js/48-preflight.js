/* 48-preflight.js — P1-6 «Pré-vol» sheet (Maintenant «Pré-vol · 20 s», dungeon sheet «Préparer cette clé», Semaine raid
   card «Préparer le raid»). Stage 5.
   Mode «Clé»: dungeon select (radar pool), best run + margin, target level (the radar tile target, ≈ gain ±σ), 3 research
   tips, affixes (live, else research) + the season affix system, top 3 research defensives.
   Mode «Raid»: boss select (research order), that boss's tips and loot (+ the loot-map matches for weak slots).
   Both: consumables checklist (R.consumables, 48 px rows) stored in W.preflight {at, checked{index: true}} and reset 6 h
   after the first tick, plus the enchants still missing live.
   Verbs: pv-open (arg 'k' | 'k:<pool index>' | 'r' | 'r:<boss order>') · pv-mode (k|r) · pv-dj / pv-boss (change) ·
   pv-ck (consumable index) · pv-clear. Hook data-qa="preflight". */
(function (K) {
  'use strict';
  const { h, icon } = K;
  const F = K.fmt, U = K.util, UI = K.ui, isNum = U.isNum;
  const SF = s => K.SLOT_FR[s] || s;
  const HOLD = 6 * 36e5;
  const st = { mode: 'k', key: null, boss: null };
  const pool = () => { try { return K.engine.get().radar.pool; } catch (e) { return []; } };
  const bosses = () => K.R.raid.bosses.filter(b => isNum(b.order)).sort((a, b) => a.order - b.order);
  const defDungeon = P => { const g = P.filter(d => d.rd && isNum(d.gain)).sort((a, b) => b.gain - a.gain)[0]; return (g || P.find(d => d.rd) || P[0] || {}).key || null; };
  const defBoss = () => { const r = K.M.raid, bs = bosses(), k = r && isNum(r.mythic_bosses_killed) ? r.mythic_bosses_killed : 0; return (bs[k] || bs[0] || {}).order; };

  /* W.preflight: reset 6 h after the first tick */
  const pf = () => {
    const W = K.store.week(), p = U.isObj(W.preflight) ? W.preflight : (W.preflight = { at: null, checked: {} });
    if (!U.isObj(p.checked)) p.checked = {};
    if (isNum(p.at) && Date.now() - p.at > HOLD) { p.at = null; p.checked = {}; K.store.saveWeek(); }
    return p;
  };

  const block = (title, chip, body) => h`<div><div class="card-h"><p class="over">${title}</p>${chip || ''}</div>${body}</div>`;
  const runTxt = r => h`+${r.level} · ${r.timed === true ? 'dans les temps (' + F.margin(r.clear, r.par) + ')' : r.timed === false ? 'hors temps (' + F.margin(r.clear, r.par) + ')' : F.DASH}`;

  const keyMode = c => {
    const P = pool(), E = K.engine.get(), fit = E.radar.fit, M = c.M, off = M.best === undefined;
    if (!P.length) return UI.empty('Liste des donjons indisponible');
    if (!P.some(d => d.key === st.key)) st.key = defDungeon(P);
    const i = Math.max(0, P.findIndex(d => d.key === st.key)), d = P[i], rd = d.rd, b = d.best;
    const aff = c.aux.affixes, list = aff.data && aff.data.list && aff.data.list.length ? aff.data.list : null;
    const rs = U.str(c.R.mplus.affixes.thisWeek), sys = U.str(c.R.mplus.affixes.system), def = c.R.rotation.defensives.slice(0, 3);
    return h`<label class="field"><span>Donjon</span><select class="input" data-change="pv-dj" data-key="pv-dj">${P.map((x, j) => h`<option value="${j}"${j === i ? K.raw(' selected') : ''}>${x.short ? x.short + ' · ' : ''}${x.name || F.DASH}</option>`)}</select></label>
      ${block('Ta meilleure ici', off ? '' : UI.provM(M), off ? h`<p class="t-call ink2">${UI.unknown('Hors ligne : meilleures clés indisponibles')} Indisponible hors ligne</p>`
        : b ? h`<p class="t-call num">${runTxt(b)}${isNum(b.score) ? ' · ' + F.num(b.score, 1) + ' points' : ''}</p>` : h`<p class="t-call">Pas encore fait cette saison.</p>`)}
      ${!off && isNum(d.target) ? block('Cible', UI.prov('estimate'), h`<p class="t-h2 num">+${d.target}${isNum(d.gain) && fit ? h` <span class="t-call ink2">≈ +${F.int(d.gain)} (±${F.int(fit.sigma)}) points de donjon</span>` : ''}</p><p class="t-cap ink2">${b ? (b.timed ? 'Un niveau au-dessus de ta meilleure.' : 'La même clé, dans les temps d\'abord.') : 'Ton niveau confortable − 1.'}</p>`) : ''}
      ${rd && rd.tips.length ? block('Conseils', h`<span class="nowrap">${UI.provResearch()} ${K.pv.conf(rd.confidence, rd.sources)}</span>`, h`<ul class="list-dot">${rd.tips.slice(0, 3).map(t => h`<li>${t}</li>`)}</ul>`) : d.uncertain ? h`<p class="t-cap muted">Correspondance incertaine avec la recherche : pas de conseils pour ce donjon.</p>` : ''}
      ${block('Affixes', list ? (aff.state === 'cached' ? UI.prov('cached', F.rel(aff.at)) : UI.prov('live', F.hhmm(aff.at))) : rs ? UI.provResearch() : '',
        h`${list ? h`<div class="chips">${list.map(x => h`<span class="chip">${x.name}</span>`)}</div>` : rs ? h`<p class="t-call">${rs}</p>` : UI.empty('Affixes indisponibles')}${sys ? h`<p class="t-cap ink2 pv-sys">${UI.provResearch()} ${sys}</p>` : ''}`)}
      ${def.length ? block('Défensifs', h`<span class="nowrap">${UI.provResearch()} ${K.pv.conf(c.R.rotation.confidence, c.R.rotation.sources)}</span>`, h`<ul class="list-dot">${def.map(t => h`<li>${t}</li>`)}</ul>`) : ''}`;
  };

  const raidMode = c => {
    const bs = bosses();
    if (!bs.length) return UI.empty('Liste des boss indisponible');
    if (!bs.some(b => b.order === st.boss)) st.boss = defBoss();
    const b = bs.find(x => x.order === st.boss) || bs[0], lt = K.loot.get().byDungeon.get(b) || [];
    return h`<label class="field"><span>Boss</span><select class="input" data-change="pv-boss" data-key="pv-boss">${bs.map(x => h`<option value="${x.order}"${x.order === b.order ? K.raw(' selected') : ''}>${x.order} · ${x.name || 'Boss'}</option>`)}</select></label>
      <p class="t-cap muted">${c.R.raid.name || 'Raid'} · ordre de la recherche (supposé).</p>
      ${b.tips.length ? block('Conseils', h`<span class="nowrap">${UI.provResearch()} ${K.pv.conf(b.confidence, b.sources)}</span>`, h`<ul class="list-dot">${b.tips.map(t => h`<li>${t}</li>`)}</ul>`) : ''}
      ${b.loot.length ? block('Butin (recherche)', UI.provResearch(), h`<ul class="list-dot">${b.loot.map(t => h`<li>${t}</li>`)}</ul>`) : h`<p class="t-cap muted">Pas de butin noté par la recherche pour ce boss.</p>`}
      ${lt.length ? h`<div class="callout"><div class="card-h"><p class="over">Utile pour toi</p>${UI.prov('calc')}</div><ul class="list-dot">${lt.map(e => K.loot.li(e, false))}</ul>${K.loot.foot(c.T.slotIlvlGood)}</div>` : ''}`;
  };

  const TYPE = { flacon: 'Flacon', nourriture: 'Nourriture', potion: 'Potion', huile: 'Huile', rune: 'Rune' };
  const common = c => {
    const p = pf(), cs = c.R.consumables, n = cs.filter((x, i) => p.checked[i] === true).length, E = K.engine.get(), en = E.ench;
    const rec = s => { const e = c.R.enchants.find(x => x.slot === String(s).replace(/[12]$/, '')); return e && e.name ? e.name : null; };
    return h`${cs.length ? h`<div data-qa="pv-cons"><div class="card-h"><p class="over">Consommables · <span class="num">${n}/${cs.length}</span></p><span class="nowrap">${UI.provResearch()}${n ? h`<button type="button" class="btn btn-ghost btn-sm" data-act="pv-clear">${icon('cross', 'i-sm')}<span>Tout décocher</span></button>` : ''}</span></div>
        <ul class="pv-list">${cs.map((x, i) => h`<li class="pv-row"><button type="button" class="pv-ck" data-act="pv-ck" data-arg="${i}" aria-pressed="${p.checked[i] === true ? 'true' : 'false'}"><span class="pv-box" aria-hidden="true">${p.checked[i] === true ? icon('check', 'i-sm') : ''}</span><span class="grow"><span class="t-cap ink2">${TYPE[x.type] || U.str(x.type) || 'Consommable'}</span><br><span class="ink any">${x.name}</span></span></button>${K.pv.conf(x.confidence, x.sources)}</li>`)}</ul>
        <p class="t-cap muted">${p.at ? 'Coches remises à zéro 6 h après la première (vers ' + F.hhmm(p.at + HOLD) + ').' : 'Les coches se remettent à zéro 6 h après la première.'}</p></div>` : ''}
      ${block('Enchants', en && en.evaluable ? UI.provM(c.M) : '', !en || !en.evaluable ? h`<p class="t-call ink2">${UI.unknown(en && en.reason ? en.reason : 'Enchants inconnus')} ${en && en.reason ? en.reason : 'Enchants inconnus'}</p>`
        : en.hit ? h`<ul class="list-dot">${en.evidence.map(s => h`<li><span class="ink">${SF(s)}</span> · aucun enchant${rec(s) ? h` · conseillé : ${rec(s)}` : ''}</li>`)}</ul>` : h`<p class="t-call">Tous les emplacements visés sont enchantés.</p>`)}`;
  };

  K.sheet.define('prevol', {
    title: 'Pré-vol',
    qa: 'preflight',
    render(arg, c) {
      return h`<div class="seg pv-seg" role="group" aria-label="Préparer"><button type="button" data-act="pv-mode" data-arg="k" aria-pressed="${st.mode === 'k' ? 'true' : 'false'}">${icon('key', 'i-sm')}<span>Clé</span></button><button type="button" data-act="pv-mode" data-arg="r" aria-pressed="${st.mode === 'r' ? 'true' : 'false'}">${icon('skull', 'i-sm')}<span>Raid</span></button></div>
        ${UI.safeSection('pv-' + st.mode, () => (st.mode === 'r' ? raidMode(c) : keyMode(c)))}${UI.safeSection('pv-common', () => common(c))}`;
    }
  });
  K.act('pv-open', el => {
    const a = String(el.getAttribute('data-arg') || 'k').split(':');
    st.mode = a[0] === 'r' ? 'r' : 'k';
    if (st.mode === 'k' && a[1] != null) { const d = pool()[Number(a[1])]; if (d) st.key = d.key; }
    if (st.mode === 'r' && a[1] != null && isNum(Number(a[1]))) st.boss = Number(a[1]);
    K.sheet.open('prevol', null, el);
  });
  K.act('pv-mode', el => { st.mode = el.getAttribute('data-arg') === 'r' ? 'r' : 'k'; K.sheet.refresh(); });
  K.onChange('pv-dj', el => { const d = pool()[parseInt(el.value, 10)]; if (d) { st.key = d.key; K.sheet.refresh(); } });
  K.onChange('pv-boss', el => { const v = parseInt(el.value, 10); if (isNum(v)) { st.boss = v; K.sheet.refresh(); } });
  K.act('pv-ck', el => {
    const i = String(Number(el.getAttribute('data-arg'))), p = pf();
    if (!(Number(i) >= 0 && Number(i) < K.R.consumables.length)) return;
    if (p.checked[i]) delete p.checked[i]; else { p.checked[i] = true; if (!isNum(p.at)) p.at = Date.now(); }
    if (!Object.keys(p.checked).length) p.at = null;
    K.store.saveWeek();
    K.sheet.refresh();
  });
  K.act('pv-clear', () => { const p = pf(); p.checked = {}; p.at = null; K.store.saveWeek(); K.sheet.refresh(); });

  /* entry buttons */
  K.preflight = { button: () => h`<button type="button" class="btn pv-open" data-act="pv-open" data-arg="k" data-qa="pv-open">${icon('shield')}<span>Pré-vol · 20 s</span></button>` };
})(KATA);
