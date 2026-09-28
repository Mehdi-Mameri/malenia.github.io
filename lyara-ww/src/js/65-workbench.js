/* 65-workbench.js — «Établi» copyable shopping list (spec P0-12) + craft/embellishments + BiS par slot. Stage 3a.
   Lines: enchants (R.enchants expanded via RSLOT: {name, alt, slots[], qty, status ok|manquant|inconnu|verif, conf}),
   gems (status per socket: «châsse ? à vérifier» / «?», never «manquant»), consumables grouped by type.
   Tick per line → S.shopping[lineId] = true. A ticked enchant line whose live status becomes ok turns into
   {closed: ISO} («Écart fermé le JJ/MM»). «Copier la liste»: K.copy (clipboard → textarea + execCommand → sheet 'copy'
   «Copie manuelle», data-qa="copy-manual"). K.get('shop') → {lines, groups, allOk, text, n}. Verbs: gear-shop (lineId) · gear-copy.
   Hooks: data-qa="shop" | "copy" | "craft" | "bis". */
(function (K) {
  'use strict';
  const { h, icon } = K;
  const F = K.fmt, U = K.util, UI = K.ui;
  const SF = s => K.SLOT_FR[s] || s;
  const GU = (K.gearUI = K.gearUI || {});
  const TYPE_FR = { flacon: 'Flacons', nourriture: 'Nourriture', potion: 'Potions', huile: 'Huiles', rune: 'Runes' };
  const ST = { ok: 'ok', manquant: 'manquant', inconnu: '?', verif: 'à vérifier' };

  const build = ctx => {
    const M = ctx.M, R = ctx.R, S = ctx.S, snap = M.source === 'snapshot' || M.source === 'none';
    const g = s => M.gear[s];
    const lines = [];
    R.enchants.forEach(e => {
      const slots = K.expandSlots([e.slot]).filter(s => K.SLOTS.includes(s)), st = slots.map(s => [s, g(s).present ? g(s).ench.state : 'absent']);
      const miss = st.filter(x => x[1] === 'manquant').map(x => x[0]), unk = st.filter(x => x[1] === 'inconnu').map(x => x[0]);
      const status = snap ? 'verif' : miss.length ? 'manquant' : st.length && st.every(x => x[1] === 'ok') ? 'ok' : 'inconnu';
      const at = status === 'manquant' ? miss : status === 'ok' ? slots : status === 'verif' ? slots : unk.length ? unk : slots;
      lines.push({ id: 'e-' + e.slot, kind: 'ench', name: e.name || F.DASH, alt: e.alt, slots: at, qty: at.length, status, conf: e.confidence, sources: e.sources });
    });
    const sock = U.arr(S.settings.socketSlots).filter(s => K.SLOTS.includes(s) && g(s).present).map(s => [s, g(s).gems.state]);
    const gStat = snap || !sock.length ? 'verif' : sock.every(x => x[1] === 'ok') ? 'ok' : sock.some(x => x[1] === 'vide?') ? 'verif' : 'inconnu';
    R.gems.forEach((x, i) => lines.push({ id: 'g-' + i + '-' + U.slugify(x.name).slice(0, 20), kind: 'gem', name: x.name || F.DASH, role: x.role, slots: sock.filter(z => z[1] !== 'ok').map(z => z[0]), status: gStat, conf: x.confidence, sources: x.sources }));
    R.consumables.forEach(x => lines.push({ id: 'c-' + U.slugify(x.type + '-' + x.name).slice(0, 32), kind: 'cons', name: x.name || F.DASH, type: x.type, status: null, conf: x.confidence }));
    lines.forEach(l => { const v = S.shopping[l.id]; l.ticked = v === true; l.closed = U.isObj(v) && typeof v.closed === 'string' && l.status === 'ok' ? v.closed : null; });
    const ench = lines.filter(l => l.kind === 'ench');
    const allOk = M.source === 'live' && ench.length > 0 && ench.every(l => l.status === 'ok');
    const out = lines.filter(l => !l.ticked && l.status !== 'ok').map(l => (l.kind === 'ench' ? l.name + ' ×' + l.qty + ' · ' + l.slots.map(SF).join(', ') + (l.status === 'manquant' ? '' : ' · à vérifier')
      : l.kind === 'gem' ? l.name + ' · châsses à vérifier' + (l.slots.length ? ' : ' + l.slots.map(SF).join(', ') : '') : l.name + ' · ' + (l.type || 'consommable')));
    return { lines, sock, allOk, text: out.join('\n'), n: out.length, snap };
  };
  K.derive('shop', build);

  const ck = l => h`<button type="button" class="ck" data-act="gear-shop" data-arg="${l.id}" aria-pressed="${l.ticked ? 'true' : 'false'}" aria-label="${l.ticked ? 'Décocher' : 'Cocher : acheté ou fait'}">${icon('check', 'i-sm')}</button>`;
  const tag = l => (l.closed ? h`<span class="tag tag-ok">${icon('check', 'i-sm')}<span>Écart fermé le ${F.ddmm(l.closed)}</span></span>`
    : l.status === 'ok' ? h`<span class="tag tag-ok">${icon('check', 'i-sm')}<span>ok</span></span>`
      : l.status === 'manquant' ? h`<span class="tag">${icon('alert', 'i-sm')}<span>manquant</span></span>`
        : l.status ? h`<span class="tag tag-unk">${icon('dotted', 'i-sm')}<span>${ST[l.status]}</span></span>` : '');
  const line = l => h`<li class="row sh-row${l.ticked ? ' is-ticked' : ''}">${l.status === 'ok' ? h`<span class="ck ck-ok" aria-hidden="true">${icon('check', 'i-sm')}</span>` : ck(l)}
    <span class="grow"><span class="ink any">${l.name}</span>${l.kind === 'ench' ? h` <span class="num">×${l.qty}</span>` : ''} ${l.kind === 'cons' ? '' : K.pv.conf(l.conf, l.sources)}
      ${l.kind === 'ench' ? h`<br><span class="t-cap ink2">${l.slots.map(SF).join(', ')}</span>` : l.kind === 'gem' && l.role ? h`<span class="t-cap ink2 clamp2">${U.str(l.role)}</span>` : ''}${l.kind === 'ench' && l.alt ? h`<span class="t-cap muted any clamp2">Alternatives : ${U.str(l.alt)}</span>` : ''}</span>${tag(l)}</li>`;

  const shop = c => {
    const P = K.get('shop'), L = P.lines, en = L.filter(l => l.kind === 'ench'), ge = L.filter(l => l.kind === 'gem'), co = L.filter(l => l.kind === 'cons');
    const types = U.uniq(co.map(l => l.type));
    const GST = { ok: 'gemme sertie', 'vide?': 'châsse ? à vérifier', inconnu: '?' };
    return h`<div class="card sh-card" data-qa="shop"><i class="sh-sen" aria-hidden="true"></i><div class="card-h"><h2 class="card-t">${icon('anvil')} Établi</h2><span class="nowrap">${UI.provM(c.M)} ${UI.provResearch()}</span></div>
      ${P.snap ? h`<p class="t-cap ink2">Snapshot du ${F.ddmm(c.M.at)} : enchants et gemmes à vérifier en jeu.</p>` : ''}
      <h3 class="over">Enchants</h3>
      ${P.allOk ? UI.empty('Rien à acheter : tout est enchanté') : h`<ul class="rows">${en.map(line)}</ul>`}
      ${ge.length ? h`<h3 class="over sh-h">Gemmes</h3>
        <p class="t-cap ink2">${P.sock.length ? P.sock.map(z => SF(z[0]) + ' : ' + (P.snap ? '?' : GST[z[1]])).join(' · ') : 'Châsses : ?'} · raider.io ne donne pas le nombre de châsses.</p>
        <ul class="rows">${ge.map(line)}</ul>` : ''}
      ${co.length ? h`<div class="sh-cons${co.every(l => l.conf === 'basse') ? ' is-basse' : ''}"><div class="card-h"><h3 class="over">Consommables</h3>${UI.conf(UI.confMin(...co.map(l => l.conf)))}</div>${types.map(t => h`<p class="t-cap muted sh-t">${TYPE_FR[t] || t}</p><ul class="rows">${co.filter(l => l.type === t).map(line)}</ul>`)}</div>` : ''}
      <div class="sh-foot"><button type="button" class="btn btn-primary" data-act="gear-copy" data-qa="copy"${P.n ? '' : K.raw(' disabled')}>${icon('copy')}<span>Copier la liste${P.n ? ' (' + P.n + ')' : ''}</span></button></div></div>`;
  };

  /* the sticky «Copier la liste» footer cannot leave its card: while the card's top edge is still below the
     viewport bottom it would sit on the card title, so it stays hidden until the top of the card (sentinel) is in view */
  let io = null;
  GU.mountShop = root => {
    if (io) { io.disconnect(); io = null; }
    const card = root.querySelector('[data-qa=shop]'), foot = card && card.querySelector('.sh-foot'), sen = card && card.querySelector('.sh-sen');
    if (!foot || !sen || typeof IntersectionObserver !== 'function') return;
    io = new IntersectionObserver(es => es.forEach(e => { foot.classList.toggle('is-away', e.intersectionRatio < 1 && e.boundingClientRect.top > (e.rootBounds ? e.rootBounds.top : 0)); }), { threshold: [0, 1] });
    io.observe(sen);
  };
  K.act('gear-copy', () => {
    const P = K.get('shop');
    if (!P.text) { K.toast('Rien à copier'); return; }
    K.copy(P.text, { title: 'Copie manuelle', done: 'Liste copiée · ' + F.count(P.n, 'ligne', 'lignes') });
  });
  K.act('gear-shop', el => {
    const id = el.getAttribute('data-arg') || '', S = K.S;
    if (!K.get('shop').lines.some(l => l.id === id)) return;
    if (S.shopping[id] === true) delete S.shopping[id]; else S.shopping[id] = true;
    K.store.save(); K.invalidate('shop');
  });
  /* live: a ticked enchant line now ok → «Écart fermé»; closed marks older than 30 days are dropped */
  K.on('model', ev => {
    if (!ev || ev.source !== 'live' || K.M.source !== 'live') return;
    const S = K.S, now = new Date().toISOString(), t = Date.now();
    K.guard('shop-close', () => {
      const L = build(K.ctx()).lines;
      L.forEach(l => { const v = S.shopping[l.id]; if (l.kind === 'ench' && l.status === 'ok' && v === true) S.shopping[l.id] = { closed: now }; else if (U.isObj(v) && l.status !== 'ok') delete S.shopping[l.id]; });
      Object.keys(S.shopping).forEach(k => { const v = S.shopping[k]; if (U.isObj(v) && !(Date.parse(v.closed) > t - 30 * 864e5)) delete S.shopping[k]; });
      K.store.save();
    }, true);
  });

  /* ---------- craft + embellishments, BiS ---------- */
  const craft = c => {
    const cr = c.R.crafting;
    if (!cr.advice.length && !cr.embellishments.length && !cr.weaponCraftVerdict) return '';
    return h`<div class="card" data-qa="craft"><div class="card-h"><h2 class="card-t">Craft et embellissements</h2><span class="nowrap">${UI.provResearch()} ${K.pv.conf(cr.confidence, cr.sources)}</span></div>
      ${cr.weaponCraftVerdict ? h`<p class="callout">${U.str(cr.weaponCraftVerdict)}</p>` : ''}
      ${cr.embellishments.length ? h`<div class="chips sem-mt">${cr.embellishments.map(e => h`<span class="chip">${icon('spark', 'i-sm')}${U.str(e.name)} · ${SF(U.str(e.slot))}</span>`)}</div>
        <ul class="list-dot sem-mt">${cr.embellishments.filter(e => e.note).map(e => h`<li><span class="ink">${SF(U.str(e.slot))}</span> · ${U.str(e.note)}</li>`)}</ul>` : ''}
      ${cr.advice.length ? h`<details data-key="gd-craft"><summary class="t-call">Conseils de craft (${cr.advice.length})</summary><ul class="list-dot">${cr.advice.map(x => h`<li>${x}</li>`)}</ul></details>` : ''}</div>`;
  };
  const bis = c => {
    const B = c.R.bisBySlot;
    if (!B.length) return '';
    return h`<details class="card" data-key="gd-bis" data-qa="bis"><summary><span class="card-t">BiS par emplacement</span><span class="nowrap">${UI.provResearch()}</span></summary>
      <ul class="rows">${B.map(b => h`<li class="row"><span class="grow"><span class="ink">${SF(b.slot)}</span> ${K.pv.conf(b.confidence, b.sources)}<br><span class="t-call any">${U.str(b.raid) || F.DASH}</span>${b.mplus && !/^idem$/i.test(U.str(b.mplus)) ? h`<br><span class="t-cap ink2 any">M+ : ${U.str(b.mplus)}</span>` : ''}${b.note ? h`<br><span class="t-cap muted any">${U.str(b.note)}</span>` : ''}</span></li>`)}</ul></details>`;
  };
  Object.assign(GU, { shop, craft, bis });
})(KATA);
