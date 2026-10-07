/* Optional contributions stay readable if scripts fail. Old shared links reveal their content. */
(() => {
  'use strict';
  document.querySelectorAll('[data-options-detail]').forEach(detail => { detail.open = false; });
  function reveal(hash) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    // Old URLs point at the article or question, rather than its new disclosure.
    const childDetail = target.querySelector(':scope > details[data-options-detail]');
    if (childDetail) childDetail.open = true;
    for (let node = target; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
    target.scrollIntoView({ block: 'start' });
  }
  window.addEventListener('hashchange', () => reveal(location.hash));
  window.addEventListener('pageshow', event => {
    if (event.persisted && location.hash) reveal(location.hash);
  });
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (link?.hash === location.hash) reveal(link.hash);
  });
  if (location.hash) reveal(location.hash);
})();
