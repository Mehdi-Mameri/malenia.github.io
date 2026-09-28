/* 99-boot.js — boot sequence (spec §6.2). Stage 1. Keep this file last.
   t0: research → store (S) → cache → aux from cache → M (cache ‖ 21/08 snapshot) → __LYARA__ →
       shell + router render the current screen SYNCHRONOUSLY (first paint, no await) → storage toast →
       then the 4 raider.io requests in parallel (K.net.start) and the 30 s clock. */
(function (K) {
  'use strict';
  const L = window.__LYARA__;
  const boot = () => {
    K.research.load();
    L.researchOk = K.research.ok;
    L.researchAsOf = K.research.asOf;
    K.store.load();
    const cache = K.store.readCache();
    K.aux.fromCache(cache);
    K.model.set(K.model.initial(cache));
    L.phase = 'boot';
    L.weekKey = K.time.info().weekKey;
    K.emit('model', { source: K.M.source });
    K.shell.init();
    K.router.init();
    K.store.flushWarn();
    K.emit('booted');
    K.net.start();
    K.clock.start();
  };
  try { boot(); }
  catch (e) {
    K.report('boot', e);
    const main = document.getElementById('main');
    if (main && K.ui) K.setHTML(main, K.ui.sectionError('boot'));
  }
})(KATA);
