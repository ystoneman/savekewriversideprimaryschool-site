'use strict';
(() => {
  const cases = [...document.querySelectorAll('.lesson-case')];
  const query = document.getElementById('lesson-search');
  const outcome = document.getElementById('lesson-outcome');
  function filter() {
    const term = query.value.trim().toLocaleLowerCase('en-GB');
    let visible = 0;
    for (const entry of cases) {
      entry.hidden = !(entry.textContent.toLocaleLowerCase('en-GB').includes(term) && (outcome.value === 'all' || entry.dataset.outcome === outcome.value));
      if (!entry.hidden) visible++;
    }
    document.getElementById('lesson-count').textContent = visible + (visible === 1 ? ' school shown' : ' schools shown');
    document.getElementById('lesson-empty').hidden = visible !== 0;
  }
  if (query) {
    document.getElementById('lesson-filters').hidden = false;
    query.addEventListener('input', filter);
    outcome.addEventListener('change', filter);
    document.getElementById('lesson-reset').addEventListener('click', () => { query.value = ''; outcome.value = 'all'; filter(); query.focus(); });
  }
  function revealTarget(hash) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    if (target.closest('.lesson-case')?.hidden && query) { query.value = ''; outcome.value = 'all'; filter(); }
    for (let node = target; node; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
  window.addEventListener('hashchange', () => revealTarget(location.hash));
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash === location.hash) revealTarget(link.hash);
  });
  if (location.hash) revealTarget(location.hash);
})();
