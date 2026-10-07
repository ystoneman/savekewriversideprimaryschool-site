'use strict';
(() => {
 const script = document.querySelector('script[data-page]');
 const page = script && script.dataset.page;
 const roots = { 'ystoneman.github.io': '/kew-riverside-website/', 'savekewriverside.org': '/' };
 const prefix = roots[location.hostname];
 if (!prefix || !location.pathname.startsWith(prefix) || !page || page === '404.html') return;
 const relative = location.pathname.slice(prefix.length);
 if (relative !== page && !(page === 'index.html' && relative === '')) return;
 const destination = new URL(page === 'index.html' ? '/' : '/' + page, 'https://savekewriversideprimaryschool.org');
 destination.search = location.search; destination.hash = location.hash;
 const onward = document.querySelector('.cutover-link'); onward.href = destination.href;
 if (page !== 'letters.html' && page !== 'sent.html') { location.replace(destination.href); return; }
 const status = document.getElementById('recovery-status');
 const container = document.getElementById('saved-words');
 const clear = document.getElementById('clear-drafts');
 const fingerprint = text => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + ':' + text.length;
 };
 function state() {
  let blocked = false;
  const read = (area, key) => {
   let raw;
   try { raw = window[area].getItem(key); } catch { blocked = true; return null; }
   try { return JSON.parse(raw); } catch { return null; }
  };
  const draft = read('localStorage', 'kr-letter-draft');
  const pending = read('sessionStorage', 'kr-sent-letter');
  const kind = read('sessionStorage', 'kr-sent-kind');
  const cleared = read('sessionStorage', 'kr-letter-cleared');
  const valid = (record, time, ttl) => record && typeof record[time] === 'number' && Number.isFinite(record[time]) && Date.now() >= record[time] && Date.now() - record[time] < ttl;
  const uncleared = record => typeof record.text === 'string' && record.text.length > 0 && !(cleared && cleared.id === fingerprint(record.text));
  const words = [];
  if (valid(draft, 'saved', 7 * 86400000) && draft.v === 1 && uncleared(draft)) words.push({ text: draft.text, name: typeof draft.name === 'string' ? draft.name : '', label: 'Saved draft' });
  if (valid(pending, 'at', 1800000) && uncleared(pending)) {
   const same = words.find(w => w.text === pending.text);
   if (same) same.label = 'Saved draft and pending letter';
   else words.push({ text: pending.text, name: '', label: 'Pending letter — receipt unconfirmed' });
  }
  return { words, blocked, pendingKind: valid(kind, 'at', 1800000) && kind.kind === 'letter' };
 }
 function render() {
  const current = state(); container.replaceChildren();
  current.words.forEach((word, i) => {
   const section = document.createElement('section'), label = document.createElement('label'), text = document.createElement('textarea');
   text.id = 'recovered-' + i; text.readOnly = true; text.value = word.text;
   label.htmlFor = text.id; label.textContent = word.label; section.append(label, text);
   if (word.name) { const name = document.createElement('p'); name.textContent = 'Saved display name: ' + word.name; section.append(name); }
   const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Copy ' + (i ? 'pending words' : 'saved words');
   button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(word.text); status.textContent = 'Words copied. Paste them on the current website.'; }
    catch { text.focus(); text.select(); status.textContent = 'Copy was unavailable. Your words are selected; use your device’s Copy command.'; }
   });
   section.append(button); container.append(section);
  });
  clear.hidden = current.words.length === 0;
  status.textContent = current.blocked ? 'Some browser storage is unavailable. Any words we can read are shown below. Continue remains available.' : current.words.length ? 'Copy any words you want to keep before clearing them.' : 'No recoverable saved words were found here.';
  return current;
 }
 clear.addEventListener('click', () => {
  const before = state(); let failed = false;
  for (const [area, key] of [['localStorage', 'kr-letter-draft'], ['sessionStorage', 'kr-sent-letter'], ['sessionStorage', 'kr-sent-kind']]) {
   try { window[area].removeItem(key); } catch { failed = true; }
  }
  try { const word = before.words[0]; if (word && !failed) sessionStorage.setItem('kr-letter-cleared', JSON.stringify({ id: fingerprint(word.text), at: Date.now() })); }
  catch { failed = true; }
  render(); status.textContent = failed ? 'Some saved words could not be cleared. They may remain in browser storage; use your browser’s site-data controls if needed.' : 'Saved words cleared from this browser.';
  if (failed) { status.tabIndex = -1; status.focus(); status.scrollIntoView({ block: 'center' }); }
 });
 const initial = render();
 let explicit = new URLSearchParams(location.search).get('recover') === 'draft';
 try { explicit ||= new URL(document.referrer).origin === destination.origin; } catch { /* no referrer */ }
 if (!explicit && !initial.blocked && !initial.words.length && !initial.pendingKind) { location.replace(destination.href); return; }
 const write = new URL('/letters.html', destination.origin);
 write.search = location.search; write.hash = location.hash || '#letter-form'; onward.href = write.href;
 window.addEventListener('pageshow', event => { if (event.persisted) render(); });
})();
