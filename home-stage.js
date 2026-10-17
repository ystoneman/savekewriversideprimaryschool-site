'use strict';
(() => {
  const council = 'https://www.richmond.gov.uk/services/children_and_family_care/schools_and_colleges/school_organisation_consultations/kew_riverside_consultation';
  const form = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';
  const action = document.getElementById('main-action');
  const note = document.getElementById('action-note');
  const petition = document.getElementById('petition-action');
  const petitionNote = document.getElementById('petition-note');
  const intro = document.querySelector('.intro');
  let rendered = '';
  function countdownText(deadline, today) {
    const days = Math.round((deadline - today) / 86400000);
    return days === 0 ? 'Closes today' : `${days} ${days === 1 ? 'day' : 'days'} left`;
  }
  function refreshStage(event) {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part = type => parts.find(item => item.type === type).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    const calendarDay = Date.UTC(Number(part('year')), Number(part('month')) - 1, Number(part('day')));
    // The petition runs beyond consultation week; use its own published date.
    if (petition && event?.type !== 'pointerdown') {
      const closed = today > '2027-01-13';
      petition.textContent = closed ? 'View the petition' : 'Sign the petition';
      const consultationOpen = today <= '2026-10-16';
      if (closed) {
        petitionNote.textContent = 'The published petition closing date, 13 January 2027, has passed. Check the council’s petition page for its status.';
      } else {
        const count = document.createElement('strong');
        count.className = 'countdown';
        count.textContent = countdownText(Date.UTC(2027, 0, 13), calendarDay);
        petitionNote.replaceChildren(count, document.createTextNode(' · Petition closes 13 January 2027. For people who live, work or study in Richmond borough; a Richmond Account is required.'+(consultationOpen ? ' Signing does not replace your consultation response.' : '')));
      }
    }
    const stage = today >= '2026-10-12' && today <= '2026-10-16' ? 'active' : today > '2026-10-16' ? 'expired' : 'dated';
    const active = stage === 'active';
    action.href = active ? form : council;
    // Retire an expired destination immediately, but keep the pressed target
    // still until click. Changing the paragraph on pointerdown moved the link
    // under a finger in Safari and cancelled the activation.
    if (event?.type === 'pointerdown') return;
    // The count changes at London midnight even while the stage stays active.
    const renderKey = `${stage}:${today}`;
    if (renderKey === rendered) return;
    rendered = renderKey;
    action.removeAttribute('aria-label');
    action.replaceChildren(document.createTextNode(active ? 'Respond to the council' : 'Check the council consultation'));
    const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden','true'); arrow.textContent = '↗︎'; action.append(arrow);
    const date = document.createElement('strong'); date.textContent = '1 September 2027';
    if (active) {
      intro.replaceChildren(document.createTextNode('Richmond Council proposes closure on '), date, document.createTextNode('; no decision yet. Supporters seek time to test costed recovery and sustainable alternatives.'));
      // Compare calendar dates, not elapsed hours or the visitor's time zone.
      const count = document.createElement('strong');
      count.className = 'countdown';
      count.textContent = countdownText(Date.UTC(2026, 9, 16), calendarDay);
      note.replaceChildren(count, document.createTextNode(' · Respond by 16 October 2026.'));
    } else if (stage === 'expired') {
      intro.textContent = 'Richmond Council proposes closing the school from 1 September 2027. If it proceeds in November 2026, it plans a final decision in April 2027.';
      note.textContent = 'The published 16 October deadline has passed. Check the council’s latest information before acting.';
    } else {
      intro.textContent = 'On 12 October 2026, Richmond Council was consulting on proposed closure from 1 September 2027. Check the council’s page for the current position.';
      note.textContent = 'Published response deadline: 16 October 2026. Check the council’s page.';
    }
    // After the deadline the petition leads; the council's documents stay in Dates.
    action.hidden = stage === 'expired';
    note.hidden = stage === 'expired';
  }
  refreshStage();
  window.addEventListener('pageshow', refreshStage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshStage(); });
  setInterval(() => { if (!document.hidden) refreshStage(); }, 60000);
  // Refresh before a click, keyboard activation, new-tab click or copied-link menu.
  ['pointerdown','click','auxclick','contextmenu','keydown'].forEach(type => {
    action.addEventListener(type, refreshStage, {capture:true});
    if (petition) petition.addEventListener(type, refreshStage, {capture:true});
  });
})();
