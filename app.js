'use strict';
(() => {
  const form = document.getElementById('record-filters');
  const cards = Array.from(document.querySelectorAll('.source-card'));
  const researchCards = Array.from(document.querySelectorAll('.research-card'));
  const fields = ['q','topic','year','type','status'];
  const controls = {
    q: document.getElementById('record-search'),
    topic: document.getElementById('topic-filter'),
    year: document.getElementById('year-filter'),
    type: document.getElementById('type-filter'),
    status: document.getElementById('status-filter')
  };
  const count = document.getElementById('result-count');
  const researchCount = document.getElementById('research-count');
  const empty = document.getElementById('no-results');
  const library = document.getElementById('source-library');
  const libraryLabel = document.getElementById('library-label');
  const refinements = document.getElementById('record-refinements');
  const figures = document.getElementById('council-figures');
  const normalise = value => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  function matches(card, state) {
    const words = normalise(state.q).trim().split(/\s+/).filter(Boolean);
    return words.every(word => normalise(card.dataset.search).includes(word))
      && ['topic','year','type','status'].every(key => !state[key] || card.dataset[key] === state[key]);
  }
  function apply(updateUrl = true) {
    const state = Object.fromEntries(fields.map(key => [key, controls[key].value]));
    let visible = 0;
    cards.forEach(card => { card.hidden = !matches(card, state); if (!card.hidden) visible++; });
    let visibleResearch = 0;
    researchCards.forEach(card => { card.hidden = !matches(card, state); if (!card.hidden) visibleResearch++; });
    count.textContent = visible + ' of ' + cards.length + ' records';
    researchCount.textContent = visibleResearch + ' of ' + researchCards.length + ' site research reports';
    empty.hidden = visible + visibleResearch > 0;
    const filtering = fields.some(key => state[key]);
    libraryLabel.textContent = filtering ? `${visible} matching original records` : `Browse all ${cards.length} original records`;
    if (filtering || updateUrl) library.open = true;
    if (updateUrl) {
      const url = new URL(window.location.href);
      fields.forEach(key => state[key] ? url.searchParams.set(key, state[key]) : url.searchParams.delete(key));
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }
  function reset() { fields.forEach(key => controls[key].value = ''); apply(); }
  function revealQuestion(id) {
    const target = document.getElementById(id);
    // The overview stays compact; only a specific record opens its own detail.
    const detail = target && target.matches('#gaps article') && target.querySelector('.gap-detail');
    if (detail) detail.open = true;
  }
  function revealAnchor() {
    const id = window.location.hash.slice(1);
    revealQuestion(id);
    if (id === 'evidence') figures.open = true;
    if (!id.startsWith('source-')) return;
    const card = document.getElementById(id);
    if (card && card.closest('#source-library')) library.open = true;
    if (card && card.hidden) {
      reset();
      card.scrollIntoView({ block: 'start' });
    }
  }
  const initial = new URL(window.location.href);
  fields.forEach(key => {
    const value = initial.searchParams.get(key) || '';
    if (key === 'q' || Array.from(controls[key].options).some(option => option.value === value)) {
      controls[key].value = value;
    }
  });
  // Static HTML stays open for failed scripts and no-JavaScript source links.
  const incoming = document.getElementById(location.hash.slice(1));
  library.open = fields.some(key => controls[key].value) || Boolean(incoming && incoming.closest('#source-library'));
  refinements.open = fields.slice(1).some(key => controls[key].value);
  document.querySelectorAll('.gap-detail').forEach(detail => {
    detail.open = Boolean(detail.parentElement.id && detail.parentElement.id === location.hash.slice(1));
  });
  figures.open = location.hash === '#evidence';
  form.addEventListener('submit', event => { event.preventDefault(); apply(); });
  form.addEventListener('input', () => apply());
  form.addEventListener('change', () => apply());
  document.getElementById('clear-filters').addEventListener('click', () => {
    reset(); controls.q.focus();
  });
  window.addEventListener('hashchange', revealAnchor);
  // A click can repeat an existing hash after filters hid its target.
  document.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const questionLink = event.target.closest && event.target.closest('a[href^="#gap-"], a[href="#evidence-found"]');
    if (questionLink) revealQuestion(questionLink.getAttribute('href').slice(1));
    const localLink = event.target.closest && event.target.closest('a[href="#evidence"]');
    if (localLink) figures.open = true;
    const anchor = event.target.closest && event.target.closest('a[href^="#source-"]');
    if (!anchor) return;
    const card = document.getElementById(anchor.getAttribute('href').slice(1));
    if (card && card.closest('#source-library')) library.open = true;
    if (card && card.hidden) reset();
  });
  apply(false);
  revealAnchor();
  // Give native fragment recovery and discovery.js the same saved-search target.
  // Existing query links remain valid; replaceState preserves their Back entry.
  if (fields.some(key => controls[key].value) && ['', '#records'].includes(initial.hash)) {
    window.history.replaceState(window.history.state, '', initial.pathname + initial.search + '#source-search');
  }
})();
