/* First-party collector. Only fixed, reviewed labels leave the page.
 * Protocol: https://docs.umami.is/docs/api/sending-stats
 * No provider JavaScript, DOM recording, form listeners or visitor identity API.
 * Two tiers, both off on the new domain until the visitor chooses: a basic page
 * view, and detailed usage (sections, active time, named actions). A visitor can
 * keep page views only ("Basic counts only") or turn both off.
 * No cookie is set and nothing is written to storage unless a choice is made.
 */
(() => {
  'use strict';
  const ENDPOINT = 'https://cloud.umami.is/api/send';
  const HOST = 'savekewriversideprimaryschool.org';
  const ROOT = '/';
  const KEY = 'kew-analytics-choice-v1';
  const DAY = 24 * 60 * 60 * 1000;
  // An explicit allow lapses after 180 days. An objection or a basic-only choice
  // is kept for five years before the off-by-default state applies again.
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
    'index.html': ['meeting-invitation', 'find-your-way', 'quick-answers', 'visit-school'],
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
  let opener, panel, status, buttons;
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
  const pending = new Set();
  const browserObjects = () => navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  function readChoice() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      choice = saved && saved.v === 1 && ['allow', 'basic', 'deny'].includes(saved.choice) &&
        Number.isFinite(saved.until) && saved.until > Date.now() ? saved.choice : null;
    } catch (_) { storageOK = false; choice = null; }
  }
  // Page views require an explicit saved choice on this new origin. Earlier
  // objections on the GitHub Pages origin cannot be read or migrated here.
  function counting() {
    return config?.enabled === true && storageOK && ['allow', 'basic'].includes(choice) && !browserObjects() &&
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
  function send(name, data) {
    if (name ? !detailed() : !counting()) return;
    const payload = { website: config.websiteId, hostname: HOST, url: canonical(file), title: PAGES[file], referrer: referrer() };
    if (name) { payload.name = name; payload.data = data; }
    const controller = new AbortController();
    pending.add(controller);
    fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
      signal: controller.signal, body: JSON.stringify({ type: 'event', payload })
    }).catch(() => {}).finally(() => pending.delete(controller));
    // No persistent queue or retry: revocation must never release old events.
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
    if (!detailed()) { stop(); return; }
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
    if (!pageSent) { send(); pageSent = true; }
    if (collecting || !detailed()) return;
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
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, choice: value, until: Date.now() + LIFETIME[value] })); choice = value; }
    catch (_) { storageOK = false; choice = null; }
    stop(); start(); update();
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
    const current = choice || 'deny';
    for (const [value, el] of Object.entries(buttons)) {
      el.disabled = locked;
      el.setAttribute('aria-pressed', String(!locked && !privateRoute && value === current));
    }
    status.textContent = !ready ? 'Analytics is not connected. No usage data is being sent.' :
      !storageOK ? 'Your browser could not save a choice, so analytics stays off.' :
      browserObjects() ? 'Your browser’s privacy signal is keeping all analytics off.' :
      privateRoute ? 'Analytics is off on this ' + (file === 'feedback.html' ? 'Share ideas' : 'private request') + ' page.' :
      current === 'allow' ? 'Current setting: basic page counts and detailed usage.' :
      current === 'deny' ? 'Current setting: analytics off' + (choice ? '.' : ' (the default on this domain).') : 'Current setting: basic page counts only.';
  }
  function close() { panel.hidden = true; update(); if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus({ preventScroll: true }); }
  function open(from) { if (!panel.isConnected) document.body.append(panel); opener = from; panel.hidden = false; update(); panel.querySelector('h2').focus({ preventScroll: true }); }
  function buildChoices() {
    // No banner: the panel opens only from the footer or privacy-page links.
    panel = node('section', '', 'analytics-panel'); panel.hidden = true; panel.id = 'analytics-panel';
    panel.setAttribute('aria-labelledby', 'analytics-title');
    const title = node('h2', 'Analytics choices'); title.id = 'analytics-title'; title.tabIndex = -1;
    const dismiss = button('×', close); dismiss.className = 'analytics-close'; dismiss.setAttribute('aria-label', 'Close analytics choices');
    panel.append(title, dismiss,
      node('p', 'Analytics is off on this new domain until you choose a level. Basic counts only records page opens and broad sources. Umami infers device, browser and approximate location. No cookies are set.'),
      node('p', 'Include detailed usage also counts broad sections, active time and key link opens. Turn analytics off stops both levels.'));
    // The choices come before the longer explanation so they fit a small phone screen.
    status = node('p'); status.setAttribute('role', 'status'); panel.append(status);
    const actions = node('div', '', 'analytics-actions');
    const choose = value => () => { persist(value); if (storageOK) close(); };
    buttons = {
      allow: button('Include detailed usage', choose('allow')),
      basic: button('Basic counts only', choose('basic')),
      deny: button('Turn analytics off', choose('deny'))
    };
    actions.append(...Object.values(buttons)); panel.append(actions);
    panel.append(node('p', 'We never record your screen, words you type, names or contact details. Everything on the site works whatever you choose.'));
    const more = node('a', 'How analytics works'); more.href = 'privacy.html#analytics'; panel.append(more);
    // Close without returning focus, so the explanation it leads to is not covered.
    more.addEventListener('click', () => { panel.hidden = true; });
    document.querySelectorAll('a[data-analytics-choices]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); open(link); }));
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    update();
  }
  function action(event) {
    if (!detailed()) return;
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
  // Only this local config is fetched first. No external script is loaded.
  fetch('analytics-config.json', { credentials: 'omit' }).then(r => r.ok ? r.json() : null).then(value => {
    if (value && value.enabled === true && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.websiteId)) config = value;
    update(); start();
  }).catch(() => { update(); });
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
      pageSent = false; seconds = 0; milestones.clear(); actionsSent.clear();
      sections.forEach(s => { s.seconds = 0; s.reached = false; s.engaged = false; });
    }
    readChoice(); update(); start();
  });
})();
