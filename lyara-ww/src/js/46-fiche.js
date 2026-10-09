/* 46-fiche.js — «Fiche de personnage» card, top of «Maintenant».
   Bio (race · classe · spécialisation · royaume · guilde), four live tiles (iLvl, cote M+, raid, rang) with the
   usual provenance chip, and quick links (raider.io, Armurerie, WarcraftLogs). Links are plain navigation: the CSP
   still lets the page contact raider.io only. Exposes K.fiche.card(c) → Safe. */
(function (K) {
  'use strict';
  const { h, icon } = K;
  const F = K.fmt, U = K.util, UI = K.ui;
  const isNum = U.isNum;

  const slug = s => String(s || '').trim().toLowerCase().replace(/['’]/g, '').replace(/\s+/g, '-');
  const urls = st => {
    const reg = slug(st.region) || 'eu', realm = encodeURIComponent(slug(st.realm)), name = encodeURIComponent(String(st.name || '').trim().toLowerCase());
    if (!st.name || !st.realm) return null;
    return {
      armory: 'https://worldofwarcraft.blizzard.com/fr-fr/character/' + reg + '/' + realm + '/' + name,
      logs: 'https://www.warcraftlogs.com/character/' + reg + '/' + realm + '/' + name
    };
  };

  const rank = M => {
    const r = M.ranks && (M.ranks.spec_269 || M.ranks.class_dps || M.ranks.class || M.ranks.overall);
    if (!r) return null;
    if (isNum(r.realm)) return ['Rang royaume', '#' + F.num(r.realm)];
    if (isNum(r.region)) return ['Rang région', '#' + F.num(r.region)];
    return isNum(r.world) ? ['Rang monde', '#' + F.num(r.world)] : null;
  };
  const tile = (label, val, sub) => h`<div class="fi-tile"><p class="fi-v">${val}</p><p class="fi-l">${label}</p>${sub ? h`<p class="fi-s">${sub}</p>` : ''}</div>`;

  K.fiche = {
    card(c) {
      const M = c.M, st = c.S.settings, u = urls(st);
      const name = M.name || st.name || 'Personnage';
      const pl = K.research && K.research.isPlayer() ? U.obj(c.R.meta.player) : {};   // offline / snapshot: bundled profile of the same character
      const bits = [M.race || pl.race, M.specName && M.className ? M.specName + ' ' + M.className : M.className || pl.spec,
        (M.realm || pl.realm || st.realm) + ' · ' + String(M.region || st.region || '').toUpperCase()].filter(Boolean);
      const rk = rank(M), raid = M.raid;
      return h`<section class="card fi" data-qa="fiche" aria-label="Fiche de personnage">
        <div class="fi-banner">
          <span class="fi-crest" aria-hidden="true">${name.charAt(0).toUpperCase()}</span>
          <div class="fi-id">
            <h2 class="fi-name">${name}</h2>
            <p class="fi-sub">${bits.join(' · ')}</p>
            ${M.guild ? h`<p class="fi-guild">${icon('shield', 'i-sm')}<span>${M.guild}</span></p>` : ''}
          </div>
          <span class="fi-prov">${UI.provM(M)}</span>
        </div>
        <div class="fi-tiles">
          ${tile('iLvl équipé', F.ilvl(M.ilvl), M.ilvlSource)}
          ${tile('Cote M+', F.int(M.score), M.season || '')}
          ${tile('Raid', raid && raid.summary ? raid.summary : F.DASH, raid && raid.key ? '' : 'non renvoyé')}
          ${tile(rk ? rk[0] : 'Rang', rk ? rk[1] : F.DASH, rk ? '' : 'non renvoyé')}
        </div>
        <div class="fi-links btn-row">
          ${M.profileUrl ? h`<a class="btn btn-sm" href="${M.profileUrl}" target="_blank" rel="noopener noreferrer">${icon('external')}<span>raider.io</span></a>` : ''}
          ${u ? h`<a class="btn btn-sm" href="${u.armory}" target="_blank" rel="noopener noreferrer">${icon('external')}<span>Armurerie</span></a>
          <a class="btn btn-sm" href="${u.logs}" target="_blank" rel="noopener noreferrer">${icon('external')}<span>WarcraftLogs</span></a>` : ''}
        </div>
      </section>`;
    }
  };
})(window.KATA);
