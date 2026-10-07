'use strict';
(() => {
  // Old QR codes, citations and saved searches remain entry points. Replacement
  // navigation leaves Back pointing at the visitor's actual previous page.
  function followLegacyRoute() {
    const url = new URL(location.href);
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    const alias = target && target.classList.contains('legacy-route') ? target : null;
    const hasEvidenceSearch = ['q', 'topic', 'year', 'type', 'status'].some(key => url.searchParams.has(key));
    const destination = alias ? alias.dataset.destination : (!id && hasEvidenceSearch ? 'evidence.html#records' : null);
    if (!destination) return;
    const next = new URL(destination, location.href);
    next.search = url.search;
    location.replace(next.href);
  }
  window.addEventListener('hashchange', followLegacyRoute);
  window.addEventListener('pageshow', followLegacyRoute);
  followLegacyRoute();
})();
