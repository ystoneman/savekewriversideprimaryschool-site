'use strict';
// Optional on-site next steps, reachable if the form service's redirect is enabled.
// One Formspree form serves five pages (letters, ideas, contact, corrections,
// supporters), so the sending page records only its kind in this tab. This record
// is not a receipt; a direct visit or unknown kind gets neutral next steps.
(() => {
  const $ = id => document.getElementById(id);
  const read = key => { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } };
  const record = read('kr-sent-kind');
  const fresh = record && typeof record.kind === 'string' && typeof record.at === 'number' && Date.now() - record.at < 30 * 60 * 1000;
  const kind = fresh ? record.kind : 'neutral';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  const closed = today > '2026-10-16';

  const titles = {
    letter: 'After sending your letter',
    meeting: 'After sending your question',
    suggestion: 'After sending your idea',
    evidence: 'After sending your source',
    correction: 'After sending your correction'
  };
  if (titles[kind]) $('sent-title').textContent = titles[kind];
  const isLetter = kind === 'letter';
  const isIdea = ['meeting', 'suggestion', 'evidence', 'correction'].includes(kind);
  $('sent-lead').hidden = isLetter;
  $('sent-letter-lead').hidden = !isLetter;

  // The official route: a full card after a letter, one line after an idea,
  // nothing extra after a private request. Dated asks retire on time.
  $('official-card').hidden = !isLetter || closed;
  $('official-note').hidden = !isIdea || closed;
  $('official-closed').hidden = !(closed && (isLetter || isIdea));
  if (today >= '2026-10-13') $('reminder-line').hidden = true;
  $('share-card').hidden = !isLetter;
  $('sent-more').hidden = !(isLetter || isIdea);

  // A session marker records a Send click, not a Formspree receipt. Keep the draft
  // until the visitor explicitly clears it after checking the provider's result.
  const fingerprint = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + text.length; };
  const saved = isLetter ? read('kr-sent-letter') : null;
  const text = saved && typeof saved.text === 'string' ? saved.text : '';
  if (text) {
    $('copy-step').hidden = false;
    $('open-step-number').textContent = '2';
    $('paste-hint').hidden = false;
    $('forget-wrap').hidden = false;
  }
  $('copy-letter').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      $('copy-status').textContent = 'Copied. Answer the official form’s questions in your own words; use relevant parts of your letter where they fit.';
    } catch {
      const area = $('copy-fallback');
      area.value = text;
      area.classList.remove('sr-only');
      area.removeAttribute('aria-hidden');
      area.select();
      $('copy-status').textContent = 'Select all of the text above and copy it.';
    }
  });
  $('forget-letter').addEventListener('click', () => {
    try {
      if (text) sessionStorage.setItem('kr-letter-cleared', JSON.stringify({ id: fingerprint(text), at: Date.now() }));
      sessionStorage.removeItem('kr-sent-letter');
      sessionStorage.removeItem('kr-sent-kind');
      localStorage.removeItem('kr-letter-draft');
    } catch { /* storage unavailable */ }
    $('copy-step').hidden = true;
    $('open-step-number').textContent = '1';
    $('paste-hint').hidden = true;
    $('forget-wrap').hidden = true;
  });

  // Count-free, first-person share text that matches the Parent action plan's ask.
  const url = 'https://savekewriversideprimaryschool.org/';
  const message = 'I’ve written a few lines about what Kew Riverside Primary School means to us. If you’d like to read or add a community letter, it’s here:';
  if (navigator.share) {
    // The phone's share sheet already offers WhatsApp and Copy, so show one button.
    $('share-page').hidden = false;
    $('share-whatsapp').hidden = true;
    $('share-page').addEventListener('click', () => {
      navigator.share({ title: 'Kew Riverside Primary School', text: message, url }).catch(() => {});
    });
  } else if (navigator.clipboard) {
    $('copy-link').hidden = false;
    $('copy-link').addEventListener('click', () => {
      navigator.clipboard.writeText(message + ' ' + url)
        .then(() => { $('share-status').textContent = 'Message and link copied.'; })
        .catch(() => { $('share-status').textContent = url; });
    });
  }
})();
