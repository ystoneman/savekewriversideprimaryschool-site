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

// The citations search includes full source metadata and claim notes, even when
// their presentation is collapsed. It never searches the linked documents.
(() => {
  const query = document.getElementById('citation-query');
  if (!query) return;
  const sources = [...document.querySelectorAll('.lesson-source')];
  const claims = [...document.querySelectorAll('.lesson-claim')];
  const entries = [...sources, ...claims];
  const controls = document.getElementById('citation-search-controls');
  const status = document.getElementById('citation-search-status');
  const normalise = value => value.toLocaleLowerCase('en-GB').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const records = entries.map(entry => ({ entry, text: normalise(entry.textContent) }));
  function filter() {
    const terms = normalise(query.value).trim().split(/\s+/).filter(Boolean);
    records.forEach(({ entry, text }) => { entry.hidden = !terms.every(term => text.includes(term)); });
    const sourceCount = sources.filter(entry => !entry.hidden).length;
    const claimCount = claims.filter(entry => !entry.hidden).length;
    status.textContent = `${sourceCount} sources and ${claimCount} claims${terms.length ? ' found' : ' · search titles and full notes'}`;
    document.getElementById('citation-empty').hidden = sourceCount + claimCount !== 0;
    if (terms.length) {
      document.getElementById('citation-sources').open = true;
      document.getElementById('citation-claims').open = true;
    }
  }
  function clear() { query.value = ''; filter(); }
  function revealCitation(hash) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    const entry = target.closest('.lesson-source, .lesson-claim');
    if (entry && entry.hidden) clear();
    if (entry?.matches('.lesson-source')) {
      const detail = entry.querySelector('details');
      if (detail) detail.open = true;
    }
  }
  controls.hidden = false;
  query.addEventListener('input', filter);
  document.getElementById('citation-clear').addEventListener('click', () => { clear(); query.focus(); });
  window.addEventListener('hashchange', () => revealCitation(location.hash));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, location.href);
    if (url.pathname === location.pathname && url.hash) revealCitation(url.hash);
  });
  revealCitation(location.hash);
})();
