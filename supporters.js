'use strict';
(() => {
  const form = document.getElementById('supporter-form');
  const name = document.getElementById('public-name');
  const button = form.querySelector('button[type="submit"]');
  const reference = document.getElementById('supporter-reference');
  if (globalThis.crypto && crypto.randomUUID) {
    reference.value = 'KR-' + crypto.randomUUID();
    document.getElementById('reference-display').textContent = reference.value;
    document.getElementById('reference-note').hidden = false;
  }
  name.addEventListener('input', () => {
    name.setCustomValidity('');
    document.getElementById('preview-name').textContent = name.value.trim() || 'Your chosen public name';
  });
  form.addEventListener('submit', event => {
    if (name.value.trim().length < 2) {
      event.preventDefault();
      name.setCustomValidity('Please enter at least two characters for your public name.');
      name.reportValidity();
      return;
    }
    button.disabled = true;
    button.textContent = 'Continuing to Formspree…';
  });
  window.addEventListener('pageshow', () => {
    button.disabled = false;
    button.textContent = 'Request to add my name';
  });
  const message = document.getElementById('supporter-message');
  const list = document.getElementById('supporter-list');
  fetch('supporters.json', {cache: 'no-store'})
    .then(response => { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
    .then(data => {
      if (!data || Object.keys(data).sort().join(',') !== 'statement,statementVersion,supporters,version' || data.version !== 1 || data.statementVersion !== 'keep-open-2026-09-21' || data.statement !== 'We support keeping Kew Riverside Primary School open.' || !Array.isArray(data.supporters)) throw new Error('Invalid board');
      const keys = ['date', 'displayName', 'id', 'review'].sort().join(',');
      const seen = new Set();
      data.supporters.forEach(item => {
        if (!item || Object.values(item).some(value => typeof value !== 'string') || Object.keys(item).sort().join(',') !== keys || typeof item.id !== 'string' || !/^supporter-[a-f0-9]{12}$/.test(item.id) || seen.has(item.id) || typeof item.displayName !== 'string' || item.displayName.trim().length < 2 || item.displayName.length > 60 || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || Number.isNaN(Date.parse(item.date)) || item.review !== 'Confirmed with contributor; human reviewed') throw new Error('Invalid supporter');
        seen.add(item.id);
      });
      const fragment = document.createDocumentFragment();
      data.supporters.forEach(item => {
        const li = document.createElement('li');
        li.className = 'supporter-card';
        li.id = item.id;
        const name = document.createElement('p');
        name.className = 'public-author';
        name.textContent = item.displayName;
        const note = document.createElement('p');
        note.className = 'field-help';
        note.textContent = 'Listed ' + new Date(item.date + 'T12:00:00Z').toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}) + ' · Confirmed with contributor; human reviewed';
        const removal = document.createElement('a');
        removal.href = 'corrections.html?supporter=' + encodeURIComponent(item.id);
        removal.textContent = 'Correct or remove this entry';
        li.append(name, note, removal);
        fragment.append(li);
      });
      list.replaceChildren(fragment);
      message.textContent = data.supporters.length ? 'The following contributors have confirmed this statement and their public names.' : 'No supporter names have been published yet. Requests are reviewed and confirmed privately before names appear here.';
    })
    .catch(() => { message.textContent = 'The supporter list could not be loaded. Please reload to try again. You can still request to add your name below.'; });
})();
