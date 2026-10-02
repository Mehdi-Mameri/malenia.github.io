/* 32-status.js — identity row + status slot (28 px, every state) + «Statut» sheet. Stage 1.
   K.shell.update() re-renders both (called by K.invalidate and every 30 s).
   K.shell.statusCopy() → {kind, text, extra?, warn, retry} (spec §6.8 / §10 exact strings). */
(function (K) {
  'use strict';
  const { h, icon } = K;
  const F = K.fmt;
  const L = window.__LYARA__;

  const offPrefix = M => (M.source === 'snapshot' ? 'Hors ligne · équipement du ' + F.ddmm(M.at)
    : M.source === 'cached' || M.source === 'live' ? 'Hors ligne · données d\'il y a ' + F.ago(M.at) : 'Hors ligne');
  const statusCopy = () => {
    const M = K.M, P = K.net.profile;
    const reset = ' · reset ' + F.countdown(K.time.info().left);
    if (!K.research.ok) return { kind: 'research', warn: true, text: 'Recherche illisible · affichage live seul', retry: P.state === 'fail' };
    if (P.state === 'notfound') return { kind: 'notfound', warn: true, text: 'Personnage introuvable sur raider.io · vérifie nom/royaume dans Réglages' };
    if (P.state === 'retrying') return { kind: 'retrying', warn: true, text: offPrefix(M) + ' · nouvel essai…' };
    if (P.state === 'fail') return { kind: 'offline', warn: true, text: offPrefix(M) + ' ·', retry: true };
    if (P.state === 'loading' && M.source !== 'live') {
      return M.source === 'cached' ? { kind: 'refreshing', text: 'Données d\'il y a ' + F.ago(M.at) + ' · mise à jour…' }
        : { kind: 'loading', text: 'Connexion à raider.io…' };
    }
    if (M.source === 'live') {
      if (M.partial) { const n = M.partialPaths.length; return { kind: 'partial', text: 'Live partiel · ' + n + (n > 1 ? ' données absentes' : ' donnée absente') + ' · Détails' }; }
      return { kind: 'live', text: M.crawledAt ? 'Live · raider.io a vu ton perso à ' + F.hhmm(M.crawledAt) : 'Live · ' + F.rel(M.at), extra: reset };
    }
    if (M.source === 'cached') return { kind: 'cached', text: 'Données d\'il y a ' + F.ago(M.at), extra: reset };
    if (M.source === 'snapshot') return { kind: 'cached', text: 'Équipement du ' + F.ddmm(M.at) + ' (snapshot)', extra: reset };
    return { kind: 'loading', text: 'Connexion à raider.io…' };
  };
  const ICON = { live: 'dot', partial: 'dot', loading: 'ring', refreshing: 'ring', cached: 'ring', retrying: 'alert', offline: 'alert', notfound: 'alert', research: 'alert' };

  let lastSig = '';
  const renderStatus = () => {
    const el = document.getElementById('status'); if (!el) return;
    const c = statusCopy();
    L.status = c.text + (c.retry ? ' Réessayer' : '');
    const sig = JSON.stringify(c);
    if (sig === lastSig) return;
    lastSig = sig;
    el.className = 'status st-' + c.kind + (c.warn ? ' is-warn' : '') + (c.retry ? ' has-retry' : '');
    K.setHTML(el, h`<button type="button" class="st-main" data-act="sheet" data-sheet="status">${icon(ICON[c.kind] || 'ring')}<span class="st-txt">${c.text}${c.extra ? h`<span class="st-extra">${c.extra}</span>` : ''}</span></button>${c.retry ? h` <button type="button" class="st-retry" data-act="retry">Réessayer</button>` : ''}`);
  };

  const renderIdentity = () => {
    const el = document.getElementById('idrow'); if (!el) return;
    const M = K.M, pl = K.R.meta.player || {}, s = K.S.settings;
    const main = K.research.isPlayer();
    const name = M.name || s.name || pl.name || 'KATA';
    const parts = [main ? pl.spec : null, M.realm || (main ? pl.realm : s.realm)].filter(Boolean);
    K.setHTML(el, h`<span class="id-mono" aria-hidden="true">${name.charAt(0).toUpperCase()}</span><p class="id-text"><strong>${name}</strong>${parts.map(x => h` · ${x}`)}${M.guild ? h`<span class="muted"> · ${M.guild}</span>` : ''}</p>`);
    const rb = document.querySelector('[data-act="refresh"]');
    if (rb) rb.classList.toggle('is-busy', !!K.net.busy);
  };

  K.shell = {
    statusCopy,
    update() { renderIdentity(); renderStatus(); },
    init() { K.ui.initSheet(); K.shell.update(); }
  };

  /* ---------- «Statut» sheet (tap on the status slot) ---------- */
  const row = (k, v) => h`<dt>${k}</dt><dd>${v}</dd>`;
  K.sheet.define('status', {
    title: 'État des données',
    render() {
      const M = K.M, P = K.net.profile;
      const c = statusCopy();
      const what = M.source === 'live' ? 'Données en direct de raider.io.'
        : M.source === 'cached' ? 'Données en cache enregistrées le ' + F.ddmm(M.at) + ' à ' + F.hhmm(M.at) + ' (' + F.rel(M.at) + ').'
          : M.source === 'snapshot' ? 'Pas de données raider.io : affichage de l\'équipement du ' + F.ddmm(M.at) + ' (snapshot de la recherche, avec enchants et gemmes). Clés et raid de la semaine sont inconnus.'
            : 'Aucune donnée pour ce personnage pour l\'instant.';
      const missing = M.partialPaths.map(K.model.label);
      const t = K.time.info();
      return h`
        <p class="t-call">${c.text}${c.retry ? ' Réessayer' : ''}</p>
        <p class="lead">${what}</p>
        ${P.state === 'fail' ? h`<p class="lead">Dernière tentative : ${P.status === 'timeout' ? 'délai dépassé' : P.status === 'network' ? 'réseau indisponible' : 'erreur ' + P.status}.</p>` : ''}
        ${P.state === 'notfound' ? h`<p class="lead">raider.io répond 404 pour ${K.S.settings.name} (${K.S.settings.realm}, ${K.S.settings.region.toUpperCase()}).</p>` : ''}
        <dl class="kv">
          ${row('Source', K.ui.provM(M))}
          ${row('Passage de raider.io', M.crawledAt ? F.ddmm(M.crawledAt) + ' à ' + F.hhmm(M.crawledAt) : F.DASH)}
          ${row('Équipement vu le', M.gearUpdatedAt ? F.ddmm(M.gearUpdatedAt) + ' à ' + F.hhmm(M.gearUpdatedAt) : F.DASH)}
          ${row('Reset', F.dayLong(t.resetAt) + (t.source === 'raider.io' ? ' · raider.io' : ' · calcul · à vérifier'))}
          ${row('Recherche', 'du ' + K.research.asOfFR + (K.research.stale ? ' · la méta a pu bouger' : ''))}
        </dl>
        ${missing.length ? h`<div><p class="over">Données absentes de raider.io</p><ul class="list-dot">${missing.map(x => h`<li>${x}</li>`)}</ul></div>` : ''}
        ${M.source === 'snapshot' || M.source === 'none' || P.state === 'fail' ? K.ui.lastKnownCard() : ''}
        ${!K.research.ok ? h`<p class="callout">Recherche illisible · affichage live seul (${K.research.error || 'erreur'}).</p>` : ''}
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-act="retry">${K.icon('refresh')}<span>Réessayer</span></button>
          <button type="button" class="btn" data-act="sheet" data-sheet="diag">${K.icon('info')}<span>Diagnostic</span></button>
        </div>
        ${M.profileUrl ? h`<div data-qa="force-update"><a class="btn btn-ghost" href="${M.profileUrl}" target="_blank" rel="noopener noreferrer">${K.icon('external')}<span>Forcer la mise à jour sur raider.io</span></a>
          <p class="t-cap muted">Ouvre ta page raider.io : son bouton de mise à jour demande un nouveau passage. Reviens ensuite et touche « Réessayer ».</p></div>` : ''}
        ${!K.store.ok() ? h`<p class="card-foot">Tes coches ne seront pas mémorisées sur cet appareil (stockage indisponible).</p>` : ''}`;
    }
  });
})(KATA);
