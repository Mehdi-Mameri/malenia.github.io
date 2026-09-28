/* 00-kata.js — the ONLY top-level binding: the KATA namespace, plus CONFIG (spec §6.7) and
   window.__LYARA__ (spec §9.1). Every other file is `(function (K) { 'use strict'; … })(KATA);`
   and attaches to K. File-number ranges: 00–39 foundation (stage 1) · 40–49 engine + Maintenant ·
   50–59 Semaine · 60–69 Stuff · 70–79 Analyse · 80–89 Guide + Réglages + provenance · 99 boot. */
var KATA = (function () {
  'use strict';

  /* ---------- CONFIG: single editable block. No research fact lives here (those come from R). ---------- */
  var CONFIG = {
    version: 'kata-2.0.0',
    api: 'https://raider.io/api/v1',
    timeZone: 'Europe/Paris',
    reset: { dow: 3, hourUTC: 4, conf: 'moyenne' },               // mercredi 04:00 UTC (EU)
    resetAnchor: '2026-08-19T04:00:00Z',
    vault: { mplus: [1, 4, 8], raid: [2, 4, 6], world: [2, 4, 8], conf: 'moyenne' },
    chest: { plus2: 0.8, plus3: 0.6, conf: 'moyenne' },
    keyOverheadMin: 8,
    weeklyListCap: 10,
    likelySocketSlots: ['neck', 'finger1', 'finger2'],
    tierSlotsDefault: ['head', 'shoulder', 'chest', 'hands', 'legs'],
    score: {
      IMPACT: { 1: 100, 2: 80, 3: 60, 4: 45, 5: 30 },
      EFFORT_MIN: { faible: 10, moyen: 40, 'élevé': 120 },
      CONF_W: { haute: 1, moyenne: 0.8, basse: 0.55 }
    },
    additiveTolerance: 0.03,
    timeouts: { profile: 8000, other: 6000 },
    retryDelay: 1500,
    refreshThrottle: 60000,
    autoRefreshAfter: 600000,
    staleResearchDays: 21,
    staleCacheDays: 7,
    weekKeep: 6,
    journalMax: 120,
    fieldsAll: ['gear', 'guild', 'talents', 'raid_progression', 'mythic_plus_scores_by_season:current', 'mythic_plus_ranks',
      'mythic_plus_best_runs', 'mythic_plus_alternate_runs', 'mythic_plus_weekly_highest_level_runs',
      'mythic_plus_previous_weekly_highest_level_runs'],
    fieldsCore: ['gear', 'raid_progression', 'mythic_plus_scores_by_season:current', 'mythic_plus_best_runs',
      'mythic_plus_weekly_highest_level_runs'],
    /* top-level response keys whose absence makes a live response «partiel» (optional ones — talents,
       guild, alternate / previous-week runs — are still reported in __LYARA__.fields but do not count) */
    partialKeys: ['gear', 'raid_progression', 'mythic_plus_scores_by_season', 'mythic_plus_best_runs',
      'mythic_plus_weekly_highest_level_runs', 'mythic_plus_ranks'],
    /* spec §7.4: topic → regex used to attach «Débat» pills inline (stage 80–89) */
    disputeAnchors: {
      heroTrees: /shado|conduit|arbre|h[ée]ro/i, maxIlvl: /ilvl|niveau d.objet|plafond/i, trinkets: /bijou|trinket/i,
      tier: /tier|ensemble|4 ?p/i, stats: /stat/i, talents: /talent/i
    },
    /* confidence + FR label of each editable constant (shown in Réglages) */
    info: {
      reset: { label: 'Reset hebdomadaire', conf: 'moyenne' },
      vault: { label: 'Seuils du Grand Coffre (règles TWW reconduites · à confirmer)', conf: 'moyenne' },
      chest: { label: 'Seuils de coffre +2 / +3 (part du temps imparti)', conf: 'moyenne' },
      keyOverheadMin: { label: 'Temps hors donjon par clé (min)', conf: 'moyenne' },
      weeklyListCap: { label: 'Taille max de la liste des clés de la semaine', conf: 'basse' },
      likelySocketSlots: { label: 'Emplacements à châsse probables', conf: 'basse' },
      tierSlotsDefault: { label: 'Emplacements du set de tier (par défaut)', conf: 'haute' },
      score: { label: 'Pondérations internes du classement des actions', conf: 'moyenne' },
      additiveTolerance: { label: 'Tolérance du test d\'additivité de la cote', conf: 'moyenne' }
    }
  };

  /* Test/diagnostic hook (spec §9.1). Must stay JSON-serializable: no Set/Map/functions. */
  window.__LYARA__ = {
    version: CONFIG.version, state: 'snapshot', phase: 'boot', partial: false, degraded: false,
    errors: [], fields: {}, requests: [], researchOk: false, researchAsOf: null,
    screen: null, sheet: null, weekKey: null, status: ''
  };

  return { CONFIG: CONFIG, version: CONFIG.version };
})();
