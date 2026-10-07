/* Keep one optional disclosure; preserve older shared section links.
 * Static open HTML is the no-script fallback. No visitor data or network calls. */
(() => {
  'use strict';
  const help = document.getElementById('upload-help');
  if (!help) return;
  function targetFor(hash) {
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch (_) { return null; }
  }
  function reveal(hash, scroll) {
    const target = targetFor(hash);
    if (!target || !help.contains(target)) return;
    help.open = true;
    if (scroll) requestAnimationFrame(() => target.scrollIntoView({block:'start',behavior:'instant'}));
  }
  const initial = targetFor(location.hash);
  let savedOpen = false;
  try { savedOpen = history.state?.kewVideoHelpOpen === true; } catch (_) {}
  help.open = savedOpen || Boolean(initial && help.contains(initial));
  help.addEventListener('toggle', () => {
    try {
      const state = history.state;
      if (state === null || (typeof state === 'object' && !Array.isArray(state))) history.replaceState({...state,kewVideoHelpOpen:help.open},'');
    } catch (_) {}
  });
  reveal(location.hash, true);
  window.addEventListener('hashchange', () => reveal(location.hash, true));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) reveal(link.hash, true);
  });
})();
