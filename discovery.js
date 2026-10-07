(() => {
  'use strict';
  const search = document.getElementById('faq-search');
  const query = document.getElementById('faq-query');
  const answers = [...document.querySelectorAll('.faq-answer')];
  const groups = [...document.querySelectorAll('.faq-group')];
  const empty = document.getElementById('faq-empty');
  const status = document.getElementById('faq-results');
  const normalise = value => value.toLocaleLowerCase('en-GB').normalize('NFKC').replace(/[£,?]/g, '').replace(/\s+/g, ' ').trim();
  const records = answers.map(answer => ({answer, text: normalise(answer.textContent + ' ' + answer.dataset.keywords)}));
  function filter() {
    const terms = normalise(query.value).split(' ').filter(Boolean);
    let count = 0;
    records.forEach(({answer, text}) => {
      const matches = terms.every(term => text.includes(term));
      answer.hidden = !matches;
      answer.open = matches && terms.length > 0;
      if (matches) count += 1;
    });
    groups.forEach(group => { group.hidden = ![...group.querySelectorAll('.faq-answer')].some(answer => !answer.hidden); });
    empty.hidden = count !== 0;
    status.textContent = terms.length ? `${count} ${count === 1 ? 'answer' : 'answers'} found` : `${answers.length} answers · choose a topic or search`;
  }
  if (search && query) {
    search.hidden = false;
    query.addEventListener('input', filter);
    document.getElementById('faq-clear').addEventListener('click', () => { query.value = ''; filter(); query.focus(); });
    filter();
  }
  function reveal(hash, scroll) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    // A topic or answer link must work even when search has hidden its target.
    if (query && (target.matches('.faq-answer, .faq-group')) && query.value) { query.value = ''; filter(); }
    let ancestor = target;
    while (ancestor) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    if (scroll) requestAnimationFrame(() => target.scrollIntoView({block: 'start'}));
  }
  window.addEventListener('hashchange', () => reveal(location.hash, true));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) reveal(link.hash, true);
  });
  reveal(location.hash, Boolean(location.hash));
})();
