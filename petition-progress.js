'use strict';
(() => {
  const tracker = document.getElementById('petition-progress');
  if (!tracker) return;
  const source = 'https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249';
  const endpoint = 'https://kew-riverside-statistics.analytics-backend.workers.dev/petition';
  const number = new Intl.NumberFormat('en-GB');
  const date = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
  function retire() {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part = type => parts.find(item => item.type === type).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    tracker.hidden = today > '2027-01-13';
    return tracker.hidden;
  }
  retire();
  window.addEventListener('pageshow', retire);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) retire(); });
  setInterval(() => { if (!document.hidden) retire(); }, 60000);
  // Local previews remain offline; production makes one functional aggregate read.
  if (tracker.hidden || location.hostname !== 'savekewriversideprimaryschool.org') return;
  // A late result must not move a control under a finger or keyboard focus.
  let interacted = false;
  ['pointerdown','keydown'].forEach(type => document.addEventListener(type, () => { interacted = true; }, {once:true,capture:true}));
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 8000);
  fetch(endpoint, {credentials:'omit',referrerPolicy:'no-referrer',signal:abort.signal})
    .then(response => { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
    .then(value => {
      const checked = Date.parse(value?.checkedAt);
      if (!value || Object.keys(value).sort().join() !== 'checkedAt,onlineSignatures,source' ||
          !Number.isSafeInteger(value.onlineSignatures) || value.onlineSignatures < 0 || value.onlineSignatures > 1000000 ||
          value.source !== source || !Number.isFinite(checked) || checked > Date.now() + 60000 || Date.now() - checked > 86400000 || retire() || interacted) return;
      const count = value.onlineSignatures;
      document.getElementById('petition-total').textContent = number.format(count);
      document.getElementById('petition-percent').textContent = number.format(count / 10) + '%';
      document.getElementById('petition-remaining').textContent = count >= 1000 ? 'Campaign goal reached.' : number.format(1000 - count) + ' more online signatures to reach the campaign goal.';
      document.getElementById('petition-milestone').textContent = 'First campaign milestone: 500 online signatures' + (count >= 500 ? ' — reached.' : '.');
      const meter = document.getElementById('petition-meter');
      meter.value = Math.min(count, 1000);
      meter.setAttribute('aria-valuetext', number.format(count) + ' online signatures; campaign goal 1,000.');
      const time = document.getElementById('petition-checked');
      time.dateTime = value.checkedAt;
      time.textContent = date.format(new Date(checked)).replace(' at ', ', ');
    }).catch(() => { /* Preserve the explicitly dated council snapshot. */ })
    .finally(() => clearTimeout(timeout));
})();
