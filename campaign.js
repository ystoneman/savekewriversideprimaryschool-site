'use strict';
// Date-aware consultation blocks on the campaign pages. From 17 October 2026
// (London date) the response invitation gives way to the closed-stage note.
// Without scripts the open-stage text stays; update the static copy after the deadline.
(() => {
  const blocks = [...document.querySelectorAll('[data-stage]')];
  if (!blocks.length) return;
  const refresh = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
    const part = type => parts.find(item => item.type === type).value;
    const closed = `${part('year')}-${part('month')}-${part('day')}` > '2026-10-16';
    blocks.forEach(block => { block.hidden = (block.dataset.stage === 'closed') !== closed; });
  };
  refresh();
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
})();
