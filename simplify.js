/* Optional depth, permanent links and complete reading. No network or storage. */
'use strict';
(() => {
  const main = document.querySelector('main');
  if (!main) return;
  const responses = [...main.querySelectorAll('a[data-current-response]')];
  if (responses.length) {
    const council = 'https://www.richmond.gov.uk/services/children_and_family_care/schools_and_colleges/school_organisation_consultations/kew_riverside_consultation';
    const originals = responses.map(link => ({link, href:link.href, nodes:[...link.childNodes].map(node => node.cloneNode(true))}));
    const notes = responses.map(link => {
      const note = document.createElement('span');
      note.className = 'simple-note current-response-note';
      note.setAttribute('data-current-status', '');
      note.hidden = true;
      link.after(note);
      return note;
    });
    let rendered;
    const refresh = event => {
      const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London', year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
      const part = type => parts.find(item => item.type === type).value;
      const today = `${part('year')}-${part('month')}-${part('day')}`;
      const active = today >= '2026-10-12' && today <= '2026-10-16';
      originals.forEach(({link, href}) => { link.href = active ? href : council; });
      // Keep the pressed target still until click; pointerdown layout changes
      // can cancel a Safari touch activation.
      if (event?.type === 'pointerdown' || rendered === active) return;
      rendered = active;
      originals.forEach(({link, nodes}) => {
        if (active) link.replaceChildren(...nodes.map(node => node.cloneNode(true)));
        else {
          const arrow = document.createElement('span');
          arrow.setAttribute('aria-hidden', 'true');
          arrow.textContent = ' ↗︎';
          link.replaceChildren(document.createTextNode('Check the council consultation'), arrow);
        }
      });
      notes.forEach(note => {
        note.hidden = active;
        note.textContent = active ? '' : today > '2026-10-16'
          ? 'The published 16 October 2026 response deadline has passed. Check the council’s page for current response routes. Earlier information is retained with its original dates.'
          : 'This response shortcut was verified for 12–16 October 2026. Check the council’s page for current response routes.';
      });
    };
    refresh();
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    responses.forEach(link => ['pointerdown','click','auxclick','contextmenu','keydown'].forEach(type => link.addEventListener(type, refresh, {capture:true})));
  }
  const details = [...main.querySelectorAll('details[data-simple-detail], details[data-overview-detail]')];
  const button = main.querySelector('[data-simple-toggle]');
  if (!details.length) return;
  let restoring = true;
  let saved;
  try { saved = history.state?.kewSimpleDetails; } catch { /* Keep a short readable default. */ }
  details.forEach(detail => {
    // Overview defaults belong to their page script; keep static depth open if it fails.
    if (detail.hasAttribute('data-simple-detail') || (saved && detail.id && Object.hasOwn(saved, detail.id))) {
      detail.open = Boolean(saved && detail.id && saved[detail.id]);
    }
  });
  restoring = false;
  let fullState;
  const remember = () => {
    if (restoring) return;
    try {
      if (history.state !== null && (typeof history.state !== 'object' || Array.isArray(history.state))) return;
      const state = Object.fromEntries(details.filter(detail => detail.id).map(detail => [detail.id, detail.open]));
      history.replaceState({...history.state, kewSimpleDetails: state}, '');
    } catch { /* Native disclosures still work when history access is denied. */ }
  };
  const updateButton = () => {
    if (!button) return;
    const expanded = Boolean(fullState);
    button.textContent = expanded ? 'Return to the short view' : 'Show the full page';
    button.setAttribute('aria-expanded', String(expanded));
  };
  function target(hash) {
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return null; }
  }
  function reveal(hash, scroll = true) {
    const element = target(hash);
    if (!element || !main.contains(element)) return;
    for (let node = element; node && node !== main; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
    // Older shared addresses identify the section, not its new disclosure.
    element.querySelector(':scope > details[data-simple-detail]')?.setAttribute('open', '');
    updateButton();
    if (scroll) element.scrollIntoView({block: 'start', behavior: 'instant'});
  }
  details.forEach(detail => detail.addEventListener('toggle', () => { updateButton(); remember(); }));
  if (button) {
    button.hidden = false;
    button.addEventListener('click', () => {
      const expand = !fullState;
      if (expand) {
        fullState = [...main.querySelectorAll('details')].map(detail => [detail, detail.open]);
        fullState.forEach(([detail]) => { detail.open = true; });
      } else {
        fullState.forEach(([detail, open]) => { detail.open = open; });
        fullState = undefined;
      }
      updateButton();
      remember();
      if (!expand) {
        if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
        main.focus({preventScroll:true});
        main.scrollIntoView({block: 'start', behavior: 'instant'});
      }
    });
    updateButton();
  }
  window.addEventListener('hashchange', () => reveal(location.hash));
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) {
      // Reveal before native fragment navigation, including repeated anchors.
      reveal(url.hash, url.hash === location.hash);
    }
  });
  // Browser Back owns its scroll position. Restore disclosure state without
  // competing with navigation.js's reading-position recovery.
  window.addEventListener('pageshow', event => {
    if (!event.persisted && performance.getEntriesByType('navigation')[0]?.type !== 'back_forward') reveal(location.hash);
  });
  let printState;
  window.addEventListener('beforeprint', () => {
    if (printState) return;
    printState = [...main.querySelectorAll('details')].map(detail => [detail, detail.open]);
    restoring = true;
    printState.forEach(([detail]) => { detail.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (!printState) return;
    printState.forEach(([detail, open]) => { detail.open = open; });
    printState = undefined;
    restoring = false;
    updateButton();
  });
  reveal(location.hash);
})();
