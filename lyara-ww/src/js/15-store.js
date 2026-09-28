/* 15-store.js — persistence (spec §6.6). Stage 1.
   localStorage behind try/catch with an in-memory mirror: if storage throws (private mode, quota,
   disabled) the app keeps working for the session and toasts ONCE «Tes coches ne seront pas mémorisées…».
   Keys (prefix kata.v1.): state · week.<weekKey> (last 6 kept) · cache.<region>/<realm>/<name> · journal.
   API:
     K.S                         persistent user state (mutate, then K.store.save())
     K.store.save()              write K.S
     K.store.week(weekKey?)      → W for that week (default: current K.time weekKey); K.store.saveWeek(weekKey?)
     K.store.get(key, fb) / set(key, v) / remove(key) / keys(prefix)   raw JSON access (key without prefix)
     K.store.readCache() / writeCache(patch)      cache of the current character
     K.store.journal() / saveJournal(list)        ≤ CONFIG.journalMax entries
     K.store.exportAll() / importAll(obj) → {ok, message} / clearAll()
     K.store.ok() → false once storage failed; K.store.standalone() → home-screen mode */
(function (K) {
  'use strict';
  const U = K.util, C = K.CONFIG;
  const P = 'kata.v1.';
  const mem = new Map();
  let ls = null, broken = false, warned = false, booted = false;
  try { ls = window.localStorage; if (!ls) broken = true; } catch (e) { broken = true; }

  const warn = () => {
    if (warned) return;
    if (!booted || !K.toast) return;                     // shown after first paint (boot calls flushWarn)
    warned = true;
    K.toast('Tes coches ne seront pas mémorisées sur cet appareil');
  };
  const fail = () => { broken = true; warn(); };
  const rawGet = k => {
    if (mem.has(k)) return mem.get(k);
    if (ls && !broken) { try { return ls.getItem(k); } catch (e) { fail(); } }
    return null;
  };
  const rawSet = (k, v) => {
    mem.set(k, v);
    if (!ls || broken) { warn(); return; }
    try { ls.setItem(k, v); } catch (e) {
      if (k.indexOf(P + 'cache.') === 0) { try { ls.removeItem(k); } catch (e2) { /* ignore */ } return; }  // cache too big: drop it only
      fail();
    }
  };
  const rawDel = k => { mem.delete(k); if (ls && !broken) { try { ls.removeItem(k); } catch (e) { fail(); } } };
  const rawKeys = prefix => {
    const out = new Set();
    mem.forEach((v, k) => { if (k.indexOf(P + prefix) === 0) out.add(k.slice(P.length)); });
    if (ls && !broken) {
      try { for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.indexOf(P + prefix) === 0) out.add(k.slice(P.length)); } } catch (e) { fail(); }
    }
    return Array.from(out);
  };

  /* ---------- shapes ---------- */
  const defaults = () => {
    const pl = (K.R && K.R.meta && K.R.meta.player) || {};
    return {
      schema: 1,
      settings: {
        region: U.str(pl.region).toLowerCase() || 'eu', realm: U.slugify(pl.realm) || 'archimonde', name: U.str(pl.name) || 'Lyarà',
        reset: { dow: C.reset.dow, hourUTC: C.reset.hourUTC }, eveningMin: 180, raidNightMin: 150, raidNights: [],
        socketSlots: C.likelySocketSlots.slice(), itemsPerWeek: 1.5, newItemIlvl: null
      },
      budget: 60, done: {}, snooze: {}, fired: {}, closed: {}, pinned: [], tierManual: {}, catalyst: { charges: 0 },
      shopping: {}, heroTreeManual: null, embellishManual: {}, lastSeen: null
    };
  };
  const weekDefaults = () => ({ raid: {}, world: [], manualRuns: [], vaultClaimed: false, preflight: { at: null, checked: {} } });
  const kind = v => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  /* keep stored values whose type matches the default (null defaults accept anything JSON-ish) */
  const conform = (v, def) => {
    if (!U.isObj(v)) return U.clone(def);
    const o = {};
    Object.keys(def).forEach(k => {
      const d = def[k], x = v[k];
      if (x === undefined) o[k] = U.clone(d);
      else if (d === null) o[k] = x;
      else if (U.isObj(d) && Object.keys(d).length) o[k] = conform(x, d);
      else o[k] = kind(x) === kind(d) ? x : U.clone(d);
    });
    return o;
  };

  const weeks = {};
  const S = {
    P,
    ok: () => !broken,
    standalone: () => { try { return !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; } catch (e) { return false; } },
    get(key, fb) { const s = rawGet(P + key); if (s == null) return fb; try { return JSON.parse(s); } catch (e) { return fb; } },
    set(key, val) { try { rawSet(P + key, JSON.stringify(val)); } catch (e) { K.report('store.set', e); } },
    remove(key) { rawDel(P + key); },
    keys: prefix => rawKeys(prefix || ''),
    defaults,
    load() {
      if (ls && !broken) { try { ls.setItem(P + 'probe', '1'); ls.removeItem(P + 'probe'); } catch (e) { broken = true; } }
      K.S = conform(S.get('state', null), defaults());
      K.S.schema = 1;
      return K.S;
    },
    save() { S.set('state', K.S); },
    week(key) {
      key = key || K.time.info().weekKey;
      if (!weeks[key]) weeks[key] = conform(S.get('week.' + key, null), weekDefaults());
      return weeks[key];
    },
    saveWeek(key) {
      key = key || K.time.info().weekKey;
      S.set('week.' + key, S.week(key));
      rawKeys('week.').sort().reverse().slice(C.weekKeep).forEach(k => rawDel(P + k));
    },
    cacheKey() { const s = K.S.settings; return 'cache.' + [s.region, s.realm, s.name].map(x => String(x || '').toLowerCase()).join('/'); },
    readCache() { const c = S.get(S.cacheKey(), null); return U.isObj(c) && c.schema === 1 ? c : null; },
    writeCache(patch) {
      const c = S.readCache() || { schema: 1, at: {} };
      const at = Object.assign({}, c.at, patch.at || {});
      Object.assign(c, patch, { schema: 1, at, savedAt: new Date().toISOString() });
      S.set(S.cacheKey(), c);
      return c;
    },
    journal: () => U.arr(S.get('journal', [])),
    saveJournal(list) { S.set('journal', U.arr(list).slice(-C.journalMax)); },
    exportAll() {
      const wk = {};
      rawKeys('week.').sort().reverse().slice(0, C.weekKeep).forEach(k => { wk[k.slice(5)] = S.get(k, null); });
      return { schema: 1, app: C.version, exportedAt: new Date().toISOString(), state: K.S, weeks: wk, journal: S.journal() };
    },
    importAll(obj) {
      if (!U.isObj(obj) || obj.schema !== 1) return { ok: false, message: 'Format inconnu (schema ≠ 1)' };
      if (obj.state !== undefined && !U.isObj(obj.state)) return { ok: false, message: 'Bloc « state » invalide' };
      if (obj.weeks !== undefined && !U.isObj(obj.weeks)) return { ok: false, message: 'Bloc « weeks » invalide' };
      if (obj.journal !== undefined && !Array.isArray(obj.journal)) return { ok: false, message: 'Bloc « journal » invalide' };
      if (obj.state) { K.S = conform(Object.assign({}, K.S, obj.state, { settings: Object.assign({}, K.S.settings, U.obj(obj.state.settings)) }), defaults()); S.save(); }
      Object.keys(obj.weeks || {}).forEach(k => {
        if (!/^\d{4}-\d\d-\d\d$/.test(k)) return;
        const merged = conform(Object.assign({}, S.week(k), U.obj(obj.weeks[k])), weekDefaults());
        weeks[k] = merged; S.set('week.' + k, merged);
      });
      if (obj.journal) {
        const byDay = {};
        S.journal().concat(obj.journal.filter(U.isObj)).forEach(e => { if (typeof e.d === 'string') byDay[e.d + '|' + (typeof e.c === 'string' ? e.c : '')] = e; });   // one per day and character
        S.saveJournal(Object.keys(byDay).sort().map(d => byDay[d]));
      }
      return { ok: true, message: 'Données importées' };
    },
    clearAll() {
      rawKeys('').forEach(k => rawDel(P + k));
      Object.keys(weeks).forEach(k => delete weeks[k]);
      K.S = conform(null, defaults());
    },
    flushWarn() { booted = true; if (broken) warn(); }
  };
  K.store = S;
})(KATA);
