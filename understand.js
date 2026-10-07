'use strict';
(() => {
  // Keep every existing deep target readable when scripting is unavailable.
  // Enhanced arrivals start with the short answers, then reveal a linked detail.
  document.querySelectorAll('details[data-overview-detail]').forEach(detail => { detail.open = false; });
  function revealLinkedDetails() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    let element = target;
    while (element) {
      if (element.tagName === 'DETAILS') {
        element.open = true;
      }
      element = element.parentElement;
    }
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  window.addEventListener('hashchange', revealLinkedDetails);
  window.addEventListener('pageshow', revealLinkedDetails);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash === location.hash) revealLinkedDetails();
  });
  revealLinkedDetails();
  const controls = document.querySelector('[aria-label="Pupil trend measure"]');
  const views = Array.from(document.querySelectorAll('[data-trend-view]'));
  const status = document.getElementById('trend-status');
  if (!controls || views.length !== 2 || !status) return;
  const buttons = Array.from(controls.querySelectorAll('button'));
  function show(mode) {
    if (!['count', 'change'].includes(mode)) return;
    views.forEach(view => { view.hidden = view.dataset.trendView !== mode; });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.measure === mode)));
    status.textContent = mode === 'count'
      ? 'Pupil numbers · the same scale for each school.'
      : 'Percentage change · each school starts at 0% in the first year shown.';
  }
  buttons.forEach(button => button.addEventListener('click', () => show(button.dataset.measure)));
  show('count');
  controls.hidden = false;
})();
