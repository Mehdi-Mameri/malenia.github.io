/* 30-net.js — live data engine (spec §6.2/§6.3). Stage 1. Only https://raider.io/api/v1, GET, Accept header only.
   4 parallel requests: profile (8 s, 1 retry after 1.5 s on network/timeout/5xx/429, CORE fields on HTTP 400),
   affixes / periods / cutoffs (6 s each, optional; 404 is silent). Each settles independently → K.invalidate().
   K.aux.{affixes|periods|cutoffs} = {state 'pending'|'live'|'cached'|'absent'|'error', data, at, status}
     affixes.data = {title, list:[{id, name, description}]} · periods.data = {current:{period,start,end}, next, previous}
     cutoffs.data = {p999|p990|p900|p750: {value, count}} (tentative field names)
   K.net: start() · refresh({force}) (↻ throttled 60 s) · changeCharacter() · profile {state 'idle'|'loading'|'retrying'|
     'ok'|'fail'|'notfound', status, degraded} · phase · lastOkAt · busy. Never loads icon/thumbnail/image URLs. */
(function (K) {
  'use strict';
  const C = K.CONFIG, U = K.util;
  const L = window.__LYARA__;
  const q = o => Object.keys(o).map(k => k + '=' + encodeURIComponent(o[k])).join('&');
  const st = () => K.S.settings;
  const URLS = {
    profile: f => C.api + '/characters/profile?' + q({ region: st().region, realm: st().realm, name: st().name, fields: f.join(',') }),
    affixes: () => C.api + '/mythic-plus/affixes?' + q({ region: st().region, locale: 'fr' }),
    periods: () => C.api + '/periods',
    cutoffs: () => C.api + '/mythic-plus/season-cutoffs?' + q({ region: st().region, season: 'current' })
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const now = () => (window.performance && performance.now ? performance.now() : Date.now());

  const logReq = (name, url, status, t0, extra) => {
    L.requests.push(Object.assign({ name, url, status, ms: Math.round(now() - t0), at: new Date().toISOString() }, extra || {}));
    if (L.requests.length > 60) L.requests.splice(0, L.requests.length - 60);
  };

  const getJSON = async (url, ms, name, extra) => {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, ms);
    const t0 = now();
    try {
      const r = await fetch(url, { signal: ctl ? ctl.signal : undefined, mode: 'cors', credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } });
      logReq(name, url, r.status, t0, extra);
      if (!r.ok) return { ok: false, status: r.status };
      const text = await r.text();
      if (text.length > 3e6) return { ok: false, status: 'trop-gros' };
      return { ok: true, status: r.status, data: JSON.parse(text) };
    } catch (e) {
      const s = e && e.name === 'AbortError' ? 'timeout' : e && e.name === 'SyntaxError' ? 'json' : 'network';
      logReq(name, url, s, t0, extra);
      return { ok: false, status: s };
    } finally { clearTimeout(timer); }
  };

  const transient = x => !x.ok && (x.status === 'network' || x.status === 'timeout' || x.status === 429 || (typeof x.status === 'number' && x.status >= 500));
  const fieldsAll = () => {
    const f = C.fieldsAll.slice(), w = K.R.apiNotes && K.R.apiNotes.weeklyRunsField;
    if (typeof w === 'string' && /^[a-z_:]+$/.test(w) && f.indexOf(w) < 0) f.push(w);
    return f;
  };
  const loadProfile = async my => {
    const all = fieldsAll();
    let r = await getJSON(URLS.profile(all), C.timeouts.profile, 'profile', { attempt: 1 });
    r.requested = all;
    if (transient(r) && my === N.seq) {
      N.profile = { state: 'retrying', status: r.status, degraded: false };
      K.invalidate('net');
      await sleep(C.retryDelay);
      if (my !== N.seq) return r;
      r = await getJSON(URLS.profile(all), C.timeouts.profile, 'profile', { attempt: 2 });
      r.requested = all;
    }
    if (!r.ok && r.status === 400 && my === N.seq) {
      r = await getJSON(URLS.profile(C.fieldsCore), C.timeouts.profile, 'profile', { attempt: 'core', degraded: true });
      r.requested = C.fieldsCore.slice();
      if (r.ok) r.degraded = true;
    }
    if (r.ok && (!U.isObj(r.data) || !('gear' in r.data || 'name' in r.data))) r = { ok: false, status: 'réponse inattendue', requested: r.requested };
    return r;
  };

  /* ---------- aux normalisers (tentative shapes; text stays text) ---------- */
  const normAffixes = d => {
    if (!U.isObj(d)) return undefined;
    const list = U.arr(d.affix_details).filter(U.isObj)
      .map(a => ({ id: U.isNum(a.id) ? a.id : null, name: U.str(a.name), description: U.str(a.description) }))
      .filter(a => a.name);
    return { title: U.str(d.title), list };
  };
  const per = x => (U.isObj(x) ? { period: U.isNum(x.period) ? x.period : null, start: U.isISO(x.start) ? x.start : null, end: U.isISO(x.end) ? x.end : null } : null);
  const normPeriods = d => {
    const reg = st().region;
    const e = U.arr(d && d.periods).find(p => U.isObj(p) && p.region === reg);
    if (!e || !per(e.current) || !per(e.current).end) return undefined;
    return { current: per(e.current), next: per(e.next), previous: per(e.previous) };
  };
  const normCutoffs = d => {
    const c = d && U.isObj(d.cutoffs) ? d.cutoffs : null;
    if (!c) return undefined;
    const out = {};
    ['p999', 'p990', 'p900', 'p750', 'p600'].forEach(k => {
      const a = U.isObj(c[k]) && U.isObj(c[k].all) ? c[k].all : null;
      if (a && U.isNum(a.quantileMinValue)) out[k] = { value: a.quantileMinValue, count: U.isNum(a.quantilePopulationCount) ? a.quantilePopulationCount : null };
    });
    return Object.keys(out).length ? out : undefined;
  };
  const NORM = { affixes: normAffixes, periods: normPeriods, cutoffs: normCutoffs };

  const fresh = () => ({ state: 'pending', data: undefined, at: null, status: null });
  K.aux = { affixes: fresh(), periods: fresh(), cutoffs: fresh() };
  const auxFromCache = cache => {
    Object.keys(NORM).forEach(k => {
      K.aux[k] = fresh();
      if (cache && cache[k] !== undefined && cache[k] !== null) K.aux[k] = { state: 'cached', data: cache[k], at: (cache.at && cache.at[k]) || cache.savedAt || null, status: null };
    });
  };
  K.aux.fromCache = auxFromCache;

  /* ---------- orchestration ---------- */
  const N = (K.net = { phase: 'idle', profile: { state: 'idle', status: null, degraded: false }, lastOkAt: null, lastTryAt: null, busy: false, seq: 0, URLS, getJSON });
  const setPhase = p => { N.phase = p; L.phase = p; };

  const applyProfile = r => {
    if (r.ok) {
      const at = new Date().toISOString();
      const M = K.model.normalize(r.data, 'live', { at, requested: r.requested, degraded: !!r.degraded });
      K.model.set(M);
      N.profile = { state: 'ok', status: r.status, degraded: !!r.degraded };
      N.lastOkAt = Date.now();
      K.store.writeCache({ profile: K.model.trim(r.data), requested: r.requested, degraded: !!r.degraded, at: { profile: at } });
      K.emit('model', { source: 'live' });
      K.invalidate('profile');
      setTimeout(() => K.emit('live-rendered'), 0);
    } else {
      N.profile = { state: r.status === 404 ? 'notfound' : 'fail', status: r.status, degraded: false };
      if (K.M.source === 'live') { K.M.source = 'cached'; L.state = 'cached'; }   // data from earlier this session = cache
      K.invalidate('net');
    }
  };
  const applyAux = (name, r) => {
    const a = K.aux[name];
    if (r.ok) {
      const data = NORM[name](r.data);
      if (data !== undefined) {
        const at = new Date().toISOString();
        K.aux[name] = { state: 'live', data, at, status: r.status };
        const patch = { at: {} }; patch[name] = data; patch.at[name] = at;
        K.store.writeCache(patch);
      } else K.aux[name] = Object.assign({}, a, { state: a.state === 'cached' ? 'cached' : 'absent', status: 'forme inattendue' });
    } else {
      K.aux[name] = Object.assign({}, a, { state: a.state === 'cached' ? 'cached' : r.status === 404 ? 'absent' : 'error', status: r.status });
    }
    K.emit('aux', { name });
    K.invalidate('aux');
  };

  N.start = () => {
    if (N.busy) return Promise.resolve();
    const my = ++N.seq;
    N.busy = true; N.lastTryAt = Date.now();
    setPhase('fetching');
    N.profile = { state: 'loading', status: null, degraded: false };
    K.invalidate('net');
    const guard = fn => r => { if (my === N.seq) K.guard('net', () => fn(r), true); };
    const jobs = [
      loadProfile(my).then(guard(applyProfile)),
      getJSON(URLS.affixes(), C.timeouts.other, 'affixes').then(guard(r => applyAux('affixes', r))),
      getJSON(URLS.periods(), C.timeouts.other, 'periods').then(guard(r => applyAux('periods', r))),
      getJSON(URLS.cutoffs(), C.timeouts.other, 'cutoffs').then(guard(r => applyAux('cutoffs', r)))
    ];
    return Promise.allSettled(jobs).then(() => {
      if (my !== N.seq) return;
      N.busy = false;
      setPhase('settled');
      K.emit('settled');
      K.invalidate('net');
    });
  };
  N.refresh = opts => {
    opts = opts || {};
    if (N.busy) { K.toast('Mise à jour déjà en cours…'); return; }
    const since = N.lastOkAt ? Date.now() - N.lastOkAt : Infinity;
    if (!opts.force && since < C.refreshThrottle) { K.toast('Déjà à jour il y a ' + Math.max(1, Math.round(since / 1000)) + ' s'); return; }
    N.start();
  };
  /* Réglages › Personnage: drop the in-memory model, show that character's cache (or snapshot / empty), refetch once */
  N.changeCharacter = () => {
    N.seq++; N.busy = false; N.lastOkAt = null;
    const cache = K.store.readCache();
    auxFromCache(cache);
    K.model.set(K.model.initial(cache));
    N.profile = { state: 'idle', status: null, degraded: false };
    K.emit('model', { source: K.M.source });
    K.invalidate('profile');
    return N.start();
  };
  K.act('refresh', () => N.refresh());
  K.act('retry', () => N.refresh({ force: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || N.busy) return;
    const t = Date.now();
    if ((!N.lastOkAt || t - N.lastOkAt > C.autoRefreshAfter) && (!N.lastTryAt || t - N.lastTryAt > C.refreshThrottle)) N.start();
  });
  window.addEventListener('online', () => { if (!N.busy && N.profile.state === 'fail') N.start(); });
})(KATA);
