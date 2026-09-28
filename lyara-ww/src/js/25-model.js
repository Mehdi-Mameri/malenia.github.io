/* 25-model.js — normalised model M (spec §6.4). Stage 1. Absent ≠ null ≠ empty: undefined means
   «not returned», [] means «returned, empty». Every API string is raw text: render it only through K.h
   (text nodes), NEVER in an attribute.
   K.M = {
     source 'live'|'cached'|'snapshot'|'none', at ISO (fetch time · cache time · snapshot date), degraded, requested[],
     name, realm, region, race, className, specName, guild, profileUrl (https|null), crawledAt, gearUpdatedAt,
     ilvl number|undefined, ilvlSource 'raider.io'|'calcul'|'calcul · snapshot'|null, ilvlCalc (weighted mean),
     gear {slot: {slot, present:false} | {slot, present:true, id, name, ilvl, quality, ench:{state 'ok'|'manquant'|'inconnu',
           ids[], names[]}, gems:{state 'ok'|'vide?'|'inconnu', ids[], names[], count}, tier (string|true|null), bonuses[]|null}},
     gearPresent, twoHand, anyTierField,
     score number|undefined, season, scoreColor '#rrggbb'|null,
     best / alt / weekly / prevWeekly: Run[] | undefined   Run = {dungeon, short, level, score, upgrades, clear, par, at, url, timed, rd}
       (rd = matched research dungeon object or null),
     ranks {spec_269?|class_dps?|class?|overall?: {world, region, realm}} | undefined,
     raid {key, supposed, summary, total_bosses, normal_bosses_killed, heroic_bosses_killed, mythic_bosses_killed} | null,
     talentText, heroTree, heroTreeSlug,
     partial, partialPaths[], fields {path: 'ok'|'absent'|'null'|'type'}, samples {path: text}, missing Set<path> }
   K.model: normalize(profile, source, {at, requested, degraded}) · fromSnapshot() · empty() · set(M) · trim(profile)
            label(path) → FR label («clés de la semaine», «gemmes du cou»…) · SLOT constants on K. */
(function (K) {
  'use strict';
  const U = K.util, C = K.CONFIG;
  const { isNum, isObj, str, arr } = U;

  const SLOTS = (K.SLOTS = ['head', 'neck', 'shoulder', 'back', 'chest', 'wrist', 'hands', 'waist', 'legs', 'feet',
    'finger1', 'finger2', 'trinket1', 'trinket2', 'mainhand', 'offhand']);
  K.SLOTS_EXPECTED = SLOTS.filter(s => s !== 'offhand');
  K.SLOT_FR = { head: 'Tête', neck: 'Cou', shoulder: 'Épaules', back: 'Dos', chest: 'Torse', wrist: 'Poignets', hands: 'Mains',
    waist: 'Taille', legs: 'Jambes', feet: 'Pieds', finger1: 'Anneau 1', finger2: 'Anneau 2', trinket1: 'Bijou 1', trinket2: 'Bijou 2',
    mainhand: 'Arme', offhand: 'Main gauche', finger: 'Anneaux', trinket: 'Bijoux' };
  K.SLOT_MONO = { head: 'Tê', neck: 'Cou', shoulder: 'Ép', back: 'Dos', chest: 'To', wrist: 'Po', hands: 'Ma', waist: 'Ta', legs: 'Ja',
    feet: 'Pi', finger1: 'A1', finger2: 'A2', trinket1: 'B1', trinket2: 'B2', mainhand: 'Ar', offhand: 'MG' };
  const DE = { head: 'de la tête', neck: 'du cou', shoulder: 'des épaules', back: 'du dos', chest: 'du torse', wrist: 'des poignets',
    hands: 'des mains', waist: 'de la taille', legs: 'des jambes', feet: 'des pieds', finger1: 'de l\'anneau 1', finger2: 'de l\'anneau 2',
    trinket1: 'du bijou 1', trinket2: 'du bijou 2', mainhand: 'de l\'arme', offhand: 'de la main gauche' };
  K.SLOT_DE = DE;
  K.RSLOT = { finger: ['finger1', 'finger2'], trinket: ['trinket1', 'trinket2'] };   // research slot → live slots
  K.expandSlots = list => arr(list).reduce((o, s) => o.concat(K.RSLOT[s] || [s]), []);

  const TYPE = { number: isNum, string: v => typeof v === 'string', array: Array.isArray, object: isObj, any: () => true };
  const sample = v => (typeof v === 'string' ? v.slice(0, 40) : isNum(v) || typeof v === 'boolean' ? String(v)
    : Array.isArray(v) ? '[' + v.length + ']' : isObj(v) ? '{…}' : '');

  /* Reader: pick(o, basePath, [paths], type) with marks into fields/samples/missing */
  const Reader = marking => {
    const fields = {}, samples = {}, missing = new Set();
    const mark = (path, status, v) => {
      if (!marking) return;
      fields[path] = status;
      if (status === 'ok') { samples[path] = sample(v); missing.delete(path); } else missing.add(path);
    };
    const pick = (o, base, paths, type) => {
      const check = TYPE[type || 'any'];
      for (const p of paths) {
        const v = p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
        if (v === undefined) continue;
        const full = base ? base + '.' + p : p;
        if (v === null) { mark(full, 'null'); return null; }
        if (!check(v)) { mark(full, 'type', v); return undefined; }
        mark(full, 'ok', v);
        return v;
      }
      mark(base ? base + '.' + paths[0] : paths[0], 'absent');
      return undefined;
    };
    return { pick, mark, fields, samples, missing };
  };

  const run = r => {
    const o = {
      dungeon: str(r.dungeon), short: str(r.short_name),
      level: isNum(r.mythic_level) ? r.mythic_level : null,
      score: isNum(r.score) ? r.score : null,
      upgrades: isNum(r.num_keystone_upgrades) ? r.num_keystone_upgrades : null,
      clear: isNum(r.clear_time_ms) ? r.clear_time_ms : null,
      par: isNum(r.par_time_ms) ? r.par_time_ms : null,
      at: U.isISO(r.completed_at) ? r.completed_at : null,
      url: U.isHttps(r.url) ? r.url : null
    };
    o.timed = isNum(o.upgrades) ? o.upgrades > 0 : isNum(o.clear) && isNum(o.par) ? o.clear <= o.par : null;
    o.rd = K.research.dungeonFor(o);
    return o;
  };

  const item = (it, s, rd) => {
    const base = 'gear.items.' + s;
    const g = { slot: s, present: true };
    g.id = isNum(it.item_id) ? it.item_id : null;
    g.name = str(it.name);
    const lv = rd.pick(it, base, ['item_level'], 'number');
    g.ilvl = isNum(lv) ? lv : null;
    g.quality = Number.isInteger(it.item_quality) && it.item_quality >= 0 && it.item_quality <= 7 ? it.item_quality : null;
    if (Array.isArray(it.enchants)) { rd.mark(base + '.enchants', 'ok', it.enchants); g.ench = { state: it.enchants.length ? 'ok' : 'manquant', ids: it.enchants.filter(isNum) }; }
    else if (isNum(it.enchant)) { rd.mark(base + '.enchant', 'ok', it.enchant); g.ench = { state: it.enchant > 0 ? 'ok' : 'manquant', ids: it.enchant > 0 ? [it.enchant] : [] }; }
    else { rd.mark(base + '.enchants', it.enchants === null ? 'null' : it.enchants === undefined ? 'absent' : 'type'); g.ench = { state: 'inconnu', ids: [] }; }
    g.ench.names = arr(it.enchants_detail).map(d => (isObj(d) ? str(d.name) : '')).filter(Boolean);
    if (Array.isArray(it.gems)) { rd.mark(base + '.gems', 'ok', it.gems); g.gems = { state: it.gems.length ? 'ok' : 'vide?', ids: it.gems.filter(isNum), count: it.gems.length }; }
    else { rd.mark(base + '.gems', it.gems === null ? 'null' : it.gems === undefined ? 'absent' : 'type'); g.gems = { state: 'inconnu', ids: [], count: null }; }
    g.gems.names = arr(it.gems_detail).map(d => (isObj(d) ? str(d.name) : '')).filter(Boolean);
    g.tier = (typeof it.tier === 'string' && it.tier) || it.tier === true ? it.tier : null;
    g.bonuses = Array.isArray(it.bonuses) ? it.bonuses.filter(isNum) : null;
    return g;
  };

  const wmean = M => {
    let s = 0, w = 0;
    SLOTS.forEach(k => {
      const g = M.gear[k];
      if (!g.present || !isNum(g.ilvl)) return;
      const wt = k === 'mainhand' && M.twoHand ? 2 : 1;
      s += g.ilvl * wt; w += wt;
    });
    return w ? s / w : undefined;
  };

  const raidOf = rp => {
    const R = K.R;
    const keys = Object.keys(rp).filter(k => isObj(rp[k]));
    const want = [R.raid.slug, R.apiNotes && R.apiNotes.raidSlug].filter(x => typeof x === 'string' && x);
    let key = want.find(k => isObj(rp[k])) || null, supposed = false;
    if (!key && R.raid.name) { const sl = U.slugify(R.raid.name); key = keys.find(k => k.indexOf(sl) >= 0) || null; }
    if (!key && keys.length) { key = keys[0]; supposed = true; }
    if (!key) return null;
    const e = rp[key], n = v => (isNum(v) ? v : null);
    return { key, supposed, summary: str(e.summary) || null, total_bosses: n(e.total_bosses),
      normal_bosses_killed: n(e.normal_bosses_killed), heroic_bosses_killed: n(e.heroic_bosses_killed), mythic_bosses_killed: n(e.mythic_bosses_killed) };
  };

  const ranksOf = rk => {
    const out = {};
    ['spec_269', 'class_dps', 'class', 'overall'].forEach(k => {
      const e = rk[k];
      if (isObj(e) && (isNum(e.region) || isNum(e.realm) || isNum(e.world))) {
        out[k] = { world: isNum(e.world) ? e.world : null, region: isNum(e.region) ? e.region : null, realm: isNum(e.realm) ? e.realm : null };
      }
    });
    return Object.keys(out).length ? out : undefined;
  };

  const weeklyKey = () => {
    const f = K.R.apiNotes && K.R.apiNotes.weeklyRunsField;
    return typeof f === 'string' && /^[a-z_:]+$/.test(f) ? f.split(':')[0] : 'mythic_plus_weekly_highest_level_runs';
  };

  const normalize = (p, source, opts) => {
    opts = opts || {};
    const api = source === 'live' || source === 'cached';
    const rd = Reader(api), pick = rd.pick;
    p = isObj(p) ? p : {};
    const M = { source, at: opts.at || null, degraded: !!opts.degraded, requested: opts.requested || null };

    M.name = api ? str(pick(p, '', ['name'], 'string')) || null : null;
    M.realm = api ? str(p.realm) || null : null;
    M.region = api ? str(p.region) || null : null;
    M.race = str(p.race) || null; M.className = str(p.class) || null; M.specName = str(p.active_spec_name) || null;
    const crawled = api ? pick(p, '', ['last_crawled_at'], 'string') : undefined;
    M.crawledAt = U.isISO(crawled) ? crawled : null;
    M.profileUrl = U.isHttps(p.profile_url) ? p.profile_url : null;
    const gd = api ? pick(p, '', ['guild'], 'object') : undefined;
    M.guild = gd && typeof gd.name === 'string' && gd.name ? gd.name : null;

    /* gear */
    const gear = pick(p, '', ['gear'], 'object');
    const items = gear ? pick(gear, 'gear', ['items'], 'object') : undefined;
    M.gear = {};
    SLOTS.forEach(s => {
      let it;
      if (items) it = s === 'offhand' && items.offhand === undefined ? undefined : pick(items, 'gear.items', [s], 'object');
      M.gear[s] = isObj(it) ? item(it, s, rd) : { slot: s, present: false };
    });
    M.gearPresent = SLOTS.some(s => M.gear[s].present);
    M.twoHand = !!(M.gear.mainhand.present && !M.gear.offhand.present);
    M.anyTierField = SLOTS.some(s => M.gear[s].present && M.gear[s].tier !== null);
    M.gearUpdatedAt = gear && U.isISO(gear.updated_at) ? gear.updated_at : null;
    const eq = gear ? pick(gear, 'gear', ['item_level_equipped'], 'number') : undefined;
    M.ilvlCalc = wmean(M);
    if (isNum(eq)) { M.ilvl = eq; M.ilvlSource = 'raider.io'; }
    else if (isNum(M.ilvlCalc)) { M.ilvl = M.ilvlCalc; M.ilvlSource = source === 'snapshot' ? 'calcul · snapshot' : 'calcul'; }
    else { M.ilvl = undefined; M.ilvlSource = null; }

    /* M+ score */
    const seasons = api ? pick(p, '', ['mythic_plus_scores_by_season'], 'array') : undefined;
    const s0 = seasons && isObj(seasons[0]) ? seasons[0] : null;
    const sc = s0 ? pick(s0, 'mythic_plus_scores_by_season.0', ['scores.all'], 'number') : undefined;
    M.score = isNum(sc) ? sc : undefined;
    M.season = s0 ? str(s0.season) || null : null;
    const col = s0 && isObj(s0.segments) && isObj(s0.segments.all) ? s0.segments.all.color : null;
    M.scoreColor = U.isHex(col) ? col : null;

    /* runs: undefined = not returned (≠ []) */
    const runs = key => { if (!api) return undefined; const v = pick(p, '', [key], 'array'); return Array.isArray(v) ? v.filter(isObj).map(run) : undefined; };
    M.best = runs('mythic_plus_best_runs');
    M.alt = runs('mythic_plus_alternate_runs');
    M.weekly = runs(weeklyKey());
    M.prevWeekly = runs('mythic_plus_previous_weekly_highest_level_runs');

    const rk = api ? pick(p, '', ['mythic_plus_ranks'], 'object') : undefined;
    M.ranks = rk ? ranksOf(rk) : undefined;
    const rp = api ? pick(p, '', ['raid_progression'], 'object') : undefined;
    M.raid = rp ? raidOf(rp) : null;

    const tl = api ? pick(p, '', ['talentLoadout'], 'object') : undefined;
    M.talentText = tl && typeof tl.loadout_text === 'string' ? tl.loadout_text
      : isObj(p.talents) && typeof p.talents.loadout_text === 'string' ? p.talents.loadout_text : null;
    const ht = tl && isObj(tl.active_hero_tree) ? tl.active_hero_tree : null;
    M.heroTree = ht && typeof ht.name === 'string' && ht.name ? ht.name : null;
    M.heroTreeSlug = ht && typeof ht.slug === 'string' ? ht.slug : null;

    /* partial: requested core fields absent, expected slot absent, present item without enchants/gems */
    const pp = [];
    if (api) {
      const req = (M.requested || C.fieldsAll).map(f => f.split(':')[0]);
      C.partialKeys.forEach(k => { if (req.indexOf(k) >= 0 && rd.fields[k] && rd.fields[k] !== 'ok') pp.push(k); });
      if (gear && !items) pp.push('gear.items');
      if (items) K.SLOTS_EXPECTED.forEach(s => {
        const g = M.gear[s];
        if (!g.present) { pp.push('gear.items.' + s); return; }
        if (g.ench.state === 'inconnu') pp.push('gear.items.' + s + '.enchants');
        if (g.gems.state === 'inconnu') pp.push('gear.items.' + s + '.gems');
      });
    }
    M.partialPaths = pp; M.partial = pp.length > 0;
    M.fields = rd.fields; M.samples = rd.samples; M.missing = rd.missing;
    return M;
  };

  const fromSnapshot = () => {
    const snap = K.R.gearSnapshot, items = {};
    snap.items.forEach(it => {
      if (SLOTS.indexOf(it.slot) < 0 || items[it.slot]) return;
      items[it.slot] = { item_id: it.itemId, item_level: it.ilvl, name: str(it.nameFr) || str(it.nameEn) };
    });
    return normalize(Object.keys(items).length ? { gear: { items } } : {}, 'snapshot', { at: U.isISO(snap.date) ? snap.date : null });
  };

  /* keep what the app reads; drop talent node arrays, images and everything else (cache size) */
  const trim = p => {
    if (!isObj(p)) return null;
    const o = {};
    ['name', 'race', 'class', 'active_spec_name', 'active_spec_role', 'region', 'realm', 'last_crawled_at', 'profile_url', 'guild', 'gear', 'raid_progression']
      .forEach(k => { if (p[k] !== undefined) o[k] = p[k]; });
    Object.keys(p).forEach(k => { if (k.indexOf('mythic_plus_') === 0) o[k] = p[k]; });
    const tl = isObj(p.talentLoadout) ? p.talentLoadout : null;
    if (tl) {
      o.talentLoadout = { loadout_text: typeof tl.loadout_text === 'string' ? tl.loadout_text : undefined };
      if (isObj(tl.active_hero_tree)) o.talentLoadout.active_hero_tree = { name: tl.active_hero_tree.name, slug: tl.active_hero_tree.slug };
    }
    return o;
  };

  /* FR labels for API paths (Statut / Diagnostic / «Données absentes de raider.io») */
  const LABEL = {
    gear: 'équipement', 'gear.items': 'objets équipés', 'gear.item_level_equipped': 'ilvl équipé', guild: 'guilde', talentLoadout: 'talents',
    raid_progression: 'progression raid', mythic_plus_scores_by_season: 'cote M+', mythic_plus_ranks: 'rangs',
    mythic_plus_best_runs: 'meilleures clés', mythic_plus_alternate_runs: 'clés secondaires',
    mythic_plus_weekly_highest_level_runs: 'clés de la semaine', mythic_plus_previous_weekly_highest_level_runs: 'clés de la semaine dernière',
    last_crawled_at: 'date de passage de raider.io', name: 'nom du personnage'
  };
  const label = path => {
    if (LABEL[path]) return LABEL[path];
    const m = /^gear\.items\.([a-z0-9]+)(?:\.([a-z_]+))?$/.exec(path);
    if (m && K.SLOT_FR[m[1]]) {
      if (!m[2]) return K.SLOT_FR[m[1]].toLowerCase();
      if (m[2] === 'gems') return 'gemmes ' + DE[m[1]];
      if (m[2] === 'enchants' || m[2] === 'enchant') return 'enchant ' + DE[m[1]];
      if (m[2] === 'item_level') return 'ilvl ' + DE[m[1]];
    }
    if (path.indexOf('mythic_plus_scores_by_season') === 0) return 'cote M+';
    return path;
  };

  K.model = {
    normalize, fromSnapshot, trim, label, Reader,
    empty: () => normalize({}, 'none'),
    /* current character: its cache, else (research player only) the 21/08 snapshot, else empty */
    initial(cache) {
      if (cache && isObj(cache.profile)) return normalize(cache.profile, 'cached', { at: (cache.at && cache.at.profile) || cache.savedAt, requested: cache.requested, degraded: !!cache.degraded });
      return K.research.isPlayer() ? fromSnapshot() : normalize({}, 'none');
    },
    set(M) {
      K.M = M;
      const L = window.__LYARA__;
      L.state = M.source;
      L.partial = !!M.partial;
      L.degraded = !!M.degraded;
      L.fields = Object.assign({}, M.fields);
    }
  };
})(KATA);
