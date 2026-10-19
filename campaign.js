'use strict';
// Date-aware consultation blocks on the campaign pages. From 17 October 2026
// (London date) the response invitation gives way to the closed-stage note and,
// on Get involved, current actions precede it. Get involved's static HTML already
// reflects the closed consultation; the historical open stage needs scripts.
(() => {
  const blocks = [...document.querySelectorAll('[data-stage]')];
  if (!blocks.length) return;
  const respond = document.getElementById('respond'), petition = document.getElementById('petition');
  const petitionAction = document.getElementById('involved-petition-action');
  let pointerHeld = false;
  const refresh = () => {
    if (pointerHeld) return;
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
    const part = type => parts.find(item => item.type === type).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    const closed = today > '2026-10-16';
    blocks.forEach(block => { block.hidden = (block.dataset.stage === 'closed') !== closed; });
    // Move only when the order is wrong, so a focused link keeps focus on each refresh.
    if (respond && petition) {
      const lastSection = respond.parentElement.querySelector(':scope > section:last-of-type');
      if (closed && lastSection !== respond) lastSection.after(respond);
      else if (!closed && respond.nextElementSibling !== petition) petition.before(respond);
      respond.setAttribute('aria-labelledby', closed ? 'respond-closed-title' : 'respond-title');
    }
    if (petitionAction) {
      const expired = today > '2027-01-13';
      const title = expired ? 'View the petition' : 'Sign the petition';
      const label = expired ? 'View petition · closed' : 'Sign petition by';
      const heading = document.getElementById('petition-title');
      const actionLabel = petitionAction.querySelector('[data-petition-label]');
      if (heading.textContent !== title) heading.textContent = title;
      if (actionLabel.textContent !== label) actionLabel.textContent = label;
    }
  };
  refresh();
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  // Preserve a pressed touch target across midnight. Refresh on activation too,
  // including keyboard/new-tab/context-menu routes, without changing its URL.
  if (petitionAction) {
    petitionAction.addEventListener('pointerdown', () => { pointerHeld = true; });
    window.addEventListener('pointerup', () => { pointerHeld = false; });
    window.addEventListener('pointercancel', () => { pointerHeld = false; refresh(); });
    for (const event of ['click', 'auxclick', 'contextmenu']) petitionAction.addEventListener(event, refresh, true);
    petitionAction.addEventListener('keydown', event => { if (event.key === 'Enter') refresh(); }, true);
    window.addEventListener('blur', () => { pointerHeld = false; });
  }
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
})();
