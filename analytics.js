/* First-party collector. Only fixed, reviewed labels leave the page.
 * Protocol: https://docs.umami.is/docs/api/sending-stats
 * No provider JavaScript, DOM recording, form listeners or visitor identity API.
 * Default aggregate statistics, and opt-in Umami usage analytics.
 * A visitor can keep aggregate statistics only or turn both off.
 * No cookie or visitor ID is set. A date-only daily-count marker stays on device.
 */
(() => {
  'use strict';
  const ENDPOINT = 'https://gateway.umami.is/api/send';
  // Separate aggregate service; deployment settings verified 10 October 2026.
  const COUNTER_ORIGIN = 'https://kew-riverside-statistics.analytics-backend.workers.dev';
  const HOST = 'savekewriversideprimaryschool.org';
  const ROOT = '/';
  const KEY = 'kew-analytics-choice-v1';
  const BROWSER_DAY_KEY = 'kew-analytics-browser-day';
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
    'index.html': [],
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
  let legacyBasic = false, expandedScope = true, dailyScope = true, hourlyScope = true;
  let performanceSent = false, restoredPage = false, performanceTimer, performanceAttempts = 0;
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
      choice = saved && [1, 2, 3, 4, 5].includes(saved.v) && ['allow', 'basic', 'deny'].includes(saved.choice) &&
        Number.isFinite(saved.until) && saved.until > Date.now() ? saved.choice : null;
      legacyBasic = choice === 'basic' && saved.v === 1;
      expandedScope = !choice || saved.v >= 3;
      dailyScope = !choice || saved.v >= 4;
      hourlyScope = !choice || saved.v >= 5;
      if (choice === 'deny' || browserObjects()) localStorage.removeItem(BROWSER_DAY_KEY);
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
  // New dimensions stay in the aggregate service, never the Umami payload.
  function aggregateContext() {
    if (!expandedScope || legacyBasic) return;
    let source = 'direct';
    try {
      const url = new URL(document.referrer);
      const host = url.hostname.toLowerCase();
      if (url.origin === location.origin) {
        source = 'internal';
        const from = url.pathname.split('/').pop() || 'index.html';
        if (sitePath(url.pathname) && Object.hasOwn(PAGES, from) && !PRIVATE_PAGES.has(from)) {
          counter([{ metric: 'navigation', label: from + '>' + file }]);
        }
      } else if (['https:', 'http:'].includes(url.protocol)) {
        const sources = {
          'bbc.co.uk': 'bbc', 'bbc.com': 'bbc', 'theguardian.com': 'guardian',
          'standard.co.uk': 'standard', 'mylondon.news': 'mylondon',
          'richmond.nub.news': 'richmond-nub', 'richmondandtwickenhamtimes.co.uk': 'richmond-times',
          'yourlocalguardian.co.uk': 'local-guardian',
          'facebook.com': 'facebook', 'instagram.com': 'instagram', 'youtube.com': 'youtube',
          'tiktok.com': 'tiktok', 't.co': 'x', 'x.com': 'x', 'twitter.com': 'x',
          'linkedin.com': 'linkedin', 'whatsapp.com': 'whatsapp',
          'google.com': 'google', 'google.co.uk': 'google', 'bing.com': 'bing',
          'duckduckgo.com': 'duckduckgo'
        };
        source = Object.entries(sources).find(([domain]) => host === domain || host.endsWith('.' + domain))?.[1] || 'external';
      }
    } catch (_) {}
    counter([{ metric: 'referral', label: source }]);
    // Parse locally into separate coarse buckets; never transmit the UA string.
    const ua = navigator.userAgent || '';
    const browser = /Edg(?:e|A|iOS)?\//.test(ua) ? 'edge' : /(?:OPR|Opera)\//.test(ua) ? 'opera' :
      /SamsungBrowser\//.test(ua) ? 'samsung' : /(?:Firefox|FxiOS)\//.test(ua) ? 'firefox' :
      /(?:Chrome|CriOS)\//.test(ua) ? 'chrome' : /Version\/.*Safari\//.test(ua) ? 'safari' : 'other';
    const os = /Android/.test(ua) ? 'android' : /iPhone|iPad|iPod/.test(ua) ? 'ios' :
      /Windows/.test(ua) ? 'windows' : /CrOS/.test(ua) ? 'chromeos' : /Macintosh|Mac OS X/.test(ua) ? 'macos' : /Linux/.test(ua) ? 'linux' : 'other';
    const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet' :
      /Mobi|iPhone|iPod/.test(ua) ? 'mobile' : /Windows|Macintosh|X11|CrOS/.test(ua) ? 'desktop' : 'other';
    counter([{ metric: 'browser', label: browser }, { metric: 'os', label: os }, { metric: 'device', label: device }]);
  }
  function measurePerformance() {
    if (performanceTimer || performanceSent || restoredPage) return;
    // The load handler must finish before loadEventEnd can be nonzero.
    performanceTimer = setTimeout(capturePerformance, 0);
  }
  function capturePerformance() {
    performanceTimer = null;
    if (!counting() || !expandedScope || legacyBasic || performanceSent || restoredPage || document.readyState !== 'complete') return;
    // One sample per document; unsupported timings are explicit, never zero-speed.
    const nav = performance.getEntriesByType?.('navigation')[0];
    const paint = performance.getEntriesByName?.('first-contentful-paint')[0];
    if ((!nav?.loadEventEnd || !paint?.startTime) && performanceAttempts++ < 5) {
      performanceTimer = setTimeout(capturePerformance, 200); return;
    }
    performanceSent = true;
    const bucket = value => !Number.isFinite(value) || value <= 0 ? 'unavailable' :
      value <= 1000 ? 'under-1s' : value <= 2500 ? '1-2.5s' : value <= 4000 ? '2.5-4s' : 'over-4s';
    for (const [metric, value] of [['load', nav?.loadEventEnd], ['ttfb', nav?.responseStart], ['fcp', paint?.startTime]]) {
      counter([{ metric, label: file + '|' + bucket(value) }]);
    }
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
  // Same-origin locks serialize the date check/write across tabs. The date is
  // not an identifier and is never sent. Mark before sending and never retry:
  // interrupted delivery can undercount, but reloads cannot resend that day.
  function countDailyBrowser() {
    if (!dailyScope || !counting() || config.counterEnabled !== true || !navigator.locks?.request) return;
    navigator.locks.request('kew-analytics-browser-day', () => {
      if (!dailyScope || !counting() || config.counterEnabled !== true) return;
      const day = new Date().toISOString().slice(0, 10);
      try {
        // Check the latest persisted scope without changing this page's Umami
        // permission/timing state. Storage events own that separate transition.
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        const current = saved && [1, 2, 3, 4, 5].includes(saved.v) &&
          ['allow', 'basic', 'deny'].includes(saved.choice) &&
          Number.isFinite(saved.until) && saved.until > Date.now() ? saved : null;
        if ((current?.choice || null) !== choice || (current && current.v < 4)) return;
        if (localStorage.getItem(BROWSER_DAY_KEY) === day) return;
        localStorage.setItem(BROWSER_DAY_KEY, day);
      } catch (_) { return; }
      if (dailyScope && counting()) {
        // Isolated total: no page, device, referral or date supplied by client.
        request(COUNTER_ORIGIN + '/count', { counters: [{ metric: 'browser_day', label: 'all' }] }, { 'Content-Type': 'text/plain' });
      }
    }).catch(() => {});
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
      // Independent total; no page label, client time or browser ID.
      if (hourlyScope) counter([{ metric: 'page_hour', label: 'all' }]);
    } else {
      const metric = { 'Active viewing': 'active', 'Section reached': 'reached',
        'Section viewed 10s': 'viewed', 'Action opened': 'action' }[name];
      if (metric) counter([{ metric, label: metric === 'active' ? String(data.seconds) :
        metric === 'action' ? data.action : file + '#' + data.section }]);
    }
    if (name === 'Active viewing' && expandedScope) counter([{ metric: 'active_page', label: file + '|' + data.seconds }]);
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
    aggregateContext();
    countDailyBrowser();
    measurePerformance();
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
    collecting = false; clearInterval(timer); clearTimeout(performanceTimer); performanceTimer = null;
    for (const controller of pending) controller.abort();
    pending.clear();
  }
  function persist(value) {
    const newlyDetailed = value === 'allow' && choice !== 'allow';
    try { localStorage.setItem(KEY, JSON.stringify({ v: 5, choice: value, until: Date.now() + LIFETIME[value] })); choice = value; legacyBasic = false; expandedScope = true; dailyScope = true; hourlyScope = true;
      if (value === 'deny') localStorage.removeItem(BROWSER_DAY_KEY); }
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
    if (!locked && !privateRoute && current !== 'deny' && !dailyScope) status.textContent += ' Earlier choice: daily browser count is off until you choose again.';
    if (!locked && !privateRoute && current !== 'deny' && !hourlyScope) status.textContent += ' Hourly page totals are off until you choose again.';
    updateInvitation();
  }
  function updateInvitation() {
    if (!invitation) return;
    invitation.hidden = (configLoaded && config?.enabled !== true) || !storageOK || browserObjects() || Boolean(choice);
    for (const el of invitation.querySelectorAll('button')) el.disabled = config?.enabled !== true;
    measureNotice();
  }
  function restoreFocus() {
    let target = opener;
    const visible = element => element?.isConnected && !element.closest('[hidden]') && element.getClientRects().length;
    if (!visible(target)) {
      target = document.querySelector('.site-orientation .mobile-menu > summary') || invitation?.nextElementSibling || invitation?.parentElement.nextElementSibling;
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
    const title = node('h2', 'Help improve this website'); title.id = 'analytics-title'; title.tabIndex = -1;
    const dismiss = button('×', close); dismiss.className = 'analytics-close'; dismiss.setAttribute('aria-label', 'Close analytics choices');
    panel.append(title, dismiss,
      node('p', 'Help us make useful information easier to find and fix pages that are slow or difficult to use.'),
      node('p', 'Basic totals include hourly page opens and a daily browser count using a saved date on this device, without visitor histories. Optional Umami analytics groups your activity into visits and derives device and approximate location. Turn analytics off stops both.'));
    // The choices come before the longer explanation so they fit a small phone screen.
    status = node('p'); status.setAttribute('role', 'status'); panel.append(status);
    const actions = node('div', '', 'analytics-actions');
    const choose = value => () => { persist(value); if (storageOK) close(); };
    buttons = {
      allow: button('Allow detailed analytics', choose('allow')),
      basic: button('Keep basic only', choose('basic')),
      deny: button('Turn analytics off', choose('deny'))
    };
    actions.append(...Object.values(buttons)); panel.append(actions);
    panel.append(node('p', 'Basic statistics count page opens, public page-to-page arrivals, broad referral and device categories, loading-speed groups, section visibility, active-time milestones and selected link opens.'));
    panel.append(node('p', 'The daily count estimates browsers, not people. The date stays here until replaced on a later counted day or cleared; Off removes it. Days use UTC.'));
    panel.append(node('p', 'We never record your screen, words you type, names or contact details. Everything on the site works whatever you choose.'));
    const more = node('a', 'How analytics works'); more.href = 'privacy.html#analytics'; panel.append(more);
    // Close without returning focus, so the explanation it leads to is not covered.
    more.addEventListener('click', () => { panel.hidden = true; });
    document.querySelectorAll('a[data-analytics-choices]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); open(link); }));
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    update();
  }
  function measureNotice() {
    const bar = invitation?.closest('.site-orientation');
    if (bar) document.documentElement.style.setProperty('--nav-height', bar.getBoundingClientRect().height + 'px');
  }
  function buildInvitation() {
    invitation = node('section', '', 'analytics-invitation');
    invitation.setAttribute('aria-labelledby', 'analytics-invitation-title');
    const title = node('p', 'Basic on: hourly page totals; daily browsers use a saved date. Umami off.');
    title.id = 'analytics-invitation-title';
    const actions = node('div', '', 'analytics-actions');
    const review = button('Analytics', () => { open(review); });
    review.setAttribute('aria-label', 'Review analytics choices');
    const refuse = button('Off', () => { opener = refuse; persist('deny'); restoreFocus(); });
    refuse.setAttribute('aria-label', 'Turn analytics off');
    const more = node('a', 'Why?'); more.setAttribute('aria-label', 'How statistics work'); more.href = 'privacy.html#analytics';
    title.append(' ', more);
    actions.append(review, refuse); invitation.append(title, actions);
    // Keep the explanation and objection available at deep-link arrivals too.
    // Insertion is synchronous, before initial fragment positioning. The existing
    // navigation ResizeObserver continues to maintain height after reflow.
    const bar = document.querySelector('.site-orientation');
    if (!bar) return;
    invitation.classList.add('wrap');
    bar.append(invitation);
    measureNotice();
    // Collection starts only once the whole compact notice, including Off, is
    // visible. Never scroll or move focus to make a visitor countable.
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.intersectionRatio >= 1)) {
        noticePresented = true; observer.disconnect(); start();
      }
    }, { threshold: 1 });
    observer.observe(invitation);
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
  window.addEventListener('load', () => setTimeout(measurePerformance, 0));
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      restoredPage = true;
      pageSent = false; umamiPageSent = false; seconds = 0; milestones.clear(); actionsSent.clear(); aggregateEvents.clear();
      sections.forEach(s => { s.seconds = 0; s.reached = false; s.engaged = false; });
    }
    readChoice(); update(); start();
  });
})();
