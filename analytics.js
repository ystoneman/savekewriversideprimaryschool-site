/* First-party collector. Only fixed, reviewed labels leave the page.
 * Protocol: https://docs.umami.is/docs/api/sending-stats
 * No provider JavaScript, DOM recording, form listeners or visitor identity API.
 * Default aggregate statistics, and opt-in Umami usage analytics.
 * A visitor can keep aggregate statistics only or turn both off.
 * No cookie is set and nothing is written to storage unless a choice is made.
 */
(() => {
  'use strict';
  const ENDPOINT = 'https://gateway.umami.is/api/send';
  // Separate aggregate service; deployment settings verified 10 October 2026.
  const COUNTER_ORIGIN = 'https://kew-riverside-statistics.analytics-backend.workers.dev';
  const HOST = 'savekewriversideprimaryschool.org';
  const ROOT = '/';
  const KEY = 'kew-analytics-choice-v1';
  const DAY = 24 * 60 * 60 * 1000;
  // An explicit allow lapses after 180 days. An objection or a basic-only choice
  // is kept for five years before the aggregate default applies again.
  const LIFETIME = { allow: 180 * DAY, basic: 5 * 365 * DAY, deny: 5 * 365 * DAY };
  const PAGES = {
    'index.html': 'Home & evidence', 'proposal.html': 'Proposal & action plan',
    'faq.html': 'FAQ', 'understand.html': 'Understand the data',
    'lessons.html': 'Lessons from other schools', 'lessons-sources.html': 'Research sources',
    'letters.html': 'Community letters', 'feedback.html': 'Share ideas',
    'about.html': 'Our story', 'videos.html': 'Parent videos',
    'supporters.html': 'Named supporters', 'privacy.html': 'Privacy',
    'evidence.html': 'Evidence & sources', 'options.html': 'Options to keep the school open',
    'corrections.html': 'Corrections'
  };
  // Broad editorial sections only: no individual letters, questions or form fields.
  // Each ID is an entry in the page's own "On this page" list (top level, plus the
  // Evidence source library); a heading ID stands for its enclosing section.
  const SECTIONS = {
    'index.html': ['find-your-way', 'quick-answers', 'visit-school'],
    'proposal.html': ['parent-plan', 'timetable', 'who-decides', 'questions', 'other-schools', 'decision-record', 'take-part'],
    'faq.html': ['taking-part', 'decisions', 'money', 'school-places', 'learning'],
    'understand.html': ['pupil-trends', 'forecast-checks', 'school-places', 'year-groups', 'budget', 'other-proposals', 'learning-and-results', 'methodology'],
    'lessons.html': ['key-lessons', 'visual-guide', 'catalogue', 'method'],
    'letters.html': ['letter-form', 'letter-guidelines', 'letters'],
    'evidence.html': ['records', 'source-search', 'source-library', 'evidence', 'timeline', 'earlier-record', 'gaps', 'method'],
    'options.html': ['option-7', 'options-prep-title', 'options-findings-title', 'options-navigation', 'options-sources-title'],
    'videos.html': ['upload', 'prompt-title', 'process-title']
  };
  const ACTIONS = {
    'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform': 'Opened official response form',
    'https://www.kewriverside.richmond.sch.uk/page/?pid=525&title=Contact+Us': 'Opened school enquiry',
    'https://docs.google.com/forms/d/e/1FAIpQLScJZ8ZnZWTaPUIoM9l2Vjir7TgNNTHuUyDEF5uLRJolm8iccg/viewform': 'Opened video permissions',
    'https://www.dropbox.com/request/9uaa0fawrtdz6pv8b6hn': 'Opened video upload',
    'https://docs.google.com/forms/d/e/1FAIpQLSfK3b8XtDJ5_mhKWTqxfZpZwPOJLGXjN1QIQYTKYlJ0dRAHHQ/viewform': 'Opened Google video upload'
  };
  const DOWNLOADS = {
    'response-checklist.pdf': 'Download clicked: checklist', 'sources.csv': 'Download clicked: source index',
    'lessons-report.pdf': 'Download clicked: research report', 'richmond-schools.csv': 'Download clicked: school comparisons',
    'attainment.csv': 'Download clicked: attainment data'
  };
  const file = location.pathname.split('/').pop() || 'index.html';
  if (!Object.hasOwn(PAGES, file)) return;
  const canonical = name => ROOT + (name === 'index.html' ? '' : name);
  const sitePath = pathname => pathname === ROOT || /^\/[^/]+$/.test(pathname);
  const PRIVATE_PAGES = new Set(['corrections.html', 'feedback.html']);
  const privateRoute = PRIVATE_PAGES.has(file);
  let config, choice = null, storageOK = true, collecting = false;
  let timer, previousTick = 0, lastActivity = 0, seconds = 0, pageSent = false;
  let opener, panel, status, buttons, invitation;
  let legacyBasic = false;
  let configLoaded = false, noticePresented = false, observer;
  let umamiPageSent = false;
  const sectionElement = id => {
    const element = document.getElementById(id);
    return element && /^H[1-6]$/.test(element.tagName) ? element.closest('section') : element;
  };
  const sections = (SECTIONS[file] || []).map(id => ({ id, element: sectionElement(id), seconds: 0, reached: false, engaged: false })).filter(s => s.element);
  // A listed section nested in another (such as source search within Evidence's key
  // findings) takes its own area out of its parent's, so it can be the one in view.
  sections.forEach(s => { s.nested = sections.filter(other => other !== s && s.element.contains(other.element)); });
  const milestones = new Set();
  const actionsSent = new Set();
  const aggregateEvents = new Set();
  const pending = new Set();
  const browserObjects = () => navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  function readChoice() {
    const wasDetailed = choice === 'allow';
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      choice = saved && [1, 2].includes(saved.v) && ['allow', 'basic', 'deny'].includes(saved.choice) &&
        Number.isFinite(saved.until) && saved.until > Date.now() ? saved.choice : null;
      legacyBasic = choice === 'basic' && saved.v === 1;
    } catch (_) { storageOK = false; choice = null; legacyBasic = false; }
    if (choice === 'allow' && !wasDetailed) resetDetailedAttention();
  }
  // New visitors get aggregate counts after the notice is actually presented.
  // An explicit refusal always takes precedence over this default.
  function counting() {
    return config?.enabled === true && storageOK && choice !== 'deny' && (choice !== null || noticePresented) && !browserObjects() &&
      location.hostname === HOST && sitePath(location.pathname) && !privateRoute;
  }
  // Detailed usage requires the visitor's explicit allow choice.
  function detailed() { return counting() && choice === 'allow'; }
  function referrer() {
    // Fixed source buckets only. No external hostname, private path or campaign ID.
    try {
      const url = new URL(document.referrer);
      if (url.hostname === HOST && sitePath(url.pathname)) {
        const name = url.pathname.split('/').pop() || 'index.html';
        return Object.hasOwn(PAGES, name) && !PRIVATE_PAGES.has(name) ? canonical(name) : '';
      }
      if (/(^|\.)google\.(com|co\.uk)$/.test(url.hostname)) return 'https://www.google.com/';
      if (url.hostname === 'www.bing.com') return 'https://www.bing.com/';
      if (['www.duckduckgo.com', 'duckduckgo.com'].includes(url.hostname)) return 'https://duckduckgo.com/';
      if (/(^|\.)(facebook\.com|instagram\.com|youtube\.com|tiktok\.com)$/.test(url.hostname)) return 'https://social.example/';
      return url.protocol === 'https:' ? 'https://external.example/' : '';
    } catch (_) { return ''; }
  }
  function counter(rows) {
    if (!counting() || config.counterEnabled !== true) return;
    rows = rows.filter(row => {
      const key = row.metric + ':' + row.label;
      if (aggregateEvents.has(key)) return false;
      aggregateEvents.add(key); return true;
    });
    if (!rows.length) return;
    request(COUNTER_ORIGIN + '/count', { counters: rows }, { 'Content-Type': 'text/plain' });
  }
  function request(endpoint, body, headers) {
    const controller = new AbortController();
    pending.add(controller);
    fetch(endpoint, {
      method: 'POST', headers,
      credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
      signal: controller.signal, body: JSON.stringify(body)
    }).catch(() => {}).finally(() => pending.delete(controller));
    // No persistent queue or retry: revocation must never release old events.
  }
  function send(name, data) {
    if (!counting() || (name && legacyBasic)) return;
    if (!name) {
      const source = referrer();
      const bucket = !source ? 'direct' : source.startsWith('/') ? 'internal' :
        source.includes('google.com') ? 'google' : source.includes('bing.com') ? 'bing' :
        source.includes('duckduckgo.com') ? 'duckduckgo' : source.includes('social.example') ? 'social' : 'external';
      counter(legacyBasic ? [{ metric: 'page', label: file }] :
        [{ metric: 'page', label: file }, { metric: 'source', label: bucket },
          { metric: 'viewport', label: innerWidth < 600 ? 'small' : innerWidth < 1000 ? 'medium' : 'large' }]);
    } else {
      const metric = { 'Active viewing': 'active', 'Section reached': 'reached',
        'Section viewed 10s': 'viewed', 'Action opened': 'action' }[name];
      if (metric) counter([{ metric, label: metric === 'active' ? String(data.seconds) :
        metric === 'action' ? data.action : file + '#' + data.section }]);
    }
    if (!detailed()) return;
    const payload = { website: config.websiteId, hostname: HOST, url: canonical(file), title: PAGES[file], referrer: referrer() };
    if (name) { payload.name = name; payload.data = data; }
    request(ENDPOINT, { type: 'event', payload }, { 'Content-Type': 'application/json',
      'x-umami-website-id': config.websiteId, 'x-umami-hostname': HOST });
  }
  function visibleArea(element) {
    if (element.closest('[hidden]') || !element.getClientRects().length) return 0;
    const r = element.getBoundingClientRect();
    const headerBottom = Math.max(0, document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0);
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, headerBottom));
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    return h * w;
  }
  function tick() {
    const now = performance.now();
    // Capped deltas prevent hidden/suspended tabs from adding a long elapsed gap.
    const elapsed = Math.min(1.5, Math.max(0, (now - previousTick) / 1000));
    previousTick = now;
    if (!counting()) { stop(); return; }
    if (document.visibilityState !== 'visible' || !document.hasFocus() || now - lastActivity > 60000 || !panel.hidden) return;
    seconds += elapsed;
    for (const threshold of [15, 30, 60, 120, 300]) {
      if (seconds >= threshold && !milestones.has(threshold)) {
        milestones.add(threshold); send('Active viewing', { seconds: threshold });
      }
    }
    // An open menu or a focused input is not counted as reading the page below.
    if (document.querySelector('.mobile-menu[open]') || document.activeElement?.closest('input, textarea, select, form')) return;
    const areas = sections.map(s => ({ section: s, area: visibleArea(s.element) }));
    for (const { section: s, area } of areas) {
      // A viewport-sized denominator also works for very long mobile sections.
      if (area >= innerWidth * Math.min(innerHeight, 200) * .25 && !s.reached) {
        s.reached = true; send('Section reached', { section: s.id });
      }
    }
    const own = areas.map(({ section, area }) => ({ section, area: area - areas.filter(other => section.nested.includes(other.section)).reduce((sum, other) => sum + other.area, 0) }));
    const dominant = own.sort((a, b) => b.area - a.area)[0];
    if (dominant && dominant.area >= innerWidth * Math.min(innerHeight, 200) * .25) {
      const s = dominant.section; s.seconds += elapsed;
      if (!s.engaged && s.seconds >= 10) { s.engaged = true; send('Section viewed 10s', { section: s.id }); }
    }
  }
  function start() {
    if (!counting()) return;
    if (!pageSent) { send(); pageSent = true; if (detailed()) umamiPageSent = true; }
    // Opting in after aggregate collection needs its own Umami page view.
    if (detailed() && !umamiPageSent) {
      if (pageSent) {
        const payload = { website: config.websiteId, hostname: HOST, url: canonical(file), title: PAGES[file], referrer: referrer() };
        request(ENDPOINT, { type: 'event', payload }, { 'Content-Type': 'application/json', 'x-umami-website-id': config.websiteId, 'x-umami-hostname': HOST });
      }
      umamiPageSent = true;
    }
    if (collecting || legacyBasic) return;
    collecting = true;
    lastActivity = previousTick = performance.now();
    timer = setInterval(tick, 1000);
  }
  function stop() {
    collecting = false; clearInterval(timer);
    for (const controller of pending) controller.abort();
    pending.clear();
  }
  function persist(value) {
    const newlyDetailed = value === 'allow' && choice !== 'allow';
    try { localStorage.setItem(KEY, JSON.stringify({ v: 2, choice: value, until: Date.now() + LIFETIME[value] })); choice = value; legacyBasic = false; }
    catch (_) { storageOK = false; choice = null; }
    stop();
    // Optional events measure attention after permission, not earlier activity.
    // Aggregate event deduplication remains separate across this transition.
    if (newlyDetailed) resetDetailedAttention();
    start(); update();
  }
  function resetDetailedAttention() {
    seconds = 0; milestones.clear(); actionsSent.clear();
    sections.forEach(s => { s.seconds = 0; s.reached = false; s.engaged = false; });
  }
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(text, run) { const el = node('button', text); el.type = 'button'; el.addEventListener('click', run); return el; }
  function update() {
    const ready = config?.enabled === true;
    const locked = !ready || !storageOK || browserObjects();
    const current = choice || 'basic';
    for (const [value, el] of Object.entries(buttons)) {
      el.disabled = locked;
      el.setAttribute('aria-pressed', String(!locked && !privateRoute && value === current));
    }
    status.textContent = !ready ? 'Analytics is not connected. No usage data is being sent.' :
      !storageOK ? 'Your browser could not save a choice, so analytics stays off.' :
      browserObjects() ? 'Your browser’s privacy signal is keeping all analytics off.' :
      privateRoute ? 'Analytics is off on this ' + (file === 'feedback.html' ? 'Share ideas' : 'private request') + ' page.' :
      current === 'allow' ? 'Current setting: aggregate statistics and detailed Umami usage.' :
      current === 'deny' ? 'Current setting: analytics off.' : legacyBasic ? 'Current setting: page-open totals only (earlier choice).' : 'Current setting: aggregate statistics only (the default).';
    updateInvitation();
  }
  function updateInvitation() {
    if (!invitation) return;
    invitation.hidden = (configLoaded && config?.enabled !== true) || !storageOK || browserObjects() || Boolean(choice);
    for (const el of invitation.querySelectorAll('button')) el.disabled = config?.enabled !== true;
  }
  function restoreFocus() {
    let target = opener;
    const visible = element => element?.isConnected && !element.closest('[hidden]') && element.getClientRects().length;
    if (!visible(target)) {
      target = invitation?.nextElementSibling || invitation?.parentElement.nextElementSibling;
      while (target && !visible(target)) target = target.nextElementSibling;
      if (!visible(target)) target = document.querySelector('main h1');
      if (target && !target.hasAttribute('tabindex')) target.tabIndex = -1;
    }
    target?.focus({ preventScroll: true });
  }
  function close() { panel.hidden = true; update(); restoreFocus(); }
  function open(from) { if (!panel.isConnected) document.body.append(panel); opener = from; panel.hidden = false; update(); panel.querySelector('h2').focus({ preventScroll: true }); }
  function buildChoices() {
    // The full explanation opens only after an explicit request.
    panel = node('section', '', 'analytics-panel'); panel.hidden = true; panel.id = 'analytics-panel';
    panel.setAttribute('aria-labelledby', 'analytics-title');
    const title = node('h2', 'Analytics choices'); title.id = 'analytics-title'; title.tabIndex = -1;
    const dismiss = button('×', close); dismiss.className = 'analytics-close'; dismiss.setAttribute('aria-label', 'Close analytics choices');
    panel.append(title, dismiss,
      node('p', 'Aggregate statistics keep daily page and interaction totals without visitor histories. Optional Umami groups activity into visits and derives device and approximate location. Turn analytics off stops both.'));
    // The choices come before the longer explanation so they fit a small phone screen.
    status = node('p'); status.setAttribute('role', 'status'); panel.append(status);
    const actions = node('div', '', 'analytics-actions');
    const choose = value => () => { persist(value); if (storageOK) close(); };
    buttons = {
      allow: button('Include detailed usage', choose('allow')),
      basic: button('Aggregate statistics only', choose('basic')),
      deny: button('Turn analytics off', choose('deny'))
    };
    actions.append(...Object.values(buttons)); panel.append(actions);
    panel.append(node('p', 'Aggregate statistics only keeps daily totals of page opens, broad sources, screen-size groups, section visibility, active-time milestones and selected link opens.'));
    panel.append(node('p', 'We never record your screen, words you type, names or contact details. Everything on the site works whatever you choose.'));
    const more = node('a', 'How analytics works'); more.href = 'privacy.html#analytics'; panel.append(more);
    // Close without returning focus, so the explanation it leads to is not covered.
    more.addEventListener('click', () => { panel.hidden = true; });
    document.querySelectorAll('a[data-analytics-choices]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); open(link); }));
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    update();
  }
  function buildInvitation() {
    invitation = node('section', '', 'analytics-invitation');
    invitation.setAttribute('aria-labelledby', 'analytics-invitation-title');
    const title = node('p', 'Aggregate statistics on. Detailed off.');
    title.id = 'analytics-invitation-title';
    const actions = node('div', '', 'analytics-actions');
    const review = button('Choices', () => { open(review); });
    review.setAttribute('aria-label', 'Review choices');
    const refuse = button('Turn off', () => { opener = refuse; persist('deny'); restoreFocus(); });
    refuse.setAttribute('aria-label', 'Turn analytics off');
    const more = node('a', 'Why?'); more.setAttribute('aria-label', 'How statistics work'); more.href = 'privacy.html#analytics';
    title.append(' ', more);
    actions.append(review, refuse); invitation.append(title, actions);
    // Insert synchronously after the arrival content, before config resolves.
    // No automatic focus, overlay, or delayed insertion above a focused control.
    const main = document.querySelector('main');
    let after = main?.querySelector('.parent-plan-spotlight, #upload-step-two');
    const letterIntro = main?.querySelector('.invite-hero');
    if (letterIntro) {
      letterIntro.append(invitation);
    } else {
    if (!after) {
      after = main?.querySelector('h1');
      if (after?.nextElementSibling?.tagName === 'P') after = after.nextElementSibling;
    }
    if (after) after.after(invitation);
    else main?.append(invitation);
    }
    // Anchored arrivals and Back may skip the notice. Never scroll or move focus
    // to analytics; collect only once at least half of its explanation is visible.
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.intersectionRatio >= .5)) {
        noticePresented = true; observer.disconnect(); start();
      }
    }, { threshold: .5 });
    observer.observe(title);
  }
  function action(event) {
    if (!counting()) return;
    const a = event.target.closest?.('a[href]');
    if (!a || a.hasAttribute('data-analytics-choices') || a.closest('form, #letters-list, #suggestions-list, #supporter-list, .analytics-panel')) return;
    let label = Object.hasOwn(ACTIONS, a.href) ? ACTIONS[a.href] : undefined;
    let url;
    try { url = new URL(a.href); } catch (_) { return; }
    if (url.origin === location.origin && sitePath(url.pathname)) {
      const name = url.pathname.split('/').pop() || 'index.html';
      // A jump within this page (menus, Back to top) is not opening a page.
      if (PRIVATE_PAGES.has(name) || name === file) return;
      if (!label && Object.hasOwn(DOWNLOADS, name)) label = DOWNLOADS[name];
      if (!label && Object.hasOwn(PAGES, name) && !url.search) label = 'Opened ' + PAGES[name];
    }
    if (label && !actionsSent.has(label)) { actionsSent.add(label); send('Action opened', { action: label }); }
  }
  readChoice(); buildChoices();
  if (storageOK && !choice && !browserObjects() && !privateRoute && location.hostname === HOST && sitePath(location.pathname)) {
    buildInvitation(); updateInvitation();
  }
  // Only this local config is fetched first. No external script is loaded.
  fetch('analytics-config.json', { credentials: 'omit' }).then(r => r.ok ? r.json() : null).then(value => {
    if (value && value.enabled === true && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.websiteId)) config = value;
    configLoaded = true; update(); start();
  }).catch(() => { configLoaded = true; update(); });
  for (const event of ['pointerdown', 'keydown', 'scroll']) {
    window.addEventListener(event, () => { if (collecting) lastActivity = performance.now(); }, { passive: true });
  }
  document.addEventListener('click', action);
  document.addEventListener('focusin', event => {
    // No focus trap: leaving the nonmodal controls dismisses the overlay, without
    // redirecting the user's next Tab target. Avoid Safari's null focusout trap.
    if (!panel.hidden && !panel.contains(event.target) && event.target !== opener) panel.hidden = true;
    update();
  });
  window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) { readChoice(); stop(); start(); update(); } });
  document.addEventListener('visibilitychange', () => { previousTick = performance.now(); if (document.visibilityState === 'visible') lastActivity = previousTick; });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      pageSent = false; umamiPageSent = false; seconds = 0; milestones.clear(); actionsSent.clear(); aggregateEvents.clear();
      sections.forEach(s => { s.seconds = 0; s.reached = false; s.engaged = false; });
    }
    readChoice(); update(); start();
  });
})();
