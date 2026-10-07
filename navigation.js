/* Shared menus and scroll orientation. Native links/details remain useful without scripts. */
'use strict';
(() => {
  const header = document.querySelector('.site-header');
  const bar = document.querySelector('.site-orientation');
  if (!header || !bar) return;
  const inner = header.querySelector('.header-inner');
  const controls = [...bar.querySelectorAll(':scope > .orientation-inner > details')];
  const sectionMenu = bar.querySelector('.page-sections');
  const trail = bar.querySelector('.section-trail');
  const links = [...bar.querySelectorAll('[data-section-id]')];
  const entries = links.map(link => ({link, target: document.getElementById(link.dataset.sectionId)})).filter(item => item.target);
  const root = document.documentElement;
  let current = null, scheduled = false, lastWidth = innerWidth;
  const close = except => controls.forEach(control => { if (control !== except) control.open = false; });
  controls.forEach(control => control.addEventListener('toggle', () => { if (control.open) close(control); }));
  document.addEventListener('pointerdown', event => { if (!bar.contains(event.target)) close(); });
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!bar.contains(event.target)) close();
    if (link && !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && !link.hasAttribute('download') && (!link.target || link.target === '_self')) {
      const destination = new URL(link.href, location.href);
      if (/^https?:$/.test(destination.protocol)) rememberPosition();
    }
    if (!link || !bar.contains(link) || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (link.closest('.section-links')) {
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (target) {
        for (let node = target; node; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true;
        const ownDetail = target.querySelector(':scope > details[data-options-detail]');
        if (ownDetail) ownDetail.open = true;
        requestAnimationFrame(() => {
          const destination = target.matches('details') ? target.querySelector('summary') : target;
          if (!destination.hasAttribute('tabindex') && !destination.matches('summary,a,button,input')) {
            destination.setAttribute('tabindex','-1');
            destination.addEventListener('blur', () => destination.removeAttribute('tabindex'), {once:true});
          }
          destination.focus({preventScroll:true});
          target.scrollIntoView({block:'start',behavior:'instant'});
          schedule();
        });
      }
    }
    close();
  });
  document.addEventListener('focusin', event => {
    controls.forEach(control => { if (control.open && !control.contains(event.target)) control.open = false; });
    // Keep a newly focused control clear of the persistent region. No passive focus changes.
    if (event.target.closest('main')) requestAnimationFrame(() => {
      const rect = event.target.getBoundingClientRect();
      const bottom = bar.getBoundingClientRect().bottom;
      if (rect.top < bottom + 8 && rect.bottom > 0) window.scrollBy({top:rect.top-bottom-12,behavior:'instant'});
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = controls.find(control => control.open);
    if (open) { open.open = false; open.querySelector('summary').focus(); event.preventDefault(); }
  });
  function measure() {
    root.classList.toggle('nav-large-text', parseFloat(getComputedStyle(bar.querySelector('.page-name')).fontSize)>21);
    root.style.setProperty('--nav-hide-top', -inner.getBoundingClientRect().height+'px');
    root.style.setProperty('--nav-height', bar.getBoundingClientRect().height+'px');
    schedule();
  }
  function exposed(target) {
    if (!target.getClientRects().length || target.closest('[hidden]')) return false;
    for (let node=target.parentElement; node; node=node.parentElement) {
      if (node.tagName === 'DETAILS' && !node.open && !node.querySelector(':scope > summary')?.contains(target)) return false;
    }
    return true;
  }
  function update() {
    scheduled = false;
    root.style.setProperty('--nav-bottom', Math.max(bar.getBoundingClientRect().bottom, bar.getBoundingClientRect().height)+'px');
    const available = entries.filter(item => exposed(item.target));
    entries.forEach(item => { item.link.hidden = !available.includes(item); });
    const edge = bar.getBoundingClientRect().bottom + 28;
    const passed = available.filter(item => item.target.getBoundingClientRect().top <= edge);
    let next = passed.at(-1) || null;
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) next = available.at(-1) || next;
    // Side-by-side cards do not imply the visitor has reached the last card first.
    if (next?.link.dataset.parent) {
      const peers = passed.filter(item => item.link.dataset.parent === next.link.dataset.parent && Math.abs(item.target.getBoundingClientRect().top-next.target.getBoundingClientRect().top)<4);
      if (peers.length > 1) next = entries.find(item => item.target.id === next.link.dataset.parent) || next;
    }
    if (next !== current) {
      current = next;
      entries.forEach(item => item.link.removeAttribute('aria-current'));
      if (current) current.link.setAttribute('aria-current','location');
      const parent = current?.link.dataset.parent && entries.find(item => item.target.id === current.link.dataset.parent);
      if (trail) trail.textContent = current ? (parent ? parent.link.textContent+' › ' : '')+current.link.textContent : 'Choose a section';
      const fallback = bar.querySelector('.section-copy-fallback');
      if (fallback) fallback.hidden = true;
      const status = bar.querySelector('.section-copy-status');
      if (status) status.textContent = '';
    }
    const share = bar.querySelector('.section-share');
    if (share) share.hidden = !current;
  }
  function schedule() { if (!scheduled) { scheduled=true; requestAnimationFrame(update); } }
  root.classList.add('has-orientation');
  measure();
  let measurePending = false;
  const resizeMeasure = () => {
    if (measurePending) return;
    measurePending = true;
    requestAnimationFrame(() => { measurePending=false; measure(); });
  };
  new ResizeObserver(resizeMeasure).observe(inner);
  new ResizeObserver(resizeMeasure).observe(bar);
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize', () => { if (innerWidth !== lastWidth) close(); lastWidth=innerWidth; measure(); });
  window.addEventListener('hashchange',schedule);
  // Store coordinates only in this history entry, while the document is active.
  // Do not write at pagehide: WebKit may already expose the destination entry.
  function rememberPosition() {
    try {
      if (history.state !== null && (typeof history.state !== 'object' || Array.isArray(history.state))) return;
      const state = {...history.state};
      if (history.scrollRestoration === 'manual') delete state.kewReadingPosition;
      else state.kewReadingPosition = {url:location.href,x:scrollX,y:scrollY};
      history.replaceState(state, '');
    } catch { /* Native browser history remains available. */ }
  }
  document.addEventListener('submit', event => { if (!event.defaultPrevented) rememberPosition(); });
  function forgetPosition(position) {
    try {
      const saved = history.state?.kewReadingPosition;
      if (!position || saved?.url !== position.url || saved.x !== position.x || saved.y !== position.y) return;
      const state = {...history.state};
      delete state.kewReadingPosition;
      history.replaceState(state, '');
    } catch { /* History may be unavailable during another navigation. */ }
  }
  window.addEventListener('pageshow', event => {
    const position = history.state?.kewReadingPosition;
    const returned = event.persisted || performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
    if (returned && position?.url === location.href && Number.isFinite(position.x) && Number.isFinite(position.y) && position.y > 0 && history.scrollRestoration !== 'manual') {
      // WebKit can reset to zero just after pageshow on an external handoff.
      // Give native restoration its frame, preserving it whenever it succeeds.
      const interactions = ['pointerdown', 'keydown', 'click', 'input', 'change'];
      const cancel = () => { cancelAnimationFrame(frame); cleanup(); forgetPosition(position); };
      const cleanup = () => {
        interactions.forEach(type => document.removeEventListener(type,cancel));
        window.removeEventListener('wheel',cancel);
      };
      const frame = requestAnimationFrame(() => {
        cleanup();
        const currentPosition = history.state?.kewReadingPosition;
        if (location.href === position.url && currentPosition?.url === position.url && currentPosition.x === position.x && currentPosition.y === position.y && history.scrollRestoration !== 'manual' && scrollY === 0) {
          window.scrollTo({left:position.x,top:position.y,behavior:'instant'});
        }
        // One return only: toolbar navigation must not revive an older departure.
        forgetPosition(position);
      });
      interactions.forEach(type => document.addEventListener(type,cancel,{once:true}));
      window.addEventListener('wheel',cancel,{once:true,passive:true});
    } else forgetPosition(position);
    schedule();
  });
  document.addEventListener('DOMContentLoaded',schedule);
  document.addEventListener('toggle',schedule,true);
  const main = document.querySelector('main');
  if (main) new MutationObserver(schedule).observe(main,{subtree:true,attributes:true,attributeFilter:['hidden','open']});
  bar.querySelector('.section-copy')?.addEventListener('click', async () => {
    if (!current) return;
    const url = new URL(location.href);
    url.hash = current.target.id;
    const field = bar.querySelector('.section-copy-fallback');
    const status = bar.querySelector('.section-copy-status');
    try { await navigator.clipboard.writeText(url.href); status.textContent = 'Section link copied.'; field.hidden=true; }
    catch { field.value=url.href; field.hidden=false; field.focus(); field.select(); status.textContent='Select and copy this section link.'; }
  });
})();
