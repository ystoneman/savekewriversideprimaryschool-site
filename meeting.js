(() => {
  'use strict';
  const invitation = document.getElementById('meeting-invitation');
  if (!invitation) return;
  // Calendar dates use the meeting's timezone, including its final evening.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const date = `${values.year}-${values.month}-${values.day}`;
  if (date > '2026-09-29') {
    invitation.hidden = true;
    return;
  }
  document.getElementById('meeting-relative').textContent = date === '2026-09-29'
    ? 'Today’s meeting'
    : date === '2026-09-28'
      ? 'Tomorrow’s meeting'
      : date >= '2026-09-21'
        ? 'Next week’s meeting'
        : 'Upcoming school meeting';
})();
