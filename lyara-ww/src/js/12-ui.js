/* 12-ui.js — UI primitives. Stage 1.
   K.ui.safeSection(id, fn) → fn() as Safe, or the «Section indisponible» card (+ __LYARA__.errors, console.warn).
   K.toast(text, {undo?: fn, ms?: 5000})      role=status toast, optional «Annuler».
   K.sheet.define(name, {title: str|fn(arg), render(arg, ctx) → Safe, mounted?(bodyEl, arg), qa?})
   K.sheet.open(name, arg?, openerEl?)  ·  K.sheet.show(title, safeBody)  ·  K.sheet.close()  ·  K.sheet.refresh()
     markup: <button data-act="sheet" data-sheet="name" data-arg="internal-id">. Closes via «Fermer», backdrop, Esc;
     focus returns to the opener. Open named sheets re-render on every K.invalidate().
   K.ui.prov(kind, detail?)  kinds: live · cached · snapshot · research · lastknown · estimate · calc · declared · unknown
   K.ui.provM()  chip for the current profile data (K.M.source) · K.ui.provResearch() «Recherche 28/09»
   K.ui.conf(level) confidence glyph (haute/moyenne/basse) · K.ui.confMin(...levels)
   K.ui.unknown(reason?) «—» + «?» button showing the reason (never 0) · K.ui.note(text) → key for data-act="note"
   K.ui.stepper(verb, label, text, {lo, hi}?) + K.ui.stepDir(el) → −1|+1 · K.ui.empty(text) · K.ui.skel(h, w?) · K.ui.lastKnownCard() (research «base Raider.IO», never live)
   K.copy(text, {title?, done?}) clipboard → execCommand → «Copie manuelle» sheet (data-qa="copy-manual") */
(function (K) {
  'use strict';
  const { h, raw, icon } = K;
  const F = K.fmt;
  const UI = (K.ui = {});

  /* ---------- error boundary ---------- */
  UI.sectionError = id => h`<div class="card sec-err" data-sec="${id}" role="note">${icon('alert')}<span>Section indisponible · Détails dans Diagnostic</span></div>`;
  UI.safeSection = (id, fn) => {
    try { const out = fn(); return out instanceof K.Safe ? out : h`${out}`; }
    catch (e) { K.report('section:' + id, e); return UI.sectionError(id); }
  };

  /* ---------- toast ---------- */
  let toastTimer = null, toastUndo = null;
  const hideToast = () => { const el = document.getElementById('toast'); if (el) el.hidden = true; toastUndo = null; };
  K.toast = (text, opts) => {
    opts = opts || {};
    const el = document.getElementById('toast'); if (!el) return;
    const dlg = document.getElementById('sheet');
    const host = dlg && dlg.open ? dlg : document.body;          // stay visible above a modal sheet
    if (el.parentNode !== host) host.appendChild(el);
    toastUndo = typeof opts.undo === 'function' ? opts.undo : null;
    K.setHTML(el, h`<span class="toast-t">${text}</span>${toastUndo ? h`<button type="button" class="btn btn-ghost btn-sm" data-act="toast-undo">Annuler</button>` : ''}`);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, opts.ms || 5000);
  };
  K.act('toast-undo', () => { const f = toastUndo; hideToast(); if (f) f(); });

  /* ---------- sheet (<dialog> + showModal) ---------- */
  const defs = {};
  let cur = null;                                                  // {name, arg, opener}
  const dlgEl = () => document.getElementById('sheet');
  const renderSheet = keepScroll => {
    const d = dlgEl(), def = cur && defs[cur.name];
    if (!d || !def) return;
    const oldBody = d.querySelector('.sheet-b');
    const top = keepScroll && oldBody ? oldBody.scrollTop : 0;
    const ctx = K.ctx ? K.ctx() : {};
    let title = 'Détails';
    try { title = typeof def.title === 'function' ? def.title(cur.arg, ctx) : def.title || title; } catch (e) { K.report('sheet-title:' + cur.name, e); }
    const body = UI.safeSection('sheet:' + cur.name, () => def.render(cur.arg, ctx));
    const toast = document.getElementById('toast');                // K.toast may have moved it into the dialog:
    if (toast && toast.parentNode === d) document.body.appendChild(toast);   // keep it out of the re-render
    K.setHTML(d, h`<div class="sheet-in"><div class="sheet-grab" aria-hidden="true"></div><div class="sheet-h"><h2 id="sheet-title">${title}</h2><button type="button" class="btn btn-ghost sheet-x" data-act="sheet-close">${icon('cross')}<span>Fermer</span></button></div><div class="sheet-b"${def.qa ? raw(' data-qa="' + K.esc(def.qa) + '"') : ''}>${body}</div></div>`);
    const nb = d.querySelector('.sheet-b');
    if (def.mounted) K.guard('sheet-mounted:' + cur.name, () => def.mounted(nb, cur.arg), true);
    if (top) nb.scrollTop = top;
    if (toast && !toast.hidden && d.open) d.appendChild(toast);    // a visible toast stays above the modal sheet
  };
  let adhoc = null;
  K.sheet = {
    define(name, def) { defs[name] = def; },
    has: name => !!defs[name],
    open(name, arg, opener) {
      if (!defs[name]) { K.report('sheet', new Error('feuille inconnue : ' + name)); return; }
      const d = dlgEl(); if (!d) return;
      const wasOpen = !!(cur && d.open), keep = wasOpen ? cur.opener : null;
      cur = { name, arg: arg == null ? null : String(arg), opener: keep || opener || document.activeElement };
      renderSheet(false);
      if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
      const x = d.querySelector('.sheet-x'); if (x) x.focus({ preventScroll: true });
      window.__LYARA__.sheet = name;
      if (K.hist) K.guard('hist', () => (wasOpen ? K.hist.onSwitch(name, cur.arg) : K.hist.onOpen(name, cur.arg)), true);   // P1-10
    },
    show(title, body, opener) { adhoc = { title, body }; K.sheet.open('__adhoc', null, opener); },
    close() { const d = dlgEl(); if (d && d.open) d.close(); },
    refresh() { const d = dlgEl(); if (cur && d && d.open && cur.name !== '__adhoc') renderSheet(true); },
    current: () => (cur ? { name: cur.name, arg: cur.arg } : null),
    isOpen: () => { const d = dlgEl(); return !!(d && d.open); }
  };
  K.sheet.define('__adhoc', { title: () => (adhoc ? adhoc.title : ''), render: () => (adhoc ? adhoc.body : h``) });
  UI.initSheet = () => {
    const d = dlgEl(); if (!d) return;
    d.addEventListener('close', () => {
      if (K.hist) K.guard('hist', () => K.hist.onClose(), true);   // P1-10: drop the sheet's history entry
      const o = cur && cur.opener;
      cur = null; adhoc = null; window.__LYARA__.sheet = null;
      const t = document.getElementById('toast'); if (t && t.parentNode === d) document.body.appendChild(t);
      if (o && o.isConnected && typeof o.focus === 'function') { try { o.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    });
    d.addEventListener('click', e => { if (e.target === d) K.sheet.close(); });   // backdrop tap
  };
  K.act('sheet', el => K.sheet.open(el.getAttribute('data-sheet'), el.getAttribute('data-arg'), el));
  K.act('sheet-close', () => K.sheet.close());

  /* ---------- copy: clipboard API → textarea + execCommand → «Copie manuelle» sheet (spec §8.4, P0-12) ----------
     K.copy(text, {title?, done?: toast text}) */
  let manual = { title: '', text: '' };
  K.sheet.define('copy', {
    title: () => manual.title || 'Copie manuelle',
    qa: 'copy-manual',
    render: () => h`<p class="lead">Copie automatique impossible ici : le texte est sélectionné, copie-le avec le menu du système.</p><textarea class="input mono cp-ta" readonly rows="8" aria-label="Texte à copier">${manual.text}</textarea>`,
    mounted(body) { const t = body.querySelector('textarea'); if (t) { try { t.focus({ preventScroll: true }); t.select(); t.setSelectionRange(0, t.value.length); } catch (e) { /* ignore */ } } }
  });
  const legacyCopy = text => {
    const host = (K.sheet.isOpen() && dlgEl()) || document.body, ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr-only';
    host.appendChild(ta);
    let ok = false;
    try { ta.select(); ta.setSelectionRange(0, text.length); ok = !!(document.execCommand && document.execCommand('copy')); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  };
  K.copy = (text, o) => {
    o = o || {}; text = String(text || '');
    const done = () => K.toast(o.done || 'Copié dans le presse-papiers');
    const fb = () => { if (legacyCopy(text)) done(); else { manual = { title: o.title || 'Copie manuelle', text }; K.sheet.open('copy'); } };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fb);
      else fb();
    } catch (e) { fb(); }
  };

  /* ---------- provenance chip (spec §7.1) ---------- */
  const PROV = {
    live: ['dot', 'Live'], cached: ['ring', 'Cache'], snapshot: ['diamond', 'Snapshot'], research: ['book', 'Recherche'],
    lastknown: ['book', 'Relevé du'], estimate: ['approx', 'Estimation'], calc: ['approx', 'Calcul KATA'],
    declared: ['hand', 'Déclaré'], unknown: ['dotted', 'Inconnu']
  };
  UI.prov = (kind, detail) => {
    const k = PROV[kind] ? kind : 'unknown', p = PROV[k];
    const sep = k === 'live' || k === 'cached' ? ' · ' : ' ';
    const label = detail ? p[1] + sep + detail : p[1];
    return h`<span class="prov prov-${k}">${icon(p[0])}<span>${label}</span></span>`;
  };
  UI.provM = M => {
    M = M || K.M || {};
    if (M.source === 'live') return UI.prov('live', F.hhmm(M.at));
    if (M.source === 'cached') return UI.prov('cached', F.rel(M.at));
    if (M.source === 'snapshot') return UI.prov('snapshot', F.ddmm(M.at));
    return UI.prov('unknown');
  };
  UI.provResearch = () => UI.prov('research', K.research ? K.research.asOfFR : '');

  /* ---------- confidence glyph (3 bars 14×12, ink2) ---------- */
  const CONF_N = { haute: 3, moyenne: 2, basse: 1 };
  UI.CONF_ORDER = ['basse', 'moyenne', 'haute'];
  UI.confMin = (...levels) => {
    const ok = levels.filter(l => CONF_N[l]);
    return ok.length ? ok.reduce((a, b) => (CONF_N[b] < CONF_N[a] ? b : a)) : null;
  };
  UI.conf = level => {
    const n = CONF_N[level] || 0, word = n ? level : 'inconnue';
    let bars = '';
    for (let i = 0; i < 3; i++) {
      const hh = 4 + i * 4, x = i * 5;
      bars += i < n ? `<rect x="${x}" y="${12 - hh}" width="4" height="${hh}" rx="1" fill="currentColor"/>`
        : `<rect x="${x + 0.5}" y="${12 - hh + 0.5}" width="3" height="${hh - 1}" rx="1" fill="none" stroke="currentColor"/>`;
    }
    return raw(`<svg class="cg" width="14" height="12" viewBox="0 0 14 12" role="img" aria-label="Confiance : ${word}">${bars}</svg>`);
  };

  /* ---------- unknown value «—» + reason ---------- */
  const notes = new Map(), noteByText = new Map();
  UI.note = text => {
    text = String(text);
    if (noteByText.has(text)) return noteByText.get(text);
    const key = 'n' + (notes.size + 1).toString(36);
    notes.set(key, text); noteByText.set(text, key);
    return key;
  };
  UI.unknown = reason => h`<span class="unk">—${reason ? h`<button type="button" class="unk-q" data-act="note" data-arg="${UI.note(reason)}" aria-label="Pourquoi ?">?</button>` : ''}</span>`;
  K.act('note', el => { const t = notes.get(el.getAttribute('data-arg')); if (t) K.toast(t); });

  /* stepper «− value +» (44 px buttons, data-arg '-' | '+'); lim = {lo, hi}: true disables that end */
  UI.stepper = (verb, label, text, lim) => h`<span class="stp"><button type="button" class="btn btn-sm stp-b" data-act="${verb}" data-arg="-" aria-label="Diminuer : ${label}"${lim && lim.lo ? raw(' disabled') : ''}>${icon('minus')}</button><output class="num stp-v" aria-live="polite">${text}</output><button type="button" class="btn btn-sm stp-b" data-act="${verb}" data-arg="+" aria-label="Augmenter : ${label}"${lim && lim.hi ? raw(' disabled') : ''}>${icon('plus')}</button></span>`;
  UI.stepDir = el => (el.getAttribute('data-arg') === '-' ? -1 : 1);

  UI.empty = text => h`<p class="empty">${text}</p>`;
  UI.skel = (hpx, w) => h`<span class="skel" aria-hidden="true"${K.vars({ '--h': (hpx || 16) + 'px', '--w': w || '100%' })}></span>`;

  /* research «lastKnown» progression (override 5): clearly labelled, never styled as live */
  UI.lastKnownCard = () => {
    const lk = K.research && K.research.lastKnown();
    if (!lk) return h``;
    return h`<div class="card lk" data-qa="lastknown"><div class="card-h"><p class="over">Dernière progression connue</p>${UI.prov('lastknown', lk.date)}</div><p class="t-call ink2 any">${lk.text}</p><p class="card-foot">Relevé de la recherche (ton export SimC et la base Raider.IO) : ce n\'est pas une donnée en direct.</p></div>`;
  };
})(KATA);
