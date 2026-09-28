/* 85-settings.js — «Réglages» sheet (spec P0-15): personnage, reset, soirée, soirs de raid, châsses probables,
   hypothèses de projection, export / import / effacer (two-step, in-app), constantes CONFIG with confidence,
   Diagnostic entry, «À propos». Stage 3b. Defines the «settings» sheet and the «settings-char» verb
   (the header cog opens it).
   Verbs: settings-char · set-evening / set-raidmin (+|-) · set-raid-night (dow) · set-socket (slot) ·
   set-reset-dow / set-reset-h (change) · exp-open · exp-copy · imp-run (+ input imp-text) · wipe-1 / wipe-2 / wipe-0.
   Changing the character clears S.fired / S.closed (derived gap history of the previous character). */
(function (K) {
  'use strict';
  const { h, icon, raw } = K;
  const F = K.fmt, U = K.util, UI = K.ui, C = K.CONFIG;
  const isNum = U.isNum, S_ = U.str;
  const SF = s => K.SLOT_FR[s] || s;
  const DOW = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const WEEK = [3, 4, 5, 6, 0, 1, 2];                                   // reset week: mercredi → mardi
  const pad = n => (n < 10 ? '0' : '') + n;
  const fm = m => K.engine.fmtMin(m);
  const ui = { exp: false, wipe: false, imp: '', draft: {} };
  const save = t => { K.store.save(); K.invalidate(t || 'settings'); };
  const opt = (v, label, cur) => h`<option value="${v}"${String(v) === String(cur) ? raw(' selected') : ''}>${label}</option>`;
  const sec = (t, body) => h`<section class="set-s"><h3 class="over">${t}</h3>${body}</section>`;
  const pr = b => (b ? 'true' : 'false');
  const CV = {
    reset: () => DOW[C.reset.dow] + ' ' + pad(C.reset.hourUTC) + ':00 UTC',
    vault: () => 'donjons ' + C.vault.mplus.join('/') + ' · raid ' + C.vault.raid.join('/') + ' · monde ' + C.vault.world.join('/'),
    chest: () => '+2 sous ' + Math.round(C.chest.plus2 * 100) + ' % · +3 sous ' + Math.round(C.chest.plus3 * 100) + ' % du temps',
    keyOverheadMin: () => C.keyOverheadMin + ' min', weeklyListCap: () => C.weeklyListCap + ' clés',
    likelySocketSlots: () => C.likelySocketSlots.map(SF).join(', '), tierSlotsDefault: () => C.tierSlotsDefault.map(SF).join(', '),
    score: () => 'internes, jamais affichées', additiveTolerance: () => Math.round(C.additiveTolerance * 100) + ' %'
  };

  K.sheet.define('settings', {
    title: 'Réglages',
    qa: 'settings',
    render(arg, c) {
      const s = c.S.settings, pl = c.R.meta.player || {}, t = c.time, ib = c.R.raid.ilvlByDifficulty;
      const ev = isNum(s.eveningMin) ? s.eveningMin : 180, rn = isNum(s.raidNightMin) ? s.raidNightMin : 150;
      const per = isNum(s.itemsPerWeek) ? s.itemsPerWeek : 1.5, v = isNum(s.newItemIlvl) ? s.newItemIlvl : ib.heroic;
      const okStore = K.store.ok(), rz = U.obj(s.reset);
      return h`
        ${sec('Personnage', h`<div class="set-g">
            <label class="field"><span>Région</span><select class="input" data-key="set-region" data-input="set-draft">${['eu', 'us', 'kr', 'tw'].map(r => opt(r, r.toUpperCase(), s.region))}</select></label>
            <label class="field"><span>Royaume</span><input class="input" data-key="set-realm" data-input="set-draft" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
            <label class="field"><span>Nom</span><input class="input" data-key="set-name" data-input="set-draft" autocomplete="off" autocapitalize="off" spellcheck="false"></label></div>
          <button type="button" class="btn btn-primary" data-act="settings-char">${icon('check')}<span>Enregistrer et recharger</span></button>
          ${pl.name ? h`<p class="t-cap muted">Par défaut (recherche) : ${pl.name}${pl.realm ? ' · ' + pl.realm : ''}${pl.region ? ' · ' + S_(pl.region).toUpperCase() : ''}</p>` : ''}`)}
        ${sec('Reset hebdomadaire', h`<div class="set-2">
            <label class="field"><span>Jour</span><select class="input" data-change="set-reset-dow">${WEEK.map(d => opt(d, DOW[d], rz.dow))}</select></label>
            <label class="field"><span>Heure (UTC)</span><select class="input" data-change="set-reset-h">${Array.from({ length: 24 }, (_, i) => opt(i, pad(i) + ':00', rz.hourUTC))}</select></label></div>
          <p class="t-call ink2">Prochain reset : ${F.dayLong(t.resetAt)} · ${t.source === 'raider.io' ? 'confirmé par raider.io' : 'calcul · à vérifier'} ${UI.conf(t.source === 'raider.io' ? 'haute' : C.reset.conf)}</p>`)}
        ${sec('Soirée', h`<div class="set-r"><span class="t-call">Durée d'une soirée («Soirée»)</span>${K.pv.stepper('set-evening', 'durée d\'une soirée', fm(ev))}</div>
          <div class="set-r"><span class="t-call">Durée d'un soir de raid</span>${K.pv.stepper('set-raidmin', 'durée d\'un soir de raid', fm(rn))}</div>`)}
        ${sec('Soirs de raid', h`<div class="chips">${WEEK.map(d => h`<button type="button" class="chip chip-btn" data-act="set-raid-night" data-arg="${d}" aria-pressed="${pr(U.arr(s.raidNights).includes(d))}">${DOW[d]}</button>`)}</div>
          <p class="t-cap muted">Ces soirs-là, «Soirée» devient «Avant le raid» (préparation seulement).</p>`)}
        ${sec('Emplacements à châsse probables', h`<div class="chips">${K.SLOTS_EXPECTED.map(x => h`<button type="button" class="chip chip-btn" data-act="set-socket" data-arg="${x}" aria-pressed="${pr(U.arr(s.socketSlots).includes(x))}">${SF(x)}</button>`)}</div>
          <p class="t-cap muted">raider.io ne donne pas le nombre de châsses ${UI.conf(C.info.likelySocketSlots.conf)} : une gemme absente reste «châsse ? à vérifier».</p>`)}
        ${sec('Hypothèses de projection', h`<div class="set-r"><span class="t-call">Objets par semaine</span>${K.pv.stepper('proj-per', 'objets par semaine', F.num(per, per % 1 ? 1 : 0))}</div>
          <div class="set-r"><span class="t-call">iLvl des nouveaux objets</span>${K.pv.stepper('proj-v', 'ilvl des nouveaux objets', isNum(v) ? String(v) : F.DASH)}</div>
          ${isNum(s.newItemIlvl) && isNum(ib.heroic) ? h`<button type="button" class="btn btn-ghost btn-sm" data-act="proj-v" data-arg="x">${icon('refresh', 'i-sm')}<span>Revenir au Héroïque (${ib.heroic})</span></button>` : ''}
          <p class="t-cap muted">≈ Estimation : utilisées par Analyse › Portes du Mythique et par l'objectif iLvl.</p>`)}
        ${sec('Mes données', h`
          ${!okStore ? h`<p class="callout">${icon('alert', 'i-sm')} Tes coches ne seront pas mémorisées sur cet appareil : stockage indisponible, export désactivé.</p>` : ''}
          ${K.store.standalone() ? h`<p class="callout">Mode écran d'accueil : tes données sont séparées de celles de Chrome. Utilise Exporter/Importer.</p>` : ''}
          <div class="btn-row"><button type="button" class="btn" data-act="exp-open"${okStore ? '' : raw(' disabled')}>${icon('copy')}<span>${ui.exp ? 'Masquer l\'export' : 'Exporter mes données'}</span></button></div>
          ${ui.exp && okStore ? h`<textarea class="input set-ta" readonly rows="6" aria-label="Export de tes données (JSON)">${JSON.stringify(K.store.exportAll())}</textarea>
            <button type="button" class="btn btn-primary" data-act="exp-copy">${icon('copy')}<span>Copier</span></button>
            <p class="t-cap muted">Réglages, coches, 6 dernières semaines et journal. Garde-le pour le réimporter ailleurs.</p>` : ''}
          <label class="field"><span>Importer (colle un export)</span><textarea class="input set-ta" rows="4" data-input="imp-text" spellcheck="false" autocapitalize="off"></textarea></label>
          <button type="button" class="btn" data-act="imp-run">${icon('check')}<span>Importer</span></button>
          ${ui.wipe ? h`<div class="callout set-wipe"><p class="t-call ink">Effacer réglages, coches, semaines, journal et cache sur cet appareil ?</p><div class="btn-row">
              <button type="button" class="btn btn-danger" data-act="wipe-2">${icon('cross')}<span>Oui, tout effacer</span></button><button type="button" class="btn" data-act="wipe-0"><span>Annuler</span></button></div></div>`
            : h`<button type="button" class="btn btn-ghost" data-act="wipe-1">${icon('cross')}<span>Effacer mes données</span></button>`}`)}
        ${sec('Constantes de travail', h`<details data-key="set-cfg"><summary class="t-call">Voir les ${Object.keys(C.info).length} constantes et leur confiance ${icon('chevron', 'i-sm')}</summary>
          <ul class="rows">${Object.keys(C.info).map(k => h`<li class="row"><span class="grow"><span class="ink">${C.info[k].label}</span><br><span class="t-cap ink2">${CV[k] ? CV[k]() : ''}</span></span>${UI.conf(C.info[k].conf)}</li>`)}</ul>
          <p class="t-cap muted">Hypothèses de travail du bloc CONFIG, modifiables dans le code ; aucune donnée de la recherche n'y est codée en dur.</p></details>`)}
        ${sec('À propos', h`<dl class="kv"><dt>Version</dt><dd class="mono">${C.version}</dd><dt>Recherche</dt><dd>du ${K.research.asOfFR} · ${F.count(K.research.sourceCount, 'source', 'sources')}${K.research.ok ? '' : ' · illisible'}</dd>
            <dt>Stockage</dt><dd>${okStore ? 'cet appareil (localStorage)' : 'mémoire seule'}</dd></dl>
          <button type="button" class="btn" data-act="sheet" data-sheet="diag">${icon('info')}<span>Diagnostic</span></button>`)}`;
    },
    mounted(body) {
      const s = K.S.settings;
      const set = (k, v) => { const el = body.querySelector('[data-key="' + k + '"]'); if (el && document.activeElement !== el) el.value = v; };
      const dr = k => (ui.draft[k] !== undefined ? ui.draft[k] : s[k.slice(4)]);
      set('set-region', dr('set-region')); set('set-realm', dr('set-realm')); set('set-name', dr('set-name'));
      const ta = body.querySelector('[data-input="imp-text"]');
      if (ta && document.activeElement !== ta) ta.value = ui.imp;
    }
  });
  K.on('booted', () => {
    const d = document.getElementById('sheet');
    if (d) d.addEventListener('close', () => { ui.exp = false; ui.wipe = false; ui.draft = {}; });
  });

  /* ---------- personnage ---------- */
  const charKey = s => [s.region, s.realm, s.name].join('/').toLowerCase();
  const charChanged = before => {
    if (charKey(K.S.settings) === before) return false;
    K.S.fired = {}; K.S.closed = {};
    K.store.save();
    K.net.changeCharacter();
    return true;
  };
  K.act('settings-char', el => {
    const body = el.closest('.sheet-b'); if (!body) return;
    const v = k => { const x = body.querySelector('[data-key="' + k + '"]'); return x ? x.value.trim() : ''; };
    const region = v('set-region').toLowerCase(), realm = U.slugify(v('set-realm')), name = v('set-name');
    if (!/^(eu|us|kr|tw)$/.test(region) || !realm || !name) { K.toast('Région, royaume et nom sont requis'); return; }
    const before = charKey(K.S.settings);
    Object.assign(K.S.settings, { region, realm, name });
    if (charKey(K.S.settings) === before) { K.store.save(); K.toast('Personnage inchangé'); return; }
    K.sheet.close();
    charChanged(before);
    K.toast('Personnage enregistré · rechargement');
  });

  /* ---------- reset / soirée / raid nights / sockets ---------- */
  K.onChange('set-reset-dow', el => { const d = Number(el.value); if (d >= 0 && d <= 6) { K.S.settings.reset = Object.assign({}, K.S.settings.reset, { dow: d }); save('reset'); } });
  K.onChange('set-reset-h', el => { const x = Number(el.value); if (x >= 0 && x <= 23) { K.S.settings.reset = Object.assign({}, K.S.settings.reset, { hourUTC: x }); save('reset'); } });
  const step = (key, lo, hi, dflt) => el => {
    const s = K.S.settings, cur = isNum(s[key]) ? s[key] : dflt;
    s[key] = U.clamp(cur + (el.getAttribute('data-arg') === '+' ? 15 : -15), lo, hi);
    save('settings');
  };
  K.act('set-evening', step('eveningMin', 30, 480, 180));
  K.act('set-raidmin', step('raidNightMin', 30, 360, 150));
  const toggle = (key, val) => { const s = K.S.settings, l = U.arr(s[key]); s[key] = l.includes(val) ? l.filter(x => x !== val) : l.concat(val); save('settings'); };
  K.act('set-raid-night', el => { const d = Number(el.getAttribute('data-arg')); if (d >= 0 && d <= 6) toggle('raidNights', d); });
  K.act('set-socket', el => { const x = el.getAttribute('data-arg'); if (K.SLOTS_EXPECTED.includes(x)) toggle('socketSlots', x); });

  /* ---------- export / import / effacer ---------- */
  K.onInput('set-draft', el => { ui.draft[el.getAttribute('data-key')] = el.value; });
  K.act('exp-open', () => { ui.exp = !ui.exp; K.sheet.refresh(); });
  K.act('exp-copy', () => K.pv.copy(JSON.stringify(K.store.exportAll()), 'Exporter mes données'));
  K.onInput('imp-text', el => { ui.imp = el.value; });
  K.act('imp-run', el => {
    const body = el.closest('.sheet-b'), ta = body && body.querySelector('[data-input="imp-text"]');
    const txt = (ta ? ta.value : ui.imp).trim();
    if (!txt) { K.toast('Colle d\'abord un export'); return; }
    let obj;
    try { obj = JSON.parse(txt); } catch (e) { K.toast('Import impossible : ce n\'est pas un export KATA (JSON illisible)'); return; }
    const before = charKey(K.S.settings), r = K.store.importAll(obj);
    if (!r.ok) { K.toast('Import impossible : ' + r.message); return; }
    ui.imp = '';
    if (ta) ta.value = '';
    if (!charChanged(before)) K.invalidate('import');
    K.toast(r.message);
  });
  K.act('wipe-1', () => { ui.wipe = true; K.sheet.refresh(); });
  K.act('wipe-0', () => { ui.wipe = false; K.sheet.refresh(); });
  K.act('wipe-2', () => {
    const before = charKey(K.S.settings);
    K.store.clearAll();
    K.store.save();
    ui.wipe = false; ui.exp = false; ui.imp = '';
    if (!charChanged(before)) K.invalidate('wipe');
    K.toast('Données effacées sur cet appareil');
  });
})(KATA);
