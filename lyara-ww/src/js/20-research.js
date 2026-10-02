/* 20-research.js — research JSON from <script type="application/json" id="kata-research">. Stage 1.
   K.R is ALWAYS a well-typed object: keys used by the app are coerced (wrong type → empty value;
   unknown extra keys are kept). On parse failure K.R = MIN_R (same keys, empty) and
   K.research.ok = false → status «Recherche illisible · affichage live seul».
   Scalars: '' marker = string or undefined, 0 marker = finite number or undefined (never 0 by default).
   K.research: {ok, error, asOf, asOfFR, stale, ageDays, lastKnown(), src(ids) → [{id,label,url|null}],
     dungeons(), dungeonFor(run) (name first, short name second), sourceCount} */
(function (K) {
  'use strict';
  const U = K.util, F = K.fmt, C = K.CONFIG;
  const S = '', N = 0;
  const SHAPE = {
    meta: { asOf: S, patch: S, season: S, method: S, player: { name: S, realm: S, region: S, race: S, spec: S, lastKnown: S } },
    headline: { title: S, summary: S, keyPoints: [S] },
    patchTimeline: [{ date: S, title: S, sources: [S] }],
    standing: { mplus: {}, raid: {}, strengths: [S], weaknesses: [S], groupValue: [S], sources: [S] },
    heroTrees: { recommendation: S, trees: [{ name: S, pros: [S], cons: [S], sources: [S] }] },
    talents: { keyChoices: [{}], importStrings: [{}] },
    rotation: { singleTarget: [S], aoe: [S], opener: [S], cooldowns: [S], defensives: [S], mistakes: [S], heroDiffs: [S], sources: [S] },
    tierSet: { name: S, slots: [S], acquisition: [S], catalyst: [S], sources: [S] },
    trinkets: { raid: [{}], mplus: [{}], avoid: [{}] },
    weapons: [{}],
    bisBySlot: [{ slot: S }],
    crafting: { advice: [S], embellishments: [{}], sources: [S] },
    enchants: [{ slot: S, name: S }],
    gems: [{ name: S }],
    consumables: [{ type: S, name: S }],
    stats: {},
    mplus: { dungeons: [{ name: S, slug: S, tips: [S], loot: [S], sources: [S] }], affixes: {}, keyTargets: [{}], milestones: [{ name: S, rating: N }] },
    raid: { name: S, slug: S, bosses: [{ order: N, name: S, tips: [S], loot: [S] }], ilvlByDifficulty: { lfr: N, normal: N, heroic: N, mythic: N }, mythicAdvice: [S], upcoming: {} },
    progression: { ilvlTable: [{}], crests: [{}], crestRules: [S], vaultRules: [S], catalyst: [S], maxIlvl: {} },
    targets: { slotIlvlGood: N, slotIlvlWeak: N, mythicEntryIlvl: N, vaultMplusLevel: N },
    actionRules: [{ id: S, title: S, when: { type: S, params: {} } }],
    gearSnapshot: { date: S, items: [{ slot: S }] },
    apiNotes: {},
    disputed: [{ topic: S, versions: [S], sources: [S] }],
    unknowns: [S],
    sources: [{ id: S, label: S, url: S }]
  };
  const conform = (v, shape) => {
    if (shape === S) return typeof v === 'string' ? v : undefined;
    if (shape === N) return U.isNum(v) ? v : undefined;
    if (Array.isArray(shape)) {
      if (!Array.isArray(v)) return [];
      const it = shape[0];
      if (it === S) return v.filter(x => typeof x === 'string');
      if (U.isObj(it)) return v.filter(U.isObj).map(x => conform(x, it));
      return v.slice();
    }
    if (U.isObj(shape)) {
      const o = U.isObj(v) ? Object.assign({}, v) : {};
      Object.keys(shape).forEach(k => { o[k] = conform(o[k], shape[k]); });
      return o;
    }
    return v;
  };

  const RS = (K.research = {
    ok: false, error: null, asOf: null, asOfFR: '—', stale: false, ageDays: null, sourceCount: 0,
    SHAPE, conform,
    load() {
      let data = null, err = null;
      try {
        const el = document.getElementById('kata-research');
        if (!el) throw new Error('bloc de recherche absent');
        data = JSON.parse(el.textContent || '');
        if (!U.isObj(data)) throw new Error('racine invalide');
      } catch (e) { err = e; data = null; }
      K.R = conform(data || {}, SHAPE);
      RS.ok = !err;
      RS.error = err ? String(err.message || err) : null;
      if (err) K.report('research', err);
      RS.asOf = U.isISO(K.R.meta.asOf) ? K.R.meta.asOf : null;
      RS.asOfFR = RS.asOf ? F.ddmm(RS.asOf) : '—';
      RS.ageDays = RS.asOf ? Math.floor((Date.now() - Date.parse(RS.asOf)) / 864e5) : null;
      RS.stale = RS.ageDays !== null && RS.ageDays > C.staleResearchDays;
      byId = new Map(K.R.sources.filter(s => s.id).map(s => [s.id, s]));
      RS.sourceCount = K.R.sources.length;
      return K.R;
    },
    /* [{id, label, url|null}] — url only if https */
    src(ids) {
      return U.arr(ids).map(id => byId.get(id)).filter(Boolean)
        .map(s => ({ id: s.id, label: s.label || s.id, url: U.isHttps(s.url) ? s.url : null }));
    },
    /* R.meta.player.lastKnown as a labelled research fact (override 5): {text, date:'28/09', label} */
    lastKnown() {
      const t = U.str(K.R.meta.player && K.R.meta.player.lastKnown);
      if (!t) return null;
      const m = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
      const date = m ? m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') : RS.asOfFR;
      return { text: t, date, label: 'relevé du ' + date };
    },
    dungeons: () => K.R.mplus.dungeons,
    /* research dungeon for an API run {dungeon, short} (or any {name, slug}); null if none */
    dungeonFor: run => U.findDungeon(K.R.mplus.dungeons, run),
    /* is the configured character the research's player? (snapshot / lastKnown only apply to him) */
    isPlayer(settings) {
      const pl = K.R.meta.player || {}, s = settings || (K.S && K.S.settings) || {};
      return !!pl.name && U.normKey(s.name) === U.normKey(pl.name) && U.normKey(s.realm) === U.normKey(pl.realm) &&
        U.normKey(s.region) === U.normKey(pl.region || s.region);
    }
  });
  let byId = new Map();
})(KATA);
