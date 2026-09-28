/* 70-prov.js — P0-16 provenance / confidence / debate / unknown components (spec §7) + copy helper. Stage 3b.
   Shared by Analyse (72), Guide (80) and Réglages (85); other screens may reuse them.
   K.pv.conf(level, sourceIds?) → 44 px button around the 3-bar glyph; tap opens the «Sources» sheet
       (word + source links + «recherche du {asOf}»). While K.pv.tally is an object {haute, moyenne, basse},
       every glyph rendered is counted (Analyse «Indice de certitude»).
   K.pv.srcBtn(ids)   «{n} sources» button (no confidence level) → same sheet.
   K.pv.srcLinks(ids) inline https links (target=_blank, rel=noopener noreferrer).
   K.pv.debates(key)  [{d, i}] research debates whose topic matches the section anchor `key`
       (heroTrees, talents, rotation, tier, trinkets, weapons, enchants, gems, consumables, stats, progression,
       maxIlvl, raid, bis — see ANCH; a missed match only hides the inline pill, Analyse › Débats lists them all).
   K.pv.pills(keys, notKeys?) «Débat · n versions» pills (44 px, split icon in --debate) → 'debate' sheet (arg = index).
   K.pv.range(value, key) disputed-value formatting: «334» or «334, 337 ou 344» (numbers via /\d{3}/g from the value and
       the anchored debate topics) + pills · K.pv.rangeNums(value, key) → {nums, deb}.
   K.pv.debateRow(i) · K.pv.unknownCard(text) · K.pv.stepper = K.ui.stepper · K.pv.copy(text, title) = K.copy. */
(function (K) {
  'use strict';
  const { h, icon } = K;
  const U = K.util, UI = K.ui;
  const PV = (K.pv = { tally: null });

  /* ---------- sources registry (sheet args stay internal short keys, never content) ---------- */
  const reg = new Map(), regBy = new Map();
  const keyFor = (level, ids) => {
    const sig = (level || '') + '|' + U.arr(ids).filter(x => typeof x === 'string').join(',');
    if (!regBy.has(sig)) { const k = 'q' + (reg.size + 1).toString(36); regBy.set(sig, k); reg.set(k, { level: level || null, ids: sig.split('|')[1] ? sig.split('|')[1].split(',') : [] }); }
    return regBy.get(sig);
  };
  const LEVELS = { haute: 1, moyenne: 1, basse: 1 };
  PV.conf = (level, ids) => {
    if (!LEVELS[level]) return '';
    if (PV.tally) PV.tally[level]++;
    return h`<button type="button" class="cg-b" data-act="sheet" data-sheet="src" data-arg="${keyFor(level, ids)}" aria-label="Confiance : ${level} · voir les sources">${UI.conf(level)}</button>`;
  };
  PV.count = level => { if (PV.tally && LEVELS[level]) PV.tally[level]++; };
  PV.srcBtn = ids => {
    const n = K.research.src(ids).length;
    return n ? h`<button type="button" class="btn btn-ghost btn-sm" data-act="sheet" data-sheet="src" data-arg="${keyFor(null, ids)}">${icon('book')}<span>${n} ${n > 1 ? 'sources' : 'source'}</span></button>` : '';
  };
  PV.srcLinks = ids => {
    const s = K.research.src(ids);
    return s.length ? h`<span class="srcs">${s.map(x => (x.url ? h`<a class="inline" href="${x.url}" target="_blank" rel="noopener noreferrer">${x.label}</a>` : h`<span>${x.label}</span>`))}</span>` : '';
  };
  const WORD = { haute: 'haute', moyenne: 'moyenne', basse: 'basse' };
  K.sheet.define('src', {
    title: 'Sources',
    qa: 'sources',
    render(key) {
      const e = reg.get(key) || { level: null, ids: [] };
      const s = K.research.src(e.ids);
      return h`${e.level ? h`<p class="t-h2">${UI.conf(e.level)} Confiance : ${WORD[e.level]}</p><p class="lead">Niveau attribué par la recherche du ${K.research.asOfFR}${e.level === 'basse' ? ' : à vérifier en jeu, jamais présenté comme priorité' : ''}.</p>` : ''}
        ${s.length ? h`<ul class="list-dot">${s.map(x => h`<li>${x.url ? h`<a class="inline any" href="${x.url}" target="_blank" rel="noopener noreferrer">${x.label} ${icon('external', 'i-sm')}</a>` : x.label}</li>`)}</ul>` : UI.empty('Aucune source listée pour cet élément.')}
        <p class="t-cap muted">${UI.provResearch()} Recherche du ${K.research.asOfFR}${K.research.stale ? ' · la méta a pu bouger' : ''} · jamais une donnée en direct.</p>`;
    }
  });

  /* ---------- debates (R.disputed[]) ---------- */
  const ANCH = {
    heroTrees: /arbre heroique|shado-pan|conduit/, talents: /talent|chaine d.import/,
    rotation: /mono-cible|unbroken|defensif|rushing wind|tigereye/, tier: /\btier\b|4 pieces|curio/,
    trinkets: /bijou/, weapons: /qualite des objets/, enchants: /enchant/, gems: /gemme|peridot/,
    consumables: /consommable/, stats: /\bstat/, progression: /piste|plafond d.ilvl|coffre/, maxIlvl: /plafond d.ilvl/,
    raid: /nom francais du raid|ula.tek mythique|spaulders/, bis: /reliquary|spaulders|qualite des objets/
  };
  PV.ANCH = ANCH;
  PV.debates = key => {
    const re = ANCH[key] || (K.CONFIG.disputeAnchors || {})[key];
    return re ? K.R.disputed.map((d, i) => ({ d, i })).filter(x => re.test(U.fold(x.d.topic))) : [];
  };
  const nv = d => { const n = d.versions.length; return 'Débat · ' + n + (n > 1 ? ' versions' : ' version'); };
  PV.pill = i => { const d = K.R.disputed[i]; return d ? h`<button type="button" class="dpill" data-act="sheet" data-sheet="debate" data-arg="${i}"><span>${icon('split', 'i-sm')}${nv(d)}</span></button>` : ''; };
  const idxOf = keys => [].concat(keys || []).reduce((o, k) => o.concat(PV.debates(k).map(x => x.i)), []);
  /* pills(keys, notKeys?) — one pill per matching debate (deduplicated), minus those of notKeys */
  PV.pills = (keys, not) => {
    const ex = new Set(idxOf(not)), l = U.uniq(idxOf(keys)).filter(i => !ex.has(i));
    return l.length ? h`<span class="dpills">${l.map(i => PV.pill(i))}</span>` : '';
  };
  /* a value touched by a debate is a range, never silently chosen: the 3-digit numbers of the value plus those
     of the debate topics anchored on `key` («Plafond d'ilvl : 334, 337 ou 344 ?» → 334, 337 ou 344) */
  PV.rangeNums = (value, key) => {
    const ds = key ? PV.debates(key) : [];
    const nums = U.uniq((U.str(value).match(/\d{3}/g) || []).concat(...ds.map(x => U.str(x.d.topic).match(/\d{3}/g) || []))).sort();
    return { nums, deb: ds.length ? ds[0].d : null };
  };
  PV.range = (value, key) => {
    const nums = PV.rangeNums(value, key).nums;
    const txt = nums.length > 1 ? nums.slice(0, -1).join(', ') + ' ou ' + nums[nums.length - 1] : U.str(value) || K.fmt.DASH;
    return h`<span class="num ink">${txt}</span>${key ? PV.pills(key) : ''}`;
  };
  PV.debateRow = i => {
    const d = K.R.disputed[i];
    return d ? h`<li><button type="button" class="dbt" data-act="sheet" data-sheet="debate" data-arg="${i}">${icon('split')}<span class="dbt-b"><span class="dbt-t">${d.topic || 'Débat'}</span><span class="t-cap ink2">${nv(d)}</span></span>${icon('chevron')}</button></li>` : '';
  };
  PV.unknownCard = text => h`<li class="unkc">${icon('dotted')}<span class="any">${text}</span></li>`;
  K.sheet.define('debate', {
    title: i => { const d = K.R.disputed[+i]; return d && d.topic ? d.topic : 'Débat'; },
    qa: 'debate',
    render(i) {
      const d = K.R.disputed[+i];
      if (!d) return UI.empty('Débat introuvable.');
      return h`<p class="callout">${icon('split', 'i-sm')} ${nv(d)} : aucune recommandation n'est tirée de ce point.</p>
        <div class="dvers">${d.versions.map((v, n) => h`<div class="dver"><p class="over">Version ${n + 1}</p><p class="t-call any">${v}</p></div>`)}</div>
        ${d.resolution ? h`<div><div class="card-h"><p class="over">Lecture de la recherche</p>${UI.provResearch()}</div><p class="t-call any">${U.str(d.resolution)}</p></div>` : ''}
        ${PV.srcLinks(d.sources)}`;
    }
  });

  PV.stepper = UI.stepper;

  PV.copy = (text, title) => K.copy(text, { title });
})(KATA);
