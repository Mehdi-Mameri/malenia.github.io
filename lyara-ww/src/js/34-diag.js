/* 34-diag.js — Diagnostic sheet (spec §6.9). Stage 1.
   Tables: Champs (path · statut · exemple), Requêtes (endpoint · statut · ms · dégradé), Erreurs.
   Self-check: ilvl weighted mean vs item_level_equipped.
   K.diag.extend(id, title, fn(ctx) → Safe) adds a block (engine rules evaluated / not evaluable,
   additivity test…). Every value is a text node; URLs are shown as text only. */
(function (K) {
  'use strict';
  const { h } = K;
  const F = K.fmt, U = K.util;
  const L = window.__LYARA__;
  const blocks = [];
  K.diag = { extend(id, title, fn) { const i = blocks.findIndex(b => b.id === id); const b = { id, title, fn }; if (i >= 0) blocks[i] = b; else blocks.push(b); } };

  const ST = { ok: 'ok', absent: 'absent', null: 'null', type: 'type' };
  const endpoint = url => { const m = /\/api\/v1\/([^?]+)/.exec(url || ''); return m ? m[1] : url; };

  K.sheet.define('diag', {
    title: 'Diagnostic',
    qa: 'diagnostic',
    render(arg, ctx) {
      const M = K.M;
      const paths = Object.keys(M.fields || {}).sort((a, b) => (M.fields[a] === 'ok') - (M.fields[b] === 'ok') || a.localeCompare(b));
      const reqs = L.requests.slice().reverse();
      const calc = M.ilvlCalc, eq = M.ilvlSource === 'raider.io' ? M.ilvl : undefined;
      const extra = blocks.map(b => h`<div><p class="over">${b.title}</p>${K.ui.safeSection('diag:' + b.id, () => b.fn(ctx))}</div>`);
      return h`
        <dl class="kv">
          <dt>Version</dt><dd class="mono">${L.version}</dd>
          <dt>État</dt><dd>${L.state} · ${L.phase}${L.partial ? ' · partiel' : ''}${L.degraded ? ' · dégradé' : ''}</dd>
          <dt>Recherche</dt><dd>${K.research.ok ? 'lisible' : 'illisible'} · du ${K.research.asOfFR} · ${K.research.sourceCount} sources</dd>
          <dt>Stockage</dt><dd>${K.store.ok() ? 'localStorage' : 'mémoire seule'}${K.store.standalone() ? ' · écran d\'accueil' : ''}</dd>
          <dt>Semaine</dt><dd class="mono">${ctx.time.weekKey} · ${ctx.time.source}</dd>
        </dl>
        <div><p class="over">Contrôles</p><ul class="list-dot">
          <li>iLvl moyen recalculé : ${F.ilvl(calc)}${U.isNum(eq) ? h` · raider.io : ${F.ilvl(eq)} (écart ${F.signed(Math.round((eq - calc) * 10) / 10, 1)})` : h` · pas de valeur raider.io`}</li>
          <li>Emplacements : ${K.SLOTS_EXPECTED.filter(s => M.gear[s].present).length}/${K.SLOTS_EXPECTED.length}${M.twoHand ? ' · arme à deux mains' : ''}</li>
        </ul></div>
        ${extra}
        <div><p class="over">Requêtes (${reqs.length})</p>
          ${reqs.length ? h`<div class="tbl-wrap"><table class="tbl num"><thead><tr><th>Endpoint</th><th class="nowrap">Statut</th><th>ms</th><th>Note</th></tr></thead><tbody>
            ${reqs.map(r => h`<tr><td class="mono">${endpoint(r.url)}</td><td class="nowrap">${r.status}</td><td>${r.ms}</td><td>${r.degraded ? 'dégradé' : r.attempt === 2 ? '2e essai' : ''}</td></tr>`)}
          </tbody></table></div>` : K.ui.empty(L.phase === 'fetching' ? 'Requêtes en cours…' : 'Aucune requête')}</div>
        <div><p class="over">Champs (${paths.length})</p>
          ${paths.length ? h`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Chemin</th><th class="nowrap">Statut</th><th>Exemple</th></tr></thead><tbody>
            ${paths.map(p => h`<tr><td class="mono">${p}</td><td class="nowrap">${ST[M.fields[p]] || M.fields[p]}</td><td class="any">${(M.samples && M.samples[p]) || ''}</td></tr>`)}
          </tbody></table></div>` : K.ui.empty(M.source === 'snapshot' ? 'Snapshot : aucun champ raider.io' : 'Aucun champ lu')}</div>
        <div><p class="over">Erreurs (${L.errors.length})</p>
          ${L.errors.length ? h`<ul class="list-dot">${L.errors.map(e => h`<li><span class="mono">${e.where}</span> · ${e.message}</li>`)}</ul>` : K.ui.empty('Aucune erreur')}</div>`;
    }
  });
})(KATA);
