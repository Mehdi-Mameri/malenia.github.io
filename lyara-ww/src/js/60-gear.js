/* 60-gear.js — «Stuff» screen (spec P0-10, §3.4). Stage 3a.
   Phone: ilvl summary → paper doll → tier (62) → Établi (65) → craft (65) → BiS (65).
   Desktop ≥ 1024: 5/12 (summary + doll) | 7/12 (tier, Établi, craft, BiS).
   Summary: display ilvl + provenance, ilvl bullet with ticks drawn by confidence (a debated ceiling is a band +
   «Débat» pill), «Repères (recherche)» collapsed. Doll: 60 px SlotTiles (monogram with quality border, label,
   ilvl, name, enchant / gem / tier markers, «faible» chip), dashed tile for slots raider.io did not return.
   Sheet 'gear-slot' (arg = slot key). Hooks: data-qa="ilvl" | "doll" | "slot-<key>". Renderers on K.gearUI. */
(function (K) {
  'use strict';
  const { h, icon, raw } = K;
  const F = K.fmt, U = K.util, UI = K.ui, isNum = U.isNum;
  const SF = s => K.SLOT_FR[s] || s;
  const rslot = s => String(s).replace(/[12]$/, '');
  const SS = (id, fn) => UI.safeSection('gear:' + id, fn);
  const GU = (K.gearUI = K.gearUI || {});

  /* ---------- research references ---------- */
  const enchSlots = R => K.expandSlots(R.enchants.map(e => e.slot));
  const confOf = (R, v) => { const r = R.progression.ilvlTable.find(x => parseInt(U.str(x.ilvl), 10) === v); return r && r.confidence ? r.confidence : 'moyenne'; };
  /* ceiling: numbers of maxIlvl.value widened by the «plafond d'ilvl» debate (same rule as K.pv.range) */
  const ceiling = R => {
    const mx = R.progression.maxIlvl || {}, x = K.pv.rangeNums(mx.value, 'maxIlvl'), nums = x.nums.map(Number).sort((a, b) => a - b);
    return nums.length ? { lo: nums[0], hi: nums[nums.length - 1], nums, deb: x.deb, conf: mx.confidence } : null;
  };
  GU.ceiling = ceiling;

  /* ---------- ilvl summary + bullet ---------- */
  const marks = c => {
    const T = c.T, R = c.R, ib = R.raid.ilvlByDifficulty, out = [];
    const add = (v, l) => { if (!isNum(v)) return; const m = out.find(x => x.v === v); if (m) m.l.push(l); else out.push({ v, l: [l], conf: confOf(R, v) }); };
    add(T.slotIlvlWeak, 'faible'); add(T.mythicEntryIlvl, 'entrée Mythique'); add(ib.heroic, 'drop HM'); add(ib.mythic, 'drop Mythique');
    return out.sort((a, b) => a.v - b.v);
  };
  const summary = c => {
    const M = c.M, v = M.ilvl, ms = marks(c), cl = ceiling(c.R);
    const all = ms.map(m => m.v).concat(cl ? [cl.lo, cl.hi] : [], isNum(v) ? [v] : []);
    const lo = all.length ? Math.floor(Math.min(...all) - 4) : 0, hi = all.length ? Math.ceil(Math.max(...all) + 2) : 1;
    const pos = x => U.clamp((x - lo) / (hi - lo) * 100, 0, 100).toFixed(1) + '%';
    const tl = m => (m.conf === 'moyenne' ? '~' : '') + m.v;
    const clTxt = cl ? (cl.nums.length > 1 ? cl.nums.slice(0, -1).join(', ') + ' ou ' + cl.nums[cl.nums.length - 1] : String(cl.lo)) : '';
    const aria = 'iLvl ' + F.ilvl(v) + ' ; repères ' + ms.map(m => m.v).join(', ') + (cl ? ' ; plafond ' + clTxt : '');
    const src = M.ilvlSource && M.ilvlSource !== 'raider.io' ? M.ilvlSource : null;
    const weakN = K.SLOTS_EXPECTED.filter(s => M.gear[s].present && isNum(M.gear[s].ilvl) && isNum(c.T.slotIlvlWeak) && M.gear[s].ilvl < c.T.slotIlvlWeak).length;
    return h`<div class="card gd-sum" data-qa="ilvl"><div class="card-h"><p class="over">iLvl équipé</p>${UI.provM(M)}</div>
      <p class="gd-big"><span class="t-display num">${isNum(v) ? F.ilvl(v) : UI.unknown('iLvl non renvoyé par raider.io')}</span>${src ? h`<span class="chip">${icon('approx', 'i-sm')}${src === 'calcul' ? 'moyenne calculée' : 'calcul · snapshot'}</span>` : ''}</p>
      ${ms.length || cl ? h`<div class="gb" role="img" aria-label="${aria}"><span class="gb-tr">${isNum(v) ? h`<i class="gb-f"${K.vars({ '--p': pos(v) })}></i>` : ''}
        ${cl && cl.hi > cl.lo ? h`<i class="gb-band"${K.vars({ '--x': pos(cl.lo), '--w': (parseFloat(pos(cl.hi)) - parseFloat(pos(cl.lo))).toFixed(1) + '%' })}></i>` : ''}
        ${ms.filter(m => m.conf !== 'basse').map(m => h`<i class="gb-t${m.conf === 'moyenne' ? ' gb-tm' : ''}"${K.vars({ '--x': pos(m.v) })}></i>`)}
        ${cl && cl.hi === cl.lo && cl.conf !== 'basse' ? h`<i class="gb-t${cl.conf === 'moyenne' ? ' gb-tm' : ''}"${K.vars({ '--x': pos(cl.lo) })}></i>` : ''}</span>
        <span class="gb-lb">${ms.map(m => h`<span class="num"${K.vars({ '--x': pos(m.v) })}>${tl(m)}${m.conf === 'basse' ? '?' : ''}</span>`)}${cl ? h`<span class="num"${K.vars({ '--x': pos(cl.hi > cl.lo ? (cl.lo + cl.hi) / 2 : cl.lo) })}>${cl.hi > cl.lo ? cl.lo + '–' + cl.hi : (cl.conf === 'moyenne' ? '~' : '') + cl.lo}</span>` : ''}</span></div>
      <ul class="gb-key">${ms.map(m => h`<li><span class="num ink">${tl(m)}</span> ${m.l.join(' · ')} ${UI.conf(m.conf)}</li>`)}${cl ? h`<li>${K.pv.range(c.R.progression.maxIlvl.value, 'maxIlvl')} plafond d'ilvl${cl.deb ? '' : h` ${K.pv.conf(cl.conf, c.R.progression.maxIlvl.sources)}`}</li>` : ''}</ul>` : ''}
      ${weakN ? h`<p class="t-call ink2">${F.count(weakN, 'emplacement', 'emplacements')} sous ${c.T.slotIlvlWeak} (« faible »)</p>` : ''}
      ${c.R.progression.ilvlTable.length ? h`<details data-key="gd-rep"><summary class="t-call">Repères (recherche)</summary><ul class="rows">${c.R.progression.ilvlTable.map(r => h`<li class="row"><span class="grow"><span class="ink">${U.str(r.source)}</span>${r.note ? h`<br><span class="t-cap ink2">${U.str(r.note)}</span>` : ''}</span><span class="num nowrap">${U.str(r.ilvl) || F.DASH} ${K.pv.conf(r.confidence, r.sources)}</span></li>`)}</ul>
        ${cl && cl.deb ? h`<p class="over sem-mt">Débat · ${cl.deb.topic}</p><ul class="list-dot">${cl.deb.versions.map(x => h`<li>${x}</li>`)}</ul>${cl.deb.resolution ? h`<p class="t-cap ink2">${U.str(cl.deb.resolution)}</p>` : ''}` : ''}</details>` : ''}</div>`;
  };

  /* ---------- markers ---------- */
  const mk = (ic, cls, sr, q) => h`<span class="mk ${cls}">${icon(ic, 'i-sm')}${q ? raw('<b aria-hidden="true">?</b>') : ''}<span class="sr-only">${sr}</span></span>`;
  const markers = (s, g, c, t) => {
    const out = [];
    if (enchSlots(c.R).includes(s)) {
      const st = g.ench.state;
      out.push(st === 'ok' ? mk('spark', 'mk-ok', 'enchant ok') : st === 'manquant' ? mk('spark', 'mk-gap', 'enchant manquant') : mk('spark', 'mk-unk', 'enchant inconnu', true));
    }
    if (U.arr(c.S.settings.socketSlots).includes(s) || g.gems.state === 'ok') {
      const st = g.gems.state;
      out.push(st === 'ok' ? mk('gem', 'mk-ok', 'gemme sertie') : st === 'vide?' ? mk('gem', 'mk-unk', 'châsse ? à vérifier', true) : mk('gem', 'mk-unk', 'gemme inconnue', true));
    }
    const tp = t.perSlot.find(p => p.slot === s);
    if (tp && tp.isTier === true) out.push(mk('crown', 'mk-tier', 'pièce de tier'));
    else if (tp && tp.prov === 'supposé') out.push(mk('crown', 'mk-sup', 'tier supposé'));
    return out;
  };
  GU.markers = markers;

  /* ---------- paper doll ---------- */
  const COL_L = ['head', 'neck', 'shoulder', 'back', 'chest', 'wrist'], COL_R = ['hands', 'waist', 'legs', 'feet', 'finger1', 'finger2'];
  const slotTile = (s, c, t) => {
    const g = c.M.gear[s];
    if (!g.present) {
      return h`<button type="button" class="st st-abs" data-act="sheet" data-sheet="gear-slot" data-arg="${s}" data-qa="${'slot-' + s}"><span class="st-mono">${K.SLOT_MONO[s]}</span><span class="st-b"><span class="st-l">${SF(s)}</span><span class="st-n">Non renvoyé par raider.io</span></span></button>`;
    }
    const weak = isNum(g.ilvl) && isNum(c.T.slotIlvlWeak) && g.ilvl < c.T.slotIlvlWeak;
    return h`<button type="button" class="st${isNum(g.quality) && g.quality >= 2 ? ' q' + Math.min(g.quality, 5) : ''}" data-act="sheet" data-sheet="gear-slot" data-arg="${s}" data-qa="${'slot-' + s}">
      <span class="st-mono">${K.SLOT_MONO[s]}</span>
      <span class="st-b"><span class="st-l">${weak ? h`<span class="sr-only">${SF(s)}</span><span class="st-weak">${icon('alert', 'i-sm')}faible</span>` : SF(s)}</span><span class="st-n">${g.name || F.DASH}</span></span>
      <span class="st-r"><span class="st-i num">${F.num(g.ilvl)}</span><span class="st-mk">${markers(s, g, c, t)}</span></span></button>`;
  };
  const doll = c => {
    const M = c.M, t = K.engine.tierState(M, c.S), T = s => slotTile(s, c, t);
    const w = ['mainhand'].concat(M.gear.offhand.present ? ['offhand'] : []);
    return h`<div class="card gd-doll" data-qa="doll"><div class="card-h"><h2 class="card-t">Équipement</h2>${UI.provM(M)}</div>
      ${!M.gearPresent ? (M.source === 'none' && K.net && /loading|retrying/.test(K.net.profile.state) ? h`<div class="doll" aria-busy="true">${Array.from({ length: 12 }, () => UI.skel(60))}</div>`
        : h`<p class="t-call ink2">${UI.unknown('raider.io n\'a pas renvoyé l\'équipement')} Équipement indisponible</p>`) : h`<div class="doll">
        <div class="doll-c">${COL_L.map(T)}</div><div class="doll-c">${COL_R.map(T)}</div>
        <div class="doll-b">${T('trinket1')}${T('trinket2')}</div><div class="doll-b${w.length === 1 ? ' doll-1' : ''}">${w.map(T)}</div></div>
        <p class="gd-leg t-cap ink2"><span>${mk('spark', 'mk-ok', '')} enchant</span><span>${mk('gem', 'mk-ok', '')} gemme</span><span>${mk('crown', 'mk-tier', '')} tier</span>${M.source === 'live' || M.source === 'cached' ? h`<span>${mk('spark', 'mk-gap', '')} manquant</span>` : ''}<span>${mk('spark', 'mk-unk', '', true)} inconnu</span></p>
        ${M.source === 'snapshot' ? h`<p class="t-cap muted">Snapshot du ${F.ddmm(M.at)} : enchants et gemmes inconnus («&nbsp;?&nbsp;»).</p>` : ''}`}</div>`;
  };

  /* ---------- slot sheet ---------- */
  const EST = { ok: 'enchanté', manquant: 'aucun enchant', inconnu: '?' };
  const GST = { ok: 'gemme sertie', 'vide?': 'châsse ? à vérifier', inconnu: '?' };
  const sec = (title, chip, body) => h`<div><div class="card-h"><p class="over">${title}</p>${chip || ''}</div>${body}</div>`;
  K.sheet.define('gear-slot', {
    title: s => SF(s),
    qa: 'slot',
    render(s, c) {
      if (!K.SLOTS.includes(s)) return UI.empty('Emplacement inconnu');
      const M = c.M, R = c.R, T = c.T, g = M.gear[s], rs = rslot(s);
      const ench = R.enchants.find(e => e.slot === rs), bis = R.bisBySlot.find(b => b.slot === rs);
      const snap = R.gearSnapshot.items.find(x => x.slot === s);
      const tp = K.engine.tierState(M, c.S).perSlot.find(p => p.slot === s);
      const where = (K.loot.get().bySlot[s] || []);
      const vs = g.present && isNum(g.ilvl) ? [[T.slotIlvlWeak, 'faible'], [T.slotIlvlGood, 'bon']].filter(x => isNum(x[0]))
        .map(x => (g.ilvl >= x[0] ? '≥ ' : F.num(x[0] - g.ilvl) + ' sous ') + x[0] + ' (' + x[1] + ')').join(' · ') : '';
      return h`${g.present ? h`<div><div class="card-h"><p class="t-h2 any"><span class="q-dot${isNum(g.quality) && g.quality >= 2 ? ' q-' + Math.min(g.quality, 5) : ''}"></span> ${g.name || F.DASH}</p>${UI.provM(M)}</div>
          <p class="t-call"><span class="num ink">iLvl ${F.num(g.ilvl)}</span>${vs ? ' · ' + vs : ''}</p>
          <p class="t-cap ink2">${g.bonuses ? F.count(g.bonuses.length, 'bonus d\'objet', 'bonus d\'objet') : 'bonus d\'objet : —'}${g.id != null ? ' · objet n° ' + g.id : ''}</p></div>`
        : h`<p class="callout">${icon('alert', 'i-sm')} Non renvoyé par raider.io</p>`}
        ${enchSlots(R).includes(s) ? sec('Enchant', ench ? h`<span class="nowrap">${UI.provResearch()} ${K.pv.conf(ench.confidence, ench.sources)}</span>` : '', h`
          <p class="t-call">${g.present ? (g.ench.state === 'ok' ? (g.ench.names.length ? h`${EST.ok} : ${g.ench.names.join(', ')}` : 'présent (nom non fourni par raider.io)') : g.ench.state === 'manquant' ? h`${icon('alert', 'i-sm')} ${EST.manquant}` : h`${UI.unknown(M.source === 'snapshot' ? 'Le snapshot ne contient pas les enchants' : 'Enchant non renvoyé par raider.io')} inconnu`) : F.DASH}</p>
          ${ench ? h`<p class="t-call ink2">Conseillé : <span class="ink">${ench.name || F.DASH}</span>${ench.alt ? h`<br><span class="t-cap">${ench.alt}</span>` : ''}</p>` : ''}`)
        : h`<p class="t-cap muted">La recherche ne recommande pas d'enchant pour cet emplacement.</p>`}
        ${U.arr(c.S.settings.socketSlots).includes(s) || (g.present && g.gems.state === 'ok') ? sec('Gemme', UI.provResearch(), h`
          <p class="t-call">${g.present ? (g.gems.state === 'inconnu' ? h`${UI.unknown('Gemmes non renvoyées par raider.io')} inconnu` : g.gems.names.length ? h`${GST.ok} : ${g.gems.names.join(', ')}` : GST[g.gems.state]) : F.DASH}</p>
          <ul class="list-dot">${R.gems.map(x => h`<li><span class="ink">${x.name}</span> ${K.pv.conf(x.confidence, x.sources)}${x.role ? h`<br><span class="t-cap ink2">${x.role}</span>` : ''}</li>`)}</ul>
          <p class="t-cap muted">raider.io ne donne pas le nombre de châsses : vérifie en jeu.</p>`) : ''}
        ${tp ? sec('Tier', '', h`<p class="t-call">${K.nowUI.tierLabel(tp)}</p>${K.nowUI.tierHint(tp, c)}${K.nowUI.tierBtns(tp)}`) : ''}
        ${bis ? sec('BiS (recherche)', h`<span class="nowrap">${UI.provResearch()} ${K.pv.conf(bis.confidence, bis.sources)}</span>`, h`<dl class="kv kv-why"><dt>Raid</dt><dd>${U.str(bis.raid) || F.DASH}</dd><dt>M+</dt><dd>${U.str(bis.mplus) || F.DASH}</dd></dl>${bis.note ? h`<p class="t-cap ink2">${U.str(bis.note)}</p>` : ''}`) : ''}
        ${where.length ? h`<div data-qa="loot-slot">${sec('Où l\'améliorer', UI.prov('calc'), h`<ul class="list-dot">${where.map(e => K.loot.li(e, true))}</ul>${K.loot.foot(T.slotIlvlGood)}`)}</div>` : ''}
        ${sec('Verdict du ' + F.ddmm(R.gearSnapshot.date), UI.prov('snapshot', F.ddmm(R.gearSnapshot.date)), snap && g.present && g.id != null && snap.itemId === g.id
          ? h`<p class="t-call"><span class="ink">${U.str(snap.verdict) || F.DASH}</span>${snap.note ? h` · ${U.str(snap.note)}` : ''}</p>`
          : h`<p class="t-call ink2">${g.present ? 'Nouvel objet depuis le ' + F.ddmm(R.gearSnapshot.date) + ', non évalué' : F.DASH}</p>`)}`;
    }
  });

  /* ---------- screen ---------- */
  K.screens.register('gear', {
    render(c) {
      const part = (id, fn) => (fn ? SS(id, () => fn(c)) : '');
      return h`<div class="cols cols-5-7 gd">
        <div class="stack">${SS('ilvl', () => summary(c))}${SS('doll', () => doll(c))}</div>
        <div class="stack">${part('tier', GU.tier)}${part('shop', GU.shop)}${part('craft', GU.craft)}${part('dumbbell', GU.dumbbell)}${part('bis', GU.bis)}</div>
      </div>`;
    },
    mounted(root) { if (GU.mountShop) GU.mountShop(root); }
  });
  Object.assign(GU, { summary, doll, slotTile, enchSlots });
})(KATA);
