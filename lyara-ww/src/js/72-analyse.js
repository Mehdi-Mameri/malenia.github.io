/* 72-analyse.js — «Analyse», the generated report (spec P0-13, layout §3.5). Stage 3b.
   Everything is rebuilt from K.engine.get() + research on every render, so it can never contradict Maintenant.
   Sections (ids an-<key>): tldr · weak · mirror · gates · plan · spec · debates · sources, each in its own
   safeSection. The header's «Indice de certitude» counts every confidence glyph rendered in the report
   (K.pv.tally). __LYARA__.analyse = {certainty{haute,moyenne,basse}, mirror{k,n,u}, gates{open,unknown}, debates, unknowns}.
   Verbs: an-jump (arg = section key) · hero-tree (change) · embel (i:1|i:0) · proj-per (+|-) · proj-v (+|-|=ilvl|x). */
(function (K) {
  'use strict';
  const { h, icon, raw } = K;
  const F = K.fmt, U = K.util, UI = K.ui;
  const isNum = U.isNum, S_ = U.str;
  const L = window.__LYARA__;
  const SF = s => K.SLOT_FR[s] || s;
  const eng = () => K.engine.get();
  const fm = m => K.engine.fmtMin(m);
  const cg = (l, ids) => K.pv.conf(l, ids);
  const asOf = () => K.research.asOfFR;

  const SECS = [['tldr', 'TL;DR', 'TL;DR'], ['weak', 'Faiblesses', 'Faiblesses par urgence'], ['mirror', 'Eux/Toi', 'Eux | Toi | À faire'],
    ['gates', 'Mythique', 'Portes du Mythique'], ['plan', 'Plan', 'Le plan'], ['spec', 'Spec', 'Position du spec'],
    ['debates', 'Débats', 'Débats et zones d\'ombre'], ['sources', 'Sources', 'Méthode et sources']];
  const TITLE = {};
  SECS.forEach(s => { TITLE[s[0]] = s[2]; });
  const sec = (id, body, chip) => h`<section class="card an-sec" id="an-${id}" aria-labelledby="an-${id}-h"><div class="card-h"><h2 class="t-h1" id="an-${id}-h">${TITLE[id]}</h2>${chip || ''}</div>${body}</section>`;

  const measured = M => (M.source === 'live' ? 'raider.io ' + F.hhmm(M.at) : M.source === 'cached' ? 'cache ' + F.rel(M.at)
    : M.source === 'snapshot' ? 'snapshot du ' + F.ddmm(M.at) : 'aucune donnée');
  const pline = (M, extra) => h`<p class="an-pl">Mesuré : ${measured(M)}${extra ? ' · ' + extra : ''}</p>`;
  const tierTxt = t => t.text;
  const pinnable = a => !!a && a.evaluable && a.hit && !a.done && !a.disputed && a.conf !== 'basse';
  const cta = (a, label) => (pinnable(a) ? h`<button type="button" class="btn btn-sm" data-act="pin" data-arg="${a.id}">${icon('pin')}<span>${a.pinned ? 'Retirer de ce soir' : label || '→ Ajouter à ce soir'}</span></button>` : '');
  const openRule = (E, type) => E.queue.find(a => a.type === type && pinnable(a)) || null;

  /* ---------- header + «Indice de certitude» ---------- */
  const head = (c, tally) => {
    const tot = tally.haute + tally.moyenne + tally.basse;
    const segs = [['h', tally.haute], ['m', tally.moyenne], ['b', tally.basse]].filter(x => x[1]);
    return h`<div class="card an-head"><p class="over an-meta">Rapport du ${F.ddmm(c.now)} · données ${UI.provM(c.M)} · recherche du ${asOf()}</p>
      <p class="lead">Analyse générée à partir de tes données raider.io et de la recherche du ${asOf()} : ce sont des recommandations à vérifier, pas des vérités.</p>
      ${K.research.stale ? h`<p class="t-cap">Recherche du ${asOf()} · la méta a pu bouger</p>` : ''}
      <div class="cert"><p class="t-call ink">Indice de certitude</p>
        <div class="cbar" role="img" aria-label="Indice de certitude : ${tally.haute} haute, ${tally.moyenne} moyenne, ${tally.basse} basse">${tot ? segs.map(x => h`<i class="cb-${x[0]}"${K.vars({ '--g': String(x[1]) })}></i>`) : ''}</div>
        <p class="t-cap ink2 num">${tally.haute} haute · ${tally.moyenne} moyenne · ${tally.basse} basse</p>
        <button type="button" class="btn btn-ghost btn-sm an-cl" data-act="an-jump" data-arg="debates">${icon('split', 'i-sm')}<span>${c.R.disputed.length} débats · ${c.R.unknowns.length} zones d'ombre</span>${icon('chevron', 'i-sm')}</button></div></div>`;
  };

  /* ---------- 2. TL;DR ---------- */
  const tldr = c => {
    const E = eng(), M = c.M, T = c.T, v = E.vault, o = E.campaign, snap = M.source === 'snapshot';
    const ms = c.R.mplus.milestones.filter(m => isNum(m.rating)).sort((a, b) => a.rating - b.rating);
    const nx = isNum(M.score) ? ms.find(m => m.rating > M.score) : null;
    const d = isNum(M.ilvl) && isNum(T.mythicEntryIlvl) ? Math.round((M.ilvl - T.mythicEntryIlvl) * 10) / 10 : null;
    const q = n => (/«/.test(n) ? n : '« ' + n + ' »');
    const s1 = 'iLvl ' + F.ilvl(M.ilvl) + (d !== null ? ' (' + F.signed(d, 1) + ' vs entrée Mythique ' + T.mythicEntryIlvl + ')' : '') +
      ' · tier ' + tierTxt(E.tier) + ' · cote ' + F.int(M.score) + (nx ? ' (' + F.signed(Math.floor(M.score) - nx.rating) + ' du palier ' + q(S_(nx.name)) + ')' : '') + '.';
    const s2 = o.met ? 'Objectif de saison atteint · ' + o.next + '.' : 'Objectif de saison : ' + o.title + (o.progress ? ' · ' + o.progress : '') + ' → ' + o.next + '.';
    const it = E.plan.items;
    const s3 = 'Ce soir (' + E.budgetLabel + ') : ' + (it.length ? it.map(i => i.a.title + (i.units > 1 ? ' ×' + i.units : '')).join(' · ') + ' (≈ ' + fm(E.plan.used) + (E.plan.over ? ', dépasse de ≈ ' + fm(E.plan.over) : '') + ')' : 'rien à planifier dans ce budget') + '.';
    const s4 = 'Coffre : ' + (v.unknown ? (v.open ? '≥ ' + v.open : '—') + '/9 (clés de la semaine indisponibles)' : (v.capped ? '≥ ' : '') + v.open + '/9') + ' · reset dans ' + F.countdown(c.time.left) + '.';
    const hd = c.R.headline, lk = (snap || M.source === 'none') && K.research.isPlayer();
    const busy = M.source !== 'live' && K.net && /^(loading|retrying)$/.test(K.net.profile.state);
    return sec('tldr', h`${busy ? h`<p class="t-cap muted">${icon('ring', 'i-sm')} Données raider.io en cours de chargement…</p>` : ''}${snap ? h`<p class="t-call ink">D'après le snapshot du ${F.ddmm(M.at)} :</p>` : ''}
      <ul class="tl">
        <li><p class="t-body ink">${s1}</p>${pline(M, 'Cibles : recherche du ' + asOf())}</li>
        <li><p class="t-body ink">${s2}</p>${pline(M, o.builtin || (o.a && o.a.system) ? 'objectif : calcul KATA' : 'règle : recherche du ' + asOf())}${cta(o.a)}</li>
        <li><p class="t-body ink">${s3}</p>${pline(M, 'plan : calcul KATA')}</li>
        <li><p class="t-body ink">${s4}</p>${pline(M, 'raid et monde : déclaré · reset : ' + (c.time.source === 'raider.io' ? 'raider.io' : 'calcul · à vérifier'))}</li>
      </ul>
      ${lk ? UI.lastKnownCard() : ''}
      ${hd.title || hd.summary ? h`<div class="an-hd"><div class="card-h"><p class="over">La recherche en bref</p>${UI.provResearch()}</div>
        ${hd.title ? h`<p class="t-h2">${hd.title}</p>` : ''}${hd.summary ? h`<p class="t-call ink2 any">${hd.summary}</p>` : ''}
        ${hd.keyPoints.length ? h`<details class="an-dd" data-key="an-kp"><summary><span class="t-call ink grow">Points clés (${hd.keyPoints.length})</span>${icon('chevron')}</summary><ul class="list-dot">${hd.keyPoints.map(x => h`<li>${x}</li>`)}</ul></details>` : ''}</div>` : ''}`);
  };

  /* ---------- 3. Faiblesses par urgence ---------- */
  const TYPE_FR = { missingEnchant: 'Enchants', missingGem: 'Gemmes', slotIlvlBelow: 'Objets', avgIlvlBelow: 'iLvl moyen', weeklyRunsBelow: 'Grand Coffre',
    vaultNext: 'Grand Coffre', dungeonScoreGap: 'Cote M+', tierCountBelow: 'Tier', raidNotCleared: 'Raid' };
  const URG = [['Critique', 'alert'], ['Haute', 'alert'], ['À surveiller', 'info']];
  const urg = u => h`<span class="urg u-${u}">${icon(URG[u][1], 'i-sm')}<span>${URG[u][0]}</span></span>`;
  const newIlvl = c => (isNum(c.S.settings.newItemIlvl) ? c.S.settings.newItemIlvl : c.R.raid.ilvlByDifficulty.heroic);
  const gain = (a, c, E) => {
    if (a.type === 'dungeonScoreGap' && E.radar.fit) {
      const b = U.maxBy(U.arr(a.weak).filter(d => isNum(d.gain)), 'gain');
      if (b) return '≈ +' + F.int(b.gain) + ' (±' + F.int(E.radar.fit.sigma) + ') de score de donjon · ' + (b.short || b.name) + ' en +' + b.target +
        (b.ghost ? ' · pas encore fait' : '') + (b.extrapolated ? ' · hors de tes niveaux mesurés' : '') + (E.radar.additive ? '' : ' · conversion en cote non vérifiée');
    }
    if (a.type === 'avgIlvlBelow') {
      const p = K.engine.projection(c.M, a.th, newIlvl(c));
      if (p && p.k != null) return '≈ ' + F.count(p.k, 'objet', 'objets') + ' à ' + p.v + ' pour ' + a.th + ' (estimation)';
    }
    return K.nowUI.pips(a.pips, 5, 'Gain');
  };
  const wcard = (a, u, c, E) => h`<article class="wk${a.conf === 'basse' ? ' is-basse' : ''}">
    <div class="wk-h">${urg(u)}<span class="t-cap ink2">${TYPE_FR[a.type] || 'Règle'}</span>${a.system ? UI.prov('calc') : ''}</div>
    <dl class="wk-kv">
      <dt>Symptôme</dt><dd>${K.nowUI.why(a, c)} ${a.system ? '' : UI.provM(c.M)}</dd>
      <dt>Pourquoi</dt><dd class="clamp">${a.system ? 'Seuils du Grand Coffre (règles TWW reconduites · à confirmer)' : a.detail || F.DASH} ${cg(a.conf, a.rule && a.rule.sources)}</dd>
      <dt>Action</dt><dd class="ink">${a.title}</dd>
      <dt>Effort</dt><dd>${a.effort || F.DASH} · ≈ ${fm(a.est)}${a.divisible ? ' par clé' : ''} (estimation)</dd>
      <dt>Gain</dt><dd>${gain(a, c, E)}</dd>
    </dl>${K.nowUI.stateTag(a)}
    <div class="btn-row">${cta(a)}<button type="button" class="btn btn-ghost btn-sm" data-act="sheet" data-sheet="why" data-arg="${a.id}"><span>Pourquoi ?</span>${icon('chevron', 'i-sm')}</button></div></article>`;
  const weak = c => {
    const E = eng();
    const fired = E.queue.filter(a => a.evaluable && a.hit && !a.generic).sort((a, b) => b.s - a.s);
    const n = fired.length, by = [[], [], []];
    fired.forEach((a, i) => { let u = i / n < 0.2 ? 0 : i / n < 0.5 ? 1 : 2; if (!u && (a.conf === 'basse' || a.disputed || a.system)) u = 1; by[u].push(a); });
    const ne = E.queue.filter(a => !a.evaluable && !a.unknownType).length, sp = c.R.standing.weaknesses;
    return sec('weak', h`<h3 class="t-h2">Ton perso</h3>
      ${n ? by.map((l, u) => (l.length ? h`<div class="wk-g"><p class="over">${urg(u)} · ${l.length}</p>${u < 2 ? l.map(a => wcard(a, u, c, E))
        : h`<ul class="rows">${l.map(a => { K.pv.count(a.conf); return K.nowUI.row(a); })}</ul><p class="t-cap muted">Détail (symptôme, pourquoi, effort, gain) dans « Pourquoi ? ».</p>`}</div>` : '')) : UI.empty('Aucune faiblesse mesurée')}
      ${ne ? h`<p class="t-cap muted">${F.count(ne, 'règle non vérifiable', 'règles non vérifiables')} avec ces données : voir « À vérifier en jeu » dans Maintenant.</p>` : ''}
      ${sp.length ? h`<div class="wk-spec"><div class="card-h"><h3 class="t-h2">Le spec</h3>${UI.provResearch()}</div><ul class="list-dot">${sp.map(x => h`<li>${x}</li>`)}</ul>
        <p class="t-cap muted">Faiblesses de la spécialisation selon la recherche, pas mesurées sur ton perso.</p>${K.pv.srcBtn(c.R.standing.sources)}</div>` : ''}`);
  };

  /* ---------- 4. Miroir «Eux | Toi | À faire» ---------- */
  const VD = { ok: ['check', 'aligné'], diff: ['alert', 'différent'], unk: ['dotted', '? non vérifiable'], debate: ['split', 'Débat'] };
  const verdict = v => h`<span class="vd vd-${v}">${icon(VD[v][0], 'i-sm')}<span>${VD[v][1]}</span></span>`;
  const rs = s => String(s).replace(/[12]$/, '');
  const mirrorRows = (c, E) => {
    const { M, R, S } = c, out = [], g = s => M.gear[s], pm = UI.provM(M);
    const item = x => (x && x.present ? h`<span class="any">${x.name || F.DASH}</span> <span class="num ink2">${F.num(x.ilvl)}</span>` : h`<span class="muted">Non renvoyé par raider.io</span>`);
    /* arbre héroïque (live field, else manual select) — the M+ choice is a research debate */
    const trees = R.heroTrees.trees;
    if (trees.length) {
      const man = trees.find(t => t.name === S.heroTreeManual) || null;
      out.push({ label: 'Arbre héroïque', v: K.pv.debates('heroTrees').length ? 'debate' : 'unk', pills: K.pv.pills('heroTrees'),
        eux: trees.map(t => h`<p><span class="ink">${t.name}</span> ${cg(t.confidence, t.sources)}<br><span class="sm">${S_(t.usage) || S_(t.bestFor)}</span></p>`),
        toi: M.heroTree ? h`${M.heroTree} ${pm}` : h`<select class="input" data-change="hero-tree" aria-label="Ton arbre héroïque"><option value="">Choisir…</option>${trees.map((t, i) => h`<option value="${i}"${man === t ? raw(' selected') : ''}>${t.name}</option>`)}</select>
          <span class="t-cap muted">${man ? UI.prov('declared') : ''} raider.io ne l'a pas renvoyé</span>`,
        todo: R.heroTrees.recommendation ? h`<span class="sm">${R.heroTrees.recommendation}</span><button type="button" class="btn btn-ghost btn-sm an-cl" data-act="an-jump" data-arg="spec"><span>Lire en entier</span>${icon('chevron', 'i-sm')}</button>` : 'Simule les deux arbres sur ton perso' });
    }
    /* bijoux: match by itemId; by name only if the research id is null («par nom») */
    const tops = R.trinkets.raid.map(x => [x, 'raid']).concat(R.trinkets.mplus.map(x => [x, 'M+'])).filter(x => x[0].name);
    if (tops.length) {
      const tr = ['trinket1', 'trinket2'].map(s => {
        const x = g(s);
        if (!x.present || x.id == null) return { s, x, unk: true };
        let m = tops.find(t => isNum(t[0].itemId) && t[0].itemId === x.id) || null, byName = false;
        if (!m && x.name) { m = tops.find(t => !isNum(t[0].itemId) && U.normName(t[0].name) === U.normName(x.name)) || null; byName = !!m; }
        const av = x.name ? R.trinkets.avoid.find(t => t.name && U.normName(t.name) === U.normName(x.name)) : null;
        return { s, x, m, byName, av };
      });
      const v = tr.some(t => t.unk) ? 'unk' : tr.some(t => t.av || !t.m) ? 'diff' : 'ok';
      const want = R.trinkets.raid.find(t => !tr.some(z => z.x.present && isNum(t.itemId) && z.x.id === t.itemId));
      out.push({ label: 'Bijoux', v, pills: K.pv.pills('trinkets'),
        eux: h`${[['Raid', R.trinkets.raid], ['M+', R.trinkets.mplus]].map(([l, xs]) => (xs.length ? h`<p><span class="t-cap ink2">${l}</span> ${xs.slice(0, 3).map(t => h`<br>n°${S_(t.rank)} <span class="ink">${S_(t.name)}</span> ${cg(t.confidence, t.sources)}`)}</p>` : ''))}${R.trinkets.pairingRule ? h`<p class="sm">${S_(R.trinkets.pairingRule)}</p>` : ''}`,
        toi: h`${tr.map(t => h`<p>${SF(t.s)} · ${item(t.x)}${t.m ? h` <span class="t-cap ink2">· ${t.m[1]} n°${S_(t.m[0].rank)}${t.byName ? ' · par nom' : ''}</span>` : ''}${t.av ? h`<br><span class="tag">${icon('alert', 'i-sm')}<span>À éviter selon la recherche${t.av.why ? h` : ${S_(t.av.why)}` : ''}</span></span>` : ''}</p>`)} ${pm}`,
        todo: v === 'ok' ? 'Rien à changer : ta paire est dans les listes du top' : v === 'unk' ? 'Vérifie tes bijoux en jeu'
          : want ? h`Vise ${S_(want.name)}${want.source ? h` (${S_(want.source)})` : ''}` : 'Compare tes bijoux aux listes du top' });
    }
    /* arme: his own 21/08 items are not a reference, even if the research lists them */
    if (R.weapons.length) {
      const snap = new Set(R.gearSnapshot.items.map(i => i.itemId).filter(isNum)), mh = g('mainhand');
      const ref = R.weapons.filter(w => w.name && !(isNum(w.itemId) && snap.has(w.itemId)));
      const own = mh.present ? R.weapons.find(w => isNum(w.itemId) && w.itemId === mh.id && snap.has(w.itemId)) : null;
      const v = !mh.present || mh.id == null ? 'unk' : ref.some(w => w.itemId === mh.id) ? 'ok' : 'diff';
      out.push({ label: 'Arme', v, pills: K.pv.pills('weapons'),
        eux: h`${ref.map(w => h`<p><span class="ink">${S_(w.name)}</span> ${w.type ? h`<span class="t-cap ink2">${S_(w.type)}</span>` : ''} ${cg(w.confidence, w.sources)}${w.source ? h`<br><span class="sm">${S_(w.source)}</span>` : ''}</p>`)}${R.crafting.weaponCraftVerdict ? h`<p class="sm">${S_(R.crafting.weaponCraftVerdict)}</p>` : ''}`,
        toi: h`${item(mh)} ${pm}${own && own.note ? h`<br><span class="sm">Recherche : ${S_(own.note)}</span>` : ''}`,
        todo: v === 'diff' && ref[0] ? h`Vise ${S_(ref[0].name)}${ref[0].source ? h` (${S_(ref[0].source)})` : ''}` : v === 'ok' ? 'Rien à changer' : 'Vérifie ton arme en jeu' });
    }
    /* enchants: presence per slot; names compared only when raider.io sends enchants_detail */
    if (R.enchants.length) {
      const ex = K.expandSlots(R.enchants.map(e => e.slot)).filter(s => g(s) && g(s).present);
      const st = ex.map(s => [s, g(s).ench.state]);
      const nOk = st.filter(z => z[1] === 'ok').length, miss = st.filter(z => z[1] === 'manquant').map(z => z[0]), unk = st.filter(z => z[1] === 'inconnu').map(z => z[0]);
      const named = ex.filter(s => g(s).ench.names.length);
      const wrong = named.filter(s => { const r = R.enchants.find(e => e.slot === rs(s)); return r && r.name && !g(s).ench.names.some(n => U.normName(n) === U.normName(r.name)); });
      const v = !st.length || unk.length === st.length ? 'unk' : miss.length || wrong.length ? 'diff' : unk.length ? 'unk' : 'ok';
      const list = xs => xs.map(SF).join(', ');
      out.push({ label: 'Enchants', v, pills: K.pv.pills('enchants'), rule: v === 'diff' ? openRule(E, 'missingEnchant') : null,
        eux: h`<ul class="list-dot">${R.enchants.map(e => h`<li>${SF(e.slot)} · ${e.name || F.DASH} ${cg(e.confidence, e.sources)}</li>`)}</ul>`,
        toi: st.length && unk.length < st.length ? h`<span class="num ink">${nOk}/${st.length}</span> enchantés ${pm}${miss.length ? h`<br>sans enchant : ${list(miss)}` : ''}${unk.length ? h`<br>? : ${list(unk)}` : ''}
          <br><span class="t-cap muted">${named.length ? h`noms raider.io : ${named.map(s => SF(s) + ' ' + g(s).ench.names.join(', ')).join(' · ')}` : 'présence seulement (noms non fournis par raider.io)'}</span>`
          : UI.unknown(M.source === 'snapshot' ? 'Le snapshot ne contient pas les enchants' : 'Enchants non renvoyés par raider.io'),
        todo: miss.length ? 'Enchante : ' + list(miss).toLowerCase() : wrong.length ? 'Compare avec la recherche : ' + list(wrong).toLowerCase() : v === 'ok' ? 'Rien à changer' : 'Vérifie tes enchants en jeu' });
    }
    /* gemmes: raider.io does not expose socket counts → an empty socket list is «?», never «manquant» */
    if (R.gems.length) {
      const ss = U.arr(S.settings.socketSlots).filter(s => g(s) && g(s).present), st = ss.map(s => [s, g(s).gems.state]);
      const known = K.SLOTS.some(s => g(s).present && g(s).gems.state !== 'inconnu');
      const seen = U.sum(K.SLOTS.map(s => (g(s).present && g(s).gems.state === 'ok' ? g(s).gems.count : 0)));
      const empty = st.filter(z => z[1] === 'vide?').map(z => z[0]);
      const v = st.length && st.every(z => z[1] === 'ok') ? 'ok' : 'unk';
      out.push({ label: 'Gemmes', v, pills: K.pv.pills('gems'),
        eux: h`<ul class="list-dot">${R.gems.map(x => h`<li>${x.name} ${cg(x.confidence, x.sources)}</li>`)}</ul>`,
        toi: known ? h`<span class="num ink">${seen}</span> ${seen > 1 ? 'gemmes vues' : 'gemme vue'} ${pm}${empty.length ? h`<br>châsse ? à vérifier : ${empty.map(SF).join(', ')}` : ''}`
          : UI.unknown(M.source === 'snapshot' ? 'Le snapshot ne contient pas les gemmes' : 'Gemmes non renvoyées par raider.io'),
        todo: empty.length ? 'Vérifie en jeu si ces objets ont une châsse' : v === 'ok' ? 'Rien à changer' : 'Vérifie tes gemmes en jeu' });
    }
    /* embellissements: declared by the player (raider.io does not expose them) */
    const em = R.crafting.embellishments.filter(e => U.isObj(e) && S_(e.name));
    if (em.length) {
      const sv = em.map((e, i) => U.obj(S.embellishManual)['e' + i]);
      const v = sv.every(x => x === true) ? 'ok' : sv.some(x => x === false) ? 'diff' : 'unk';
      const pr = (i, b) => (sv[i] === b ? 'true' : 'false');
      out.push({ label: 'Embellissements', v,
        eux: em.map(e => h`<p><span class="ink">${S_(e.name)}</span> · ${SF(S_(e.slot))}${e.note ? h`<br><span class="sm">${S_(e.note)}</span>` : ''}</p>`),
        toi: h`${em.map((e, i) => h`<div class="emb"><span class="t-call">${S_(e.name)} · ${SF(S_(e.slot))}</span><span class="btn-row"><button type="button" class="btn btn-sm" data-act="embel" data-arg="${i}:1" aria-pressed="${pr(i, true)}">Oui</button><button type="button" class="btn btn-sm" data-act="embel" data-arg="${i}:0" aria-pressed="${pr(i, false)}">Non</button></span></div>`)}${UI.prov('declared')} <span class="t-cap muted">raider.io ne les expose pas</span>`,
        todo: v === 'ok' ? 'Rien à changer' : v === 'diff' ? 'Crafte : ' + em.filter((e, i) => sv[i] === false).map(e => S_(e.name) + ' (' + SF(S_(e.slot)).toLowerCase() + ')').join(', ') : 'Déclare tes embellissements' });
    }
    /* tier */
    const t = E.tier, ts = R.tierSet, o = E.campaign;
    const vt = t.count >= 4 ? 'ok' : t.count + t.unknown < 4 ? 'diff' : 'unk';
    out.push({ label: 'Tier', v: vt, pills: K.pv.pills('tier'), rule: vt === 'diff' ? openRule(E, 'tierCountBelow') : null,
      eux: h`<span class="ink">${ts.name || 'Set de tier'}</span> · 4 pièces ${cg(ts.confidence, ts.sources)}${ts.fourPiece ? h`<br><span class="sm">${S_(ts.fourPiece)}</span>` : ''}`,
      toi: h`<span class="num ink">${tierTxt(t)}</span> ${pm}`,
      todo: h`${o.type === 'tierCountBelow' && !o.met ? o.next : vt === 'ok' ? 'Rien à changer' : t.unknown ? 'Confirme tes pièces de tier' : 'Voir le chemin du tier dans Stuff'}${t.unknown && M.gearPresent ? h`<br><button type="button" class="btn btn-sm" data-act="sheet" data-sheet="meter" data-arg="tier">${icon('crown')}<span>Confirmer mes pièces</span></button>` : ''}` });
    /* stats: not exposed by raider.io */
    if (S_(R.stats.priority)) {
      out.push({ label: 'Stats', v: 'unk', pills: K.pv.pills('stats'), eux: h`${S_(R.stats.priority)} ${cg(R.stats.confidence, R.stats.sources)}`,
        toi: h`<span class="muted">non exposé par raider.io</span>`, todo: 'Simule ton équipement : raider.io ne donne pas tes stats' });
    }
    return out;
  };
  const RK = { spec_269: () => S_(K.R.meta.player && K.R.meta.player.spec) || 'ta spé', class_dps: () => 'DPS de ta classe', class: () => 'ta classe' };
  const mirror = c => {
    const E = eng(), rows = mirrorRows(c, E), M = c.M;
    const nd = rows.filter(r => r.v !== 'debate'), k = nd.filter(r => r.v === 'ok').length, u = nd.filter(r => r.v === 'unk').length;
    L.analyse.mirror = { k, n: nd.length, u };
    const rk = M.ranks, key = rk && ['spec_269', 'class_dps', 'class'].find(x => rk[x]), r = key ? rk[key] : null;
    return sec('mirror', h`<p class="t-call"><span class="num ink">${k}/${nd.length}</span> alignés · ${u} non vérifiables${rows.length > nd.length ? ' · ' + (rows.length - nd.length) + ' en débat (hors compte)' : ''}</p>
      <div class="mir"><div class="mir-r mir-hd" aria-hidden="true"><span></span><span>Eux</span><span>Toi</span><span>À faire</span></div>
      ${rows.map(x => h`<div class="mir-r"><div class="mir-k"><span class="t-call ink">${x.label}</span>${verdict(x.v)}${x.pills || ''}</div>
        <div class="mir-c"><span class="mir-l">Eux</span>${x.eux}</div><div class="mir-c"><span class="mir-l">Toi</span>${x.toi}</div>
        <div class="mir-c"><span class="mir-l">À faire</span>${x.todo}${x.rule && x.v === 'diff' ? h`<br>${cta(x.rule, '→ Ajouter au plan')}` : ''}</div></div>`)}</div>
      ${K.cutoffStrip ? UI.safeSection('cutoffs', () => K.cutoffStrip(c)) : ''}
      ${r && (isNum(r.region) || isNum(r.realm)) ? h`<p class="t-call" data-qa="ranks">${icon('crown', 'i-sm')} Rang raider.io (${RK[key]()}) : ${isNum(r.region) ? h`#${F.num(r.region)} ${S_(M.region).toUpperCase()}` : ''}${isNum(r.region) && isNum(r.realm) ? ' · ' : ''}${isNum(r.realm) ? h`#${F.num(r.realm)} sur ${M.realm || 'ton royaume'}` : ''} ${UI.provM(M)}</p>` : ''}`,
    h`<span class="prov prov-w">${icon('book')}<span>Données du top : recherche du ${asOf()}, pas en direct</span></span>`);
  };

  /* ---------- 5. Portes du Mythique + projection ---------- */
  const GW = { true: ['check', 'ouverte', 'g-ok'], false: ['cross', 'fermée', 'g-no'], null: ['dotted', 'à vérifier', 'g-unk'] };
  const GR = { hc: a => a.type === 'raidNotCleared' && a.diff === 'heroic', ilvl: a => a.type === 'avgIlvlBelow', tier: a => a.type === 'tierCountBelow', ench: a => a.type === 'missingEnchant' };
  const gateOf = a => (a.type === 'missingEnchant' ? 'ench' : a.type === 'tierCountBelow' ? 'tier' : a.type === 'avgIlvlBelow' || a.type === 'slotIlvlBelow' ? 'ilvl'
    : a.type === 'raidNotCleared' && a.diff === 'heroic' ? 'hc' : null);
  const gateDetail = (id, c, E) => {
    const M = c.M, r = M.raid, en = E.ench;
    if (id === 'hc') return r && isNum(r.heroic_bosses_killed) && isNum(r.total_bosses) ? r.heroic_bosses_killed + '/' + r.total_bosses + ' H' + (r.supposed ? ' · raid supposé' : '') : 'Progression raid indisponible';
    if (id === 'ilvl') return isNum(M.ilvl) ? 'iLvl ' + F.ilvl(M.ilvl) + (M.ilvlSource && M.ilvlSource !== 'raider.io' ? ' (' + M.ilvlSource + ')' : '') : 'iLvl indisponible';
    if (id === 'tier') return 'Tier ' + tierTxt(E.tier) + (E.tier.unknown ? ' · pièces à confirmer' : '');
    if (id === 'ench') return en && en.evaluable ? (en.hit ? F.count(en.magnitude, 'emplacement', 'emplacements') + ' sans enchant : ' + en.evidence.map(SF).join(', ') : 'Tous les emplacements visés sont enchantés') : (en && en.reason) || 'Enchants inconnus';
    const top = c.R.trinkets.raid.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99)).slice(0, 5);
    if (!top.length || top.some(x => !isNum(x.itemId))) return 'Identifiants des bijoux absents de la recherche';
    return ['trinket1', 'trinket2'].map(s => { const x = M.gear[s]; return SF(s) + ' ' + (!x.present || x.id == null ? '?' : top.some(t => t.itemId === x.id) ? 'dans le top 5 raid' : 'hors top 5 raid'); }).join(' · ');
  };
  const DIFF = [['normal', 'N'], ['heroic', 'HM'], ['mythic', 'M']];
  const projection = c => {
    const M = c.M, T = c.T, R = c.R, s = c.S.settings, ib = R.raid.ilvlByDifficulty;
    const per = isNum(s.itemsPerWeek) && s.itemsPerWeek > 0 ? s.itemsPerWeek : 1.5, v = newIlvl(c);
    const caps = K.pv.rangeNums(R.progression.maxIlvl.value, 'maxIlvl').nums.map(Number);   // debated cap → one row per version
    const tg = [[T.mythicEntryIlvl, 'entrée Mythique', null], [ib.mythic, 'objets Mythiques', null]].concat(caps.map((n, i) => [n, 'plafond d\'ilvl' + (caps.length > 1 ? ' (une des versions)' : ''), i ? null : 'maxIlvl'])).filter(x => isNum(x[0]));
    const res = t => {
      const p = isNum(v) ? K.engine.projection(M, t, v) : null;
      if (!p) return h`<span class="muted">—</span>`;
      if (p.k === 0) return 'déjà atteint';
      if (p.k == null) return h`Cible inatteignable avec des objets à ${v}, vise plus haut <span class="t-cap ink2">(plafond à ≈ ${F.ilvl(p.ceiling)})</span>`;
      return h`≈ ${F.count(p.k, 'objet', 'objets')} à ${v} ≈ ${p.weeks} sem.`;
    };
    return h`<div class="proj"><div class="card-h"><h3 class="t-h2">Projection d'ilvl</h3>${UI.prov('estimate')}</div>
      <p class="t-call">≈ Estimation · hypothèses : ${F.num(per, per % 1 ? 1 : 0)} ${per >= 2 ? 'objets' : 'objet'}/sem. à ${isNum(v) ? v : F.DASH} · modifier</p>
      <div class="proj-a"><span class="t-call ink2">Objets par semaine</span>${K.pv.stepper('proj-per', 'objets par semaine', F.num(per, per % 1 ? 1 : 0))}
        <span class="t-call ink2">iLvl des nouveaux objets</span>${K.pv.stepper('proj-v', 'ilvl des nouveaux objets', isNum(v) ? String(v) : F.DASH)}</div>
      <div class="chips">${DIFF.filter(d => isNum(ib[d[0]])).map(d => h`<button type="button" class="chip chip-btn" data-act="proj-v" data-arg="=${ib[d[0]]}" aria-pressed="${v === ib[d[0]] ? 'true' : 'false'}">${d[1]} ${ib[d[0]]}</button>`)}</div>
      <ul class="rows">${tg.map(x => h`<li class="row"><span class="grow"><span class="ink num">Pour ${x[0]}</span> <span class="t-cap ink2">${x[1]}</span>${x[2] ? K.pv.pills(x[2]) : ''}</span><span class="t-call proj-r">${res(x[0])}</span></li>`)}</ul>
      ${K.plateau ? UI.safeSection('plateau', () => K.plateau(c)) : ''}${K.projChart ? UI.safeSection('proj-chart', () => K.projChart(c)) : ''}
      <p class="t-cap muted">Calibré sur l'ilvl de ${M.source === 'snapshot' ? 'ton snapshot du ' + F.ddmm(M.at) : 'raider.io'} ; tes emplacements les plus bas sont remplacés en premier. Seuils de la recherche du ${asOf()}.</p></div>`;
  };
  const gates = c => {
    const E = eng(), G = E.gates;
    const k = G.filter(x => x.state === true).length, u = G.filter(x => x.state === null).length;
    L.analyse.gates = { open: k, unknown: u };
    return sec('gates', h`<p class="t-call"><span class="num ink">${k}/5</span> portes ouvertes · ${u} à vérifier · repères, pas des règles de guilde</p>
      <ul class="gates">${G.map(x => {
        const w = GW[String(x.state)], r = x.state === false && GR[x.id] ? E.queue.find(a => GR[x.id](a) && pinnable(a)) : null;
        return h`<li class="gate ${w[2]}">${icon(w[0])}<span class="grow"><span class="ink">${x.label}</span> · ${w[1]}<br><span class="sm">${gateDetail(x.id, c, E)}</span></span>${cta(r)}</li>`;
      })}</ul>${projection(c)}`, UI.provM(c.M));
  };

  /* ---------- 6. Le plan (a view of the queue; nothing hand-written) ---------- */
  const plan = () => {
    const E = eng(), used = new Set();
    const take = l => l.filter(a => a && !used.has(a) && used.add(a));
    const closed = new Set(E.gates.filter(g => g.state === false).map(g => g.id));
    const G = [['Aujourd\'hui', take(E.plan.items.map(i => i.a)), 'Rien à planifier dans ce budget'],
      ['Cette semaine', take(E.queue.filter(a => a.weekly && a.evaluable && a.hit && !a.done && !a.snoozed && !a.disputed)), 'Rien d\'hebdomadaire en attente'],
      ['Avant le Mythique', take(E.queue.filter(a => a.evaluable && a.hit && !a.done && closed.has(gateOf(a)))), 'Aucune porte fermée liée à une règle'],
      ['Dépend du loot', take(E.groups.loot), 'Rien ne dépend du loot pour l\'instant']];
    return sec('plan', h`<p class="t-cap ink2">Vue de la file de Maintenant · budget ${E.budgetLabel} · calcul KATA.</p>
      ${G.map(g => h`<div class="pl-g"><h3 class="t-h2">${g[0]}</h3>${g[1].length ? h`<ul class="rows">${g[1].map(a => K.nowUI.row(a))}</ul>` : UI.empty(g[2])}</div>`)}`);
  };

  /* ---------- 7. Position du spec ---------- */
  const TR = { up: ['up', 'en hausse'], down: ['down', 'en baisse'], flat: ['flat', 'stable'] };
  const spec = c => {
    const R = c.R, st = R.standing;
    const tile = (l, o) => (U.isObj(o) && S_(o.tier) ? h`<div class="spt"><p class="over">${l}</p><p class="t-display">${S_(o.tier)}</p>
      <p class="t-call ink2">${icon((TR[o.trend] || ['dotted'])[0])} ${(TR[o.trend] || [0, 'tendance inconnue'])[1]} ${cg(o.confidence, st.sources)}</p><p class="sm any">${S_(o.detail)}</p></div>` : '');
    const list = (t, xs) => (xs.length ? h`<div><p class="over">${t}</p><ul class="list-dot">${xs.map(x => h`<li>${x}</li>`)}</ul></div>` : '');
    const kc = R.talents.keyChoices.filter(x => U.isObj(x) && S_(x.node));
    return sec('spec', h`<div class="spts">${tile('Mythique+', st.mplus)}${tile('Raid', st.raid)}</div>
      ${list('Points forts', st.strengths)}${list('Apport au groupe', st.groupValue)}
      ${R.heroTrees.recommendation ? h`<div><p class="over">Arbre héroïque</p>${K.pv.pills('heroTrees')}<p class="t-call any">${R.heroTrees.recommendation}</p></div>` : ''}
      ${kc.length ? h`<div><p class="over">Choix de talents clés</p><ul class="list-dot">${kc.map(x => h`<li><span class="ink">${S_(x.node)}</span> → ${S_(x.pickWhen)}</li>`)}</ul></div>` : ''}
      ${K.pv.srcBtn(st.sources)}`, UI.provResearch());
  };

  /* ---------- 8. Débats et zones d'ombre (+ «Données absentes de raider.io») ---------- */
  const debates = c => {
    const M = c.M, R = c.R;
    const api = M.source === 'live' || M.source === 'cached';
    const miss = api ? U.uniq(Array.from(M.missing || []).map(K.model.label)) : [];
    return sec('debates', h`<div><div class="card-h"><h3 class="t-h2">Données absentes de raider.io</h3>${UI.provM(M)}</div>
        ${!api ? h`<p class="t-call ink2">${M.source === 'snapshot' ? 'Pas de données raider.io : snapshot du ' + F.ddmm(M.at) + ' (enchants, gemmes, clés, raid et cote inconnus).' : 'Aucune donnée raider.io pour ce personnage.'}</p>`
          : miss.length ? h`<ul class="chips">${miss.map(x => h`<li class="chip">${icon('dotted', 'i-sm')}${x}</li>`)}</ul>` : UI.empty('Aucune : raider.io a renvoyé tous les champs lus.')}</div>
      <details class="an-dd" data-key="an-deb"><summary><span class="t-h2 grow">Débats (${R.disputed.length})</span>${icon('chevron')}</summary>
        ${R.disputed.length ? h`<ul class="rows">${R.disputed.map((d, i) => K.pv.debateRow(i))}</ul>` : UI.empty('Aucun débat ouvert')}
        <p class="t-cap muted">Un point en débat n'est jamais une recommandation : ni action, ni objectif, ni étape du plan.</p></details>
      <details class="an-dd" data-key="an-unk"><summary><span class="t-h2 grow">Zones d'ombre (${R.unknowns.length})</span>${icon('chevron')}</summary>
        ${R.unknowns.length ? h`<ul class="unkl">${R.unknowns.map(x => K.pv.unknownCard(x))}</ul>` : UI.empty('Aucune zone d\'ombre listée')}</details>`);
  };

  /* ---------- 9. Méthode et sources ---------- */
  const sources = c => {
    const R = c.R, s = K.research.src(R.sources.map(x => x.id));
    return sec('sources', h`${R.meta.method ? h`<p class="t-call any">${R.meta.method}</p>` : ''}${R.meta.patch ? h`<p class="t-cap ink2">Patch : ${R.meta.patch}</p>` : ''}
      <details class="an-dd" data-key="an-src"><summary><span class="t-h2 grow">${F.count(s.length, 'source', 'sources')}</span>${icon('chevron')}</summary>
        <ol class="srcl">${s.map(x => h`<li>${x.url ? h`<a class="inline any" href="${x.url}" target="_blank" rel="noopener noreferrer">${x.label}</a>` : x.label}</li>`)}</ol></details>`, UI.provResearch());
  };

  const SEC = { tldr, weak, mirror, gates, plan, spec, debates, sources };
  K.screens.register('analyse', {
    render(c) {
      const tally = { haute: 0, moyenne: 0, basse: 0 };
      L.analyse = { certainty: tally, mirror: null, gates: null, debates: c.R.disputed.length, unknowns: c.R.unknowns.length };
      K.pv.tally = tally;
      let body;
      try { body = SECS.map(s => UI.safeSection('an-' + s[0], () => SEC[s[0]](c))); } finally { K.pv.tally = null; }
      return h`<div class="an"><div class="an-toc">${SECS.map(s => h`<button type="button" class="chip chip-btn" data-act="an-jump" data-arg="${s[0]}">${s[1]}</button>`)}</div>
        <div class="an-main">${UI.safeSection('an-head', () => head(c, tally))}${body}</div></div>`;
    }
  });

  /* ---------- verbs ---------- */
  const save = t => { K.store.save(); K.invalidate(t); };
  K.act('an-jump', el => {
    const id = el.getAttribute('data-arg'), t = document.getElementById('an-' + id);
    if (!t) return;
    if (id === 'debates') t.querySelectorAll('details').forEach(d => { d.open = true; });
    t.scrollIntoView({ block: 'start' });
    const hh = t.querySelector('h2');
    if (hh) { hh.setAttribute('tabindex', '-1'); try { hh.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  });
  K.onChange('hero-tree', el => {
    const t = K.R.heroTrees.trees[Number(el.value)];
    K.S.heroTreeManual = el.value !== '' && t ? t.name : null;
    save('hero-tree');
  });
  K.act('embel', el => {
    const p = String(el.getAttribute('data-arg')).split(':'), k = 'e' + (p[0] | 0), b = p[1] === '1', m = K.S.embellishManual;
    if (m[k] === b) delete m[k]; else m[k] = b;
    save('embel');
  });
  K.act('proj-per', el => {
    const s = K.S.settings, p = isNum(s.itemsPerWeek) ? s.itemsPerWeek : 1.5;
    s.itemsPerWeek = U.clamp(Math.round((p + (el.getAttribute('data-arg') === '+' ? 0.5 : -0.5)) * 2) / 2, 0.5, 5);
    save('settings');
  });
  K.act('proj-v', el => {
    const s = K.S.settings, a = String(el.getAttribute('data-arg')), d = K.R.raid.ilvlByDifficulty.heroic;
    if (a === 'x') s.newItemIlvl = null;
    else {
      let v = isNum(s.newItemIlvl) ? s.newItemIlvl : isNum(d) ? d : 300;
      v = a.charAt(0) === '=' ? Number(a.slice(1)) : v + (a === '+' ? 1 : -1);
      if (isNum(v)) s.newItemIlvl = U.clamp(Math.round(v), 200, 400);
    }
    save('settings');
  });
})(KATA);
