/* 10-dom.js — escape-by-default templating + the ONLY innerHTML sink + event delegation. Stage 1.
   K.h`…${v}…`  → Safe (every interpolation escaped; Safe / arrays of Safe pass through;
                  null/undefined/false/true render as '').
   K.raw(s)     → Safe, ONLY for static markup written in this code base (never API text).
   K.setHTML(el, safe) → the only allowed innerHTML write (build fails on innerHTML elsewhere).
                  Keeps focus, <details data-key> open state and the focused field's value.
   K.icon(name, cls?) → sprite <svg><use href="#i-name">.
   K.vars({'--p':'42%'}) → ` data-var="…"` attribute; applied with CSSOM after render (CSP forbids inline style attributes).
   K.act(verb, fn(el, ev))      ← click on [data-act="verb"]
   K.onChange(verb, fn(el, ev)) ← change on [data-change="verb"]
   K.onInput(verb, fn(el, ev))  ← input on [data-input="verb"]
   [data-nav] / [data-go="<screen>"] clicks route via K.router.go.
   K.report(where, err) → __LYARA__.errors + console.warn (never console.error).
   K.guard(where, fn) → runs fn, reports + toasts on exception. */
(function (K) {
  'use strict';

  class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
  const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => MAP[c]);
  const enc = v => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(enc).join('')
    : v == null || v === false || v === true ? '' : esc(v));
  const h = (strs, ...vals) => { let o = strs[0]; for (let i = 0; i < vals.length; i++) o += enc(vals[i]) + strs[i + 1]; return new Safe(o); };
  const raw = s => new Safe(String(s));
  K.Safe = Safe; K.esc = esc; K.h = h; K.raw = raw;
  K.join = (list, sep) => { const out = []; (list || []).forEach((x, i) => { if (i) out.push(sep instanceof Safe ? sep : esc(sep == null ? '' : sep)); out.push(x instanceof Safe ? x.s : esc(x)); }); return raw(out.join('')); };

  K.$ = (sel, root) => (root || document).querySelector(sel);
  K.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  K.icon = (name, cls) => (/^[a-z0-9-]+$/.test(name)
    ? raw('<svg class="i' + (cls ? ' ' + esc(cls) : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>')
    : raw(''));

  const VAR_K = /^--[a-z0-9-]+$/, VAR_V = /^[-+#.%\w ()]{1,40}$/;
  K.vars = obj => {
    const parts = Object.keys(obj || {}).filter(k => VAR_K.test(k) && VAR_V.test(String(obj[k]))).map(k => k + ':' + obj[k]);
    return parts.length ? raw(' data-var="' + esc(parts.join(';')) + '"') : raw('');
  };
  const applyVars = root => {
    root.querySelectorAll('[data-var]').forEach(n => {
      n.getAttribute('data-var').split(';').forEach(p => {
        const i = p.indexOf(':'); if (i < 1) return;
        const k = p.slice(0, i).trim(), v = p.slice(i + 1).trim();
        if (VAR_K.test(k) && VAR_V.test(v)) n.style.setProperty(k, v);
      });
    });
  };
  K.applyVars = applyVars;

  const SIG = ['id', 'data-act', 'data-arg', 'data-sheet', 'data-change', 'data-input', 'data-nav', 'data-go', 'data-key', 'name'];
  const sigOf = el => el.tagName + '|' + SIG.map(a => el.getAttribute(a) || '').join('|');
  const findSig = (root, sig) => { for (const el of root.querySelectorAll('*')) if (sigOf(el) === sig) return el; return null; };

  K.setHTML = (el, safe) => {
    if (!el) return;
    if (!(safe instanceof Safe)) safe = h`${safe}`;           // plain values are escaped, never parsed
    const act = document.activeElement;
    const inside = act && act !== document.body && el.contains(act);
    const sig = inside ? sigOf(act) : null;
    const isField = inside && /^(INPUT|TEXTAREA|SELECT)$/.test(act.tagName);
    const val = isField ? act.value : null;
    const open = new Set(Array.from(el.querySelectorAll('details[data-key][open]')).map(d => d.getAttribute('data-key')));
    el.innerHTML = safe.s;
    applyVars(el);
    if (open.size) el.querySelectorAll('details[data-key]').forEach(d => { if (open.has(d.getAttribute('data-key'))) d.open = true; });
    if (sig) {
      const again = findSig(el, sig);
      if (again) { if (isField && again.value !== val) again.value = val; try { again.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
  };

  /* ---------- error sink ---------- */
  K.report = (where, err) => {
    const L = window.__LYARA__;
    const msg = err && (err.message || String(err)) || 'erreur inconnue';
    if (L && L.errors.length < 50) L.errors.push({ where: String(where), message: String(msg).slice(0, 300), at: new Date().toISOString() });
    try { console.warn('[KATA]', where, err); } catch (e) { /* ignore */ }
  };
  K.guard = (where, fn, quiet) => {
    try { return fn(); } catch (e) {
      K.report(where, e);
      if (!quiet && K.toast) K.toast('Action impossible · Détails dans Diagnostic');
      return undefined;
    }
  };

  /* ---------- event delegation (no inline handlers anywhere) ---------- */
  const clicks = {}, changes = {}, inputs = {};
  K.act = (verb, fn) => { clicks[verb] = fn; };
  K.onChange = (verb, fn) => { changes[verb] = fn; };
  K.onInput = (verb, fn) => { inputs[verb] = fn; };
  const run = (map, attr, e) => {
    const t = e.target instanceof Element ? e.target.closest('[' + attr + ']') : null;
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    const verb = t.getAttribute(attr), fn = map[verb];
    if (fn) K.guard(attr + ':' + verb, () => fn(t, e));
  };
  document.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const nav = t.closest('[data-nav],[data-go]');
    if (nav && K.router) {
      e.preventDefault();
      K.guard('nav', () => K.router.go(nav.getAttribute('data-nav') || nav.getAttribute('data-go')));
      return;
    }
    run(clicks, 'data-act', e);
  });
  document.addEventListener('change', e => run(changes, 'data-change', e));
  document.addEventListener('input', e => run(inputs, 'data-input', e));
  window.addEventListener('error', e => { if (e && e.error) K.report('window', e.error); });
  window.addEventListener('unhandledrejection', e => K.report('promise', e && e.reason));
})(KATA);
