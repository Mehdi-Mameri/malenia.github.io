/* 14-app.js — bus, derived values, screen registry, hash router, invalidation, clock. Stage 1.
   K.on(evt, fn) / K.emit(evt, payload). Events: 'model' {source} (K.M replaced, BEFORE render),
     'aux' {name} · 'rendered' [topics] · 'live-rendered' (setTimeout 0 after a live render: write S.fired,
     S.lastSeen, journal here) · 'settled' (all 4 requests done) · 'screen' id · 'tick' (every 30 s) · 'week' weekKey.
   K.derive(name, fn(ctx)) + K.get(name): lazy value memoised until the next K.invalidate() (engine queue etc.).
   K.ctx() → {M, R, T, S, W, aux, time, now}.
   K.screens.register(id, {render(ctx) → Safe, mounted?(rootEl, ctx)}) — one per screen id.
   K.invalidate(topic) → next microtask: all screens dirty, current screen + open sheet + status re-render.
   K.router.go(id) · K.router.current() · hash routing «#now», unknown → now. */
(function (K) {
  'use strict';
  const L = window.__LYARA__;

  /* ---------- bus ---------- */
  const subs = {};
  K.on = (evt, fn) => { (subs[evt] || (subs[evt] = [])).push(fn); };
  K.emit = (evt, payload) => { (subs[evt] || []).slice().forEach(fn => K.guard('on:' + evt, () => fn(payload), true)); };

  /* ---------- derived values (memoised per data version) ---------- */
  let ver = 0;
  const derivers = {}, memo = {};
  K.derive = (name, fn) => { derivers[name] = fn; delete memo[name]; };
  K.get = name => {
    const m = memo[name];
    if (m && m.v === ver) { if (m.e) throw m.e; return m.val; }
    const fn = derivers[name];
    if (!fn) throw new Error('valeur dérivée inconnue : ' + name);
    try { const val = fn(K.ctx()); memo[name] = { v: ver, val }; return val; }
    catch (e) { memo[name] = { v: ver, e }; throw e; }
  };
  K.dataVersion = () => ver;

  K.ctx = () => ({ M: K.M, R: K.R, T: K.R ? K.R.targets : {}, S: K.S, W: K.store ? K.store.week() : {}, aux: K.aux, time: K.time.info(), now: Date.now() });

  /* ---------- screens ---------- */
  const IDS = ['now', 'week', 'gear', 'analyse', 'guide'];
  const LABELS = { now: 'Maintenant', week: 'Semaine', gear: 'Stuff', analyse: 'Analyse', guide: 'Guide' };
  const defs = {}, dirty = {}, scrollY = {};
  let current = null;
  const rootOf = id => { const s = document.querySelector('[data-screen="' + id + '"]'); return s && s.querySelector('.screen-root'); };
  const renderScreen = id => {
    const root = rootOf(id), def = defs[id];
    if (!root) return;
    dirty[id] = false;
    if (!def) { K.setHTML(root, K.ui.empty('Écran en préparation.')); return; }
    const ctx = K.ctx();
    K.setHTML(root, K.ui.safeSection('screen:' + id, () => def.render(ctx)));
    if (def.mounted) K.guard('mounted:' + id, () => def.mounted(root, ctx), true);
  };
  K.screens = {
    IDS, LABELS,
    register(id, def) { if (!IDS.includes(id)) throw new Error('écran inconnu : ' + id); defs[id] = def; dirty[id] = true; if (current === id) K.invalidate('screen'); },
    render: id => renderScreen(id || current),
    root: rootOf,
    isReal: id => !!defs[id]
  };

  /* ---------- P1-10 history-aware sheets: opening a sheet pushes one same-URL entry, so the browser Back closes it;
     closing it any other way pops that entry (history.back). A navigation asked while that pop is pending waits for it
     (or 600 ms at most), so it can never be undone by the pop. Deep links: #gear?slot=back · #week?donjon=aof. ---------- */
  const HS = { pushed: false, pending: 0, go: null, ext: null, fromPop: false, timer: null, seq: 0, cur: 0, popId: 0 };
  const settle = () => {
    clearTimeout(HS.timer); HS.pending = 0;
    const g = HS.go, x = HS.ext; HS.go = null; HS.ext = null;
    if (g) K.router.go(g); else if (x && location.hash !== x) location.hash = x;
  };
  K.hist = {
    onOpen(name, arg) {
      if (HS.fromPop) return;
      try { HS.cur = ++HS.seq; history.pushState({ kata: 'sheet', name, arg, id: HS.cur }, ''); HS.pushed = true; } catch (e) { HS.pushed = false; }
    },
    onSwitch(name, arg) { if (HS.pushed) { try { history.replaceState({ kata: 'sheet', name, arg, id: HS.cur }, ''); } catch (e) { /* ignore */ } } },
    onClose() {
      if (HS.fromPop) { HS.fromPop = false; HS.pushed = false; return; }
      if (!HS.pushed) return;
      HS.pushed = false;
      let mine = false;
      try { mine = !!(history.state && history.state.kata === 'sheet' && history.state.id === HS.cur); } catch (e) { mine = false; }
      if (!mine) return;                          // a navigation already moved past the sheet entry: popping would undo it
      HS.pending++; HS.popId = HS.cur;
      try { history.back(); } catch (e) { HS.pending = 0; return; }
      clearTimeout(HS.timer); HS.timer = setTimeout(settle, 600);
    },
    willPop: () => HS.pushed && !HS.fromPop,
    state: () => ({ pushed: HS.pushed, pending: HS.pending })
  };
  window.addEventListener('popstate', e => {
    if (HS.pending > 0) {
      HS.pending--;
      const st = e && e.state;
      if (st && st.kata === 'sheet' && st.id === HS.popId) {           // landed ON the sheet entry: a navigation slipped in
        HS.popId = 0; HS.pending++;                                    // between the close and the pop → step forward again
        try { history.forward(); } catch (x) { HS.pending = 0; settle(); }
        return;
      }
      if (!HS.pending) settle();
      return;
    }
    if (K.sheet && K.sheet.isOpen()) { HS.fromPop = true; K.sheet.close(); }     // browser Back closes the open sheet
  });
  /* deep links: open the matching sheet once, after stripping the query (so closing it leaves a clean #screen) */
  const deep = () => {
    let raw = '';
    try { raw = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch (e) { return; }
    const qi = raw.indexOf('?');
    if (qi < 0) return;
    const id = raw.slice(0, qi), q = {};
    raw.slice(qi + 1).split('&').forEach(p => { const i = p.indexOf('='); if (i > 0) q[p.slice(0, i)] = p.slice(i + 1); });
    let sheet = null, arg = null;
    if (id === 'gear' && K.SLOTS.includes(q.slot)) { sheet = 'gear-slot'; arg = q.slot; }
    if (id === 'week' && q.donjon) {
      const k = K.util.normKey(q.donjon), pool = K.engine ? K.engine.get().radar.pool : [];
      const i = pool.findIndex(d => [d.rd && d.rd.slug, d.short, d.rd && d.rd.name, d.name].some(x => x && K.util.normKey(x) === k));
      if (i >= 0) { sheet = 'sem-dungeon'; arg = String(i); }
    }
    try { history.replaceState(history.state, '', '#' + (IDS.includes(id) ? id : 'now')); } catch (e) { /* ignore */ }
    if (sheet && K.sheet.has(sheet)) K.sheet.open(sheet, arg);
  };

  /* ---------- router ---------- */
  const parse = () => {
    let id = '';
    try { id = decodeURIComponent((location.hash || '').replace(/^#/, '')).split(/[?&/]/)[0]; } catch (e) { id = ''; }
    return IDS.includes(id) ? id : 'now';
  };
  const show = id => {
    if (!IDS.includes(id)) id = 'now';
    const changed = current !== id;
    if (current && changed) scrollY[current] = window.scrollY;
    current = id; L.screen = id;
    document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = s.getAttribute('data-screen') !== id; });
    document.querySelectorAll('[data-nav]').forEach(b => {
      if (b.getAttribute('data-nav') === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (dirty[id] !== false) renderScreen(id);
    if (changed) { window.scrollTo(0, scrollY[id] || 0); K.emit('screen', id); }
  };
  K.router = {
    go(id) {
      if (!IDS.includes(id)) id = 'now';
      if (HS.pending) { HS.go = id; show(id); return; }                 // a sheet entry is being popped: navigate after it
      if (K.sheet && K.sheet.isOpen()) {
        const later = K.hist.willPop();
        K.sheet.close();
        if (later) { HS.go = id; show(id); return; }
      }
      show(id);
      if (location.hash !== '#' + id) location.hash = '#' + id;   // relative: works under any sub-path
    },
    current: () => current,
    init() {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.addEventListener('hashchange', () => {
        if (HS.pending) HS.ext = location.hash;                        // re-applied after the pending pop
        show(parse());
        K.guard('deep-link', deep, true);
      });
      show(parse());
      K.guard('deep-link', deep, true);
    }
  };

  /* ---------- invalidation ---------- */
  let pending = false;
  const topics = new Set();
  const flush = () => {
    pending = false;
    const t = Array.from(topics); topics.clear();
    ver++;
    IDS.forEach(id => { dirty[id] = true; });
    if (current) K.guard('render', () => renderScreen(current), true);
    K.guard('sheet-refresh', () => K.sheet.refresh(), true);
    K.guard('shell', () => K.shell && K.shell.update(), true);
    K.emit('rendered', t);
  };
  K.invalidate = topic => {
    topics.add(topic || 'data');
    if (pending) return;
    pending = true;
    (window.queueMicrotask || (f => Promise.resolve().then(f)))(flush);
  };
  K.flushNow = () => { if (pending) flush(); };

  /* ---------- clock: status/countdowns every 30 s, week rollover → full invalidate ---------- */
  let lastWeek = null, timer = null;
  const tick = () => {
    const wk = K.time.info().weekKey;
    if (lastWeek && wk !== lastWeek) { lastWeek = wk; L.weekKey = wk; K.emit('week', wk); K.invalidate('week'); return; }
    lastWeek = wk; L.weekKey = wk;
    K.guard('tick', () => K.shell && K.shell.update(), true);
    K.emit('tick');
  };
  K.clock = { start() { lastWeek = K.time.info().weekKey; L.weekKey = lastWeek; if (!timer) timer = setInterval(tick, 30000); }, tick };
})(KATA);
