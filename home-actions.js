'use strict';
(() => {
  const menu = document.getElementById('menu');
  const disclosures = [...document.querySelectorAll('details')];
  const fallback = document.getElementById('share-fallback');
  const trigger = document.getElementById('share-trigger');
  const url = document.getElementById('share-url');
  const status = document.getElementById('share-status');
  const copy = document.getElementById('copy-link');
  let busy = false;
  trigger.hidden = false;
  fallback.hidden = true;
  fallback.querySelector('summary').classList.remove('action','secondary');
  fallback.querySelector('summary').replaceChildren(document.createTextNode('Copy or select link'));
  copy.hidden = false;
  function manualCopy() {
    fallback.hidden = false; fallback.open = true;
    status.textContent = 'Select and copy the campaign link.';
    url.focus(); url.select();
  }
  async function copyLink() {
    if (!navigator.clipboard?.writeText) { manualCopy(); return; }
    try { await navigator.clipboard.writeText(url.value); status.textContent = 'Campaign link copied.'; }
    catch { manualCopy(); }
  }
  trigger.addEventListener('click', async () => {
    if (busy) return;
    busy = true; trigger.disabled = true; status.textContent = '';
    let manual = false;
    try {
      if (navigator.share) {
        try { await navigator.share({title:'Help keep Kew Riverside Primary School open',text:'Help keep Kew Riverside Primary School open.',url:url.value}); }
        catch (error) { if (error.name !== 'AbortError') { manualCopy(); manual = true; } }
      } else {
        await copyLink(); manual = fallback.open;
      }
    } finally {
      busy = false; trigger.disabled = false;
      if (!manual) trigger.focus();
    }
  });
  copy.addEventListener('click', copyLink);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const current = disclosures.find(item => item.open && item.contains(document.activeElement)) || (menu.open ? menu : null);
    if (current) {
      current.open = false;
      if (current === fallback) { current.hidden = true; trigger.focus(); }
      else current.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', event => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
  const openHash = () => {
    if (location.hash === '#share') { fallback.hidden = false; fallback.open = true; document.getElementById('share').scrollIntoView(); return; }
    const target = disclosures.find(item => '#' + item.id === location.hash);
    if (target) { target.hidden = false; target.open = true; target.scrollIntoView(); }
  };
  window.addEventListener('hashchange', openHash);
  openHash();
  document.addEventListener('DOMContentLoaded', () => {
    const appearance=document.querySelector('.theme-controls');
    const settings=document.querySelector('#site-settings .disclosure-content');
    if (appearance && settings) settings.append(appearance);
  });
})();
