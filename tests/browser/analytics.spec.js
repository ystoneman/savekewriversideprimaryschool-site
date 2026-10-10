const { test, expect, captureSubmissions, revealLetterChoices } = require('./fixtures');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const origin = 'https://savekewriversideprimaryschool.org';
const prefix = '/';
const site = origin + prefix;
const endpoint = 'https://gateway.umami.is/api/send';
const counterEndpoint = 'https://kew-riverside-statistics.analytics-backend.workers.dev/count';
const choiceKey = 'kew-analytics-choice-v1';
const fakeConfig = { enabled: true, counterEnabled: true, websiteId: '01234567-89ab-4cde-8123-456789abcdef' };
const officialForm = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';
const sentinel = 'FICTIONAL_PRIVATE_VALUE_NEVER_SEND_84';
const types = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.csv': 'text/csv',
  '.ico': 'image/x-icon',
};
const localAssets = new Set(readdirSync(root).filter(name => types[path.extname(name)]));
for (const name of ['school-discovery-480.jpg', 'school-discovery-960.jpg', 'school-project-480.jpg', 'school-project-960.jpg']) {
  localAssets.add('images/' + name);
}
const emptyBoards = {
  'letters.json': { version: 1, letters: [] },
  'suggestions.json': { version: 1, suggestions: [] },
  'supporters.json': {
    version: 1, statementVersion: 'keep-open-2026-09-21',
    statement: 'We support keeping Kew Riverside Primary School open.', supporters: [],
  },
};

// Exercise the production hostname gate without contacting the live website or
// analytics service. The shared networkGuard remains active underneath these
// exact, local-fixture routes. No real board entries enter this suite.
async function virtualProduction(context, options = {}) {
  const sent = [];
  const configReads = [];
  const aggregates = [];
  const servedPrefix = options.prefix || prefix;
  await context.route(origin + '/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.method(), 'Virtual production serves only local GET assets').toBe('GET');
    expect(url.pathname.startsWith(servedPrefix)).toBe(true);
    const relative = decodeURIComponent(url.pathname.slice(servedPrefix.length));
    const name = relative || 'index.html';
    expect(name, 'Only root assets or the named photo directory; no traversal').toMatch(/^(?:images\/)?[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
    expect(localAssets.has(name), 'Only an existing local static asset can be served: ' + name).toBe(true);
    if (name === 'analytics-config.json') {
      configReads.push(request.url());
      if (options.configBarrier) await options.configBarrier;
      if (options.configFailure) {
        await route.fulfill({ status: 503, body: 'Intentional local config outage', headers: { 'X-Test-Fixture': 'intentional-error' } });
      } else {
        await route.fulfill({ json: options.config === undefined ? fakeConfig : options.config });
      }
    } else if (Object.hasOwn(emptyBoards, name)) {
      await route.fulfill({ json: emptyBoards[name] });
    } else {
      await route.fulfill({ contentType: types[path.extname(name)], body: readFileSync(path.join(root, name)) });
    }
  });
  await context.route(endpoint, async route => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    sent.push({ body: request.postDataJSON(), headers: request.headers() });
    if (options.collectorFailure) {
      await route.fulfill({ status: 503, body: 'Intentional local collector outage', headers: { 'X-Test-Fixture': 'intentional-error' } });
    } else {
      await route.fulfill({ json: { cache: 'fictional-test-session-only' } });
    }
  });
  await context.route(counterEndpoint, async route => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    aggregates.push({ body: request.postDataJSON(), headers: request.headers() });
    await route.fulfill({ json: { accepted: true } });
  });
  return { sent, configReads, aggregates };
}

async function savedChoice(page, choice = 'allow', until = 'future') {
  await page.addInitScript(({ key, value, expiry }) => {
    localStorage.setItem(key, JSON.stringify({ v: 1, choice: value, until: Date.now() + (expiry === 'future' ? 86_400_000 : -1000) }));
  }, { key: choiceKey, value: choice, expiry: until });
}

async function choices(page) {
  await page.getByRole('link', { name: 'Analytics choices', exact: true }).click();
  const panel = page.locator('#analytics-panel');
  await expect(panel).toBeVisible();
  return panel;
}

const ALLOW = 'Include detailed usage';
const BASIC = 'Aggregate statistics only';
const OFF = 'Turn analytics off';

async function allowAnalytics(page) {
  const panel = await choices(page);
  await expect(panel.getByRole('button', { name: ALLOW, exact: true })).toBeEnabled();
  await panel.getByRole('button', { name: ALLOW, exact: true }).click();
  await expect(panel).toBeHidden();
}

async function analyticsDownloadClick(page, selector) {
  // Test the site's click listener without a download request to the registered
  // domain. WebKit downloads can bypass the local fixture route.
  await page.locator(selector).first().evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
  });
}

function pageViews(sent) {
  return sent.filter(item => !item.body.payload.name);
}

function events(sent, name) {
  return sent.filter(item => item.body.payload.name === name).map(item => item.body.payload.data);
}

// Timers use Playwright's clock. Focus/visibility are explicitly simulated only
// in timing tests, so they do not claim to validate native browser tab lifecycle.
// Section visibility itself uses the real page layout and scrolling.
async function simulatedAttentionState(page) {
  await page.addInitScript(() => {
    window.analyticsFixtureVisible = 'visible';
    window.analyticsFixtureFocused = true;
    Object.defineProperty(document, 'visibilityState', { get: () => window.analyticsFixtureVisible });
    Object.defineProperty(document, 'hasFocus', { value: () => window.analyticsFixtureFocused });
  });
}

async function controlledAttention(page) {
  await simulatedAttentionState(page);
  await page.clock.install({ time: new Date('2026-09-22T12:00:00Z') });
  // Freeze before navigation: pausing after an already-consented page loads
  // would legitimately run a first interval while advancing the clock.
  await page.clock.pauseAt(new Date('2026-09-22T12:00:10Z'));
}

async function freezeAfterLoad(page) {
  // The choices panel is created but stays detached until someone opens it.
  await expect(page.locator('#analytics-panel')).toHaveCount(0);
}

test('First visit starts aggregate statistics without enabling Umami', async ({ page, context }) => {
  const { sent, configReads, aggregates } = await virtualProduction(context);
  await page.goto(site);
  await freezeAfterLoad(page);
  expect(configReads).toHaveLength(1);
  expect(sent).toEqual([]);
  const invitation = page.locator('.analytics-invitation');
  await expect(invitation).toBeVisible();
  await expect.poll(() => aggregates.filter(r => r.body.counters.some(c => c.metric === 'page')).length).toBe(1);
  expect(aggregates[0].body).toEqual({ counters: [
    { metric: 'page', label: 'index.html' }, { metric: 'source', label: 'direct' },
    { metric: 'viewport', label: page.viewportSize().width < 600 ? 'small' : page.viewportSize().width < 1000 ? 'medium' : 'large' },
  ] });
  await expect(invitation.getByRole('button', { name: 'Turn analytics off', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.activeElement.closest('.analytics-invitation'))).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), choiceKey)).toBeNull();
  await invitation.getByRole('button', { name: 'Review choices', exact: true }).click();
  await expect(page.locator('#analytics-panel')).toBeVisible();
  expect(sent).toEqual([]);
  await page.locator('#analytics-panel').getByRole('button', { name: 'Close analytics choices' }).click();
  await expect(invitation.getByRole('button', { name: 'Review choices', exact: true })).toBeFocused();
  const panel = await choices(page);
  await expect(panel.getByRole('status')).toContainText('aggregate statistics only (the default)');
  await expect(panel.getByRole('button', { name: BASIC, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: BASIC, exact: true }).click();
  expect(sent).toEqual([]);
  expect(events(sent, 'Section reached')).toEqual([]);
});

test('An anchored first visit waits for presentation without moving the visitor', async ({ page, context }) => {
  const { sent, aggregates } = await virtualProduction(context);
  await page.goto(site + 'evidence.html#gaps');
  await expect(page.locator('#gaps')).toBeInViewport();
  await page.waitForTimeout(250);
  expect(aggregates).toEqual([]);
  expect(sent).toEqual([]);
  await page.locator('.analytics-invitation').scrollIntoViewIfNeeded();
  await expect.poll(() => aggregates.filter(r => r.body.counters.some(c => c.metric === 'page')).length).toBe(1);
  expect(sent).toEqual([]);
});

test('The aggregate default records reviewed interactions without Umami or identifiers', async ({ page, context }) => {
  const { sent, aggregates } = await virtualProduction(context);
  await controlledAttention(page);
  await page.goto(site + 'evidence.html');
  await expect.poll(() => aggregates.length).toBe(1);
  await page.locator('#gaps').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.clock.runFor(15_000);
  await expect.poll(() => aggregates.some(r => r.body.counters.some(c => c.metric === 'active' && c.label === '15'))).toBe(true);
  await analyticsDownloadClick(page, 'a[download][href="sources.csv"]');
  await expect.poll(() => aggregates.some(r => r.body.counters.some(c => c.metric === 'action' && c.label === 'Download clicked: source index'))).toBe(true);
  expect(sent).toEqual([]);
  const allowed = JSON.parse(readFileSync(path.join(root, 'analytics-backend/labels.json')));
  for (const r of aggregates) {
    expect(Object.keys(r.body)).toEqual(['counters']);
    for (const c of r.body.counters) {
      expect(Object.keys(c).sort()).toEqual(['label', 'metric']);
      expect(allowed[c.metric]).toContain(c.label);
    }
    for (const field of ['cookie', 'referer', 'authorization']) expect(r.headers).not.toHaveProperty(field);
  }
  expect(await page.evaluate(key => localStorage.getItem(key), choiceKey)).toBeNull();
});

for (const state of ['deny', 'dnt', 'gpc', 'storage']) {
  test(`Both collectors stay off for ${state}`, async ({ page, context }) => {
    const { sent, aggregates } = await virtualProduction(context);
    if (state === 'deny') await savedChoice(page, 'deny');
    else await page.addInitScript(state => {
      if (state === 'dnt') Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
      if (state === 'gpc') Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
      if (state === 'storage') Object.defineProperty(window, 'localStorage', { get: () => { throw new Error('fictional storage denial'); } });
    }, state);
    await page.goto(site);
    await page.waitForTimeout(250);
    expect(sent).toEqual([]); expect(aggregates).toEqual([]);
  });
}

test('Keeping first-visit analytics off persists across pages and can be changed through the footer', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await page.goto(site);
  await page.locator('.analytics-invitation').getByRole('button', { name: 'Turn analytics off', exact: true }).click();
  await expect(page.locator('.analytics-invitation')).toBeHidden();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).choice, choiceKey)).toBe('deny');
  await page.goto(site + 'faq.html');
  await expect(page.locator('.analytics-invitation')).toBeHidden();
  expect(sent).toEqual([]);
  const panel = await choices(page);
  await panel.getByRole('button', { name: BASIC, exact: true }).click();
  expect(sent).toEqual([]);
});

test('Slow configuration does not move a focused field or turn first-visit collection on', async ({ page, context }) => {
  let release;
  const configBarrier = new Promise(resolve => { release = resolve; });
  const { sent } = await virtualProduction(context, { configBarrier });
  await page.goto(site + 'letters.html');
  const invitation = page.locator('.analytics-invitation');
  await expect(invitation).toBeVisible();
  await expect(invitation.getByRole('button', { name: 'Review choices' })).toBeDisabled();
  await page.locator('#message').fill('Fictional letter typed before configuration loads');
  const before = await page.locator('#message').boundingBox();
  release();
  await expect(invitation.getByRole('button', { name: 'Review choices' })).toBeEnabled();
  await expect(page.locator('#message')).toBeFocused();
  expect(await page.locator('#message').boundingBox()).toEqual(before);
  expect(sent).toEqual([]);
});

for (const [setting, label] of [['allow', ALLOW], ['basic', BASIC], ['deny', OFF]]) {
  test(`First-visit prompt offers the ${setting} choice without enabling analytics on open`, async ({ page, context }) => {
    const { sent } = await virtualProduction(context);
    await page.goto(site);
    await page.locator('.analytics-invitation').getByRole('button', { name: 'Review choices' }).click();
    expect(sent).toEqual([]);
    const panel = page.locator('#analytics-panel');
    await panel.getByRole('button', { name: label, exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(page.locator('.analytics-invitation')).toBeHidden();
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).choice, choiceKey)).toBe(setting);
    if (setting === 'deny') expect(sent).toEqual([]);
    else if (setting === 'allow') await expect.poll(() => pageViews(sent).length).toBe(1);
    else expect(sent).toEqual([]);
  });
}

for (const width of [320, 390, 1440]) {
  test(`First-visit invitation preserves primary actions and typing at ${width}px`, async ({ page, context }) => {
    const { sent } = await virtualProduction(context);
    await page.setViewportSize({ width, height: width === 320 ? 568 : width === 390 ? 844 : 1000 });
    for (const appearance of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: appearance });
      for (const target of ['', 'videos.html', 'videos.html#upload', 'letters.html']) {
        await page.goto(site + target);
        await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('.analytics-invitation')))).toBe(true);
        const overlap = await page.evaluate(() => {
          const invite = document.querySelector('.analytics-invitation');
          if (invite.hidden) return false;
          const r = invite.getBoundingClientRect();
          return [...document.querySelectorAll('.button.primary, .parent-plan-spotlight a')].some(el => {
            if (!el.getClientRects().length) return false;
            const b = el.getBoundingClientRect();
            return b.bottom > r.top && b.top < r.bottom && b.right > r.left && b.left < r.right;
          });
        });
        expect(overlap, target + ' ' + appearance).toBe(false);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      const field = page.locator('#message');
      await field.fill('Fictional letter for invitation focus check');
      await expect(field).toBeFocused();
      await expect(page.locator('.analytics-invitation')).toBeVisible();
      await expect(field).toHaveValue('Fictional letter for invitation focus check');
      await page.goto(site);
      const shortcut = page.locator('.parent-plan-spotlight a');
      const box = await shortcut.boundingBox();
      expect(box.y + box.height).toBeLessThan(width === 320 ? 568 : width === 390 ? 844 : 1000);
    }
    expect(sent).toEqual([]);
  });
}

test('An old-origin objection and unfinished draft cannot transfer, so the new origin starts private', async ({ page, context }) => {
  await page.route('https://ystoneman.github.io/**', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Old origin fixture</title>',
  }));
  await page.goto('https://ystoneman.github.io/kew-riverside-website/');
  await page.evaluate(key => {
    localStorage.setItem(key, JSON.stringify({ v: 1, choice: 'deny', until: Date.now() + 86_400_000 }));
    localStorage.setItem('kr-letter-draft', JSON.stringify({ v: 1, text: 'Fictional unfinished letter', name: '', saved: Date.now() }));
  }, choiceKey);
  const { sent } = await virtualProduction(context);
  await page.goto(site + 'letters.html');
  await freezeAfterLoad(page);
  expect(sent).toEqual([]);
  await expect(page.locator('#message')).toHaveValue('');
  await expect(page.locator('#draft-notice')).toContainText('Drafts saved on the old website address cannot appear here');
  const panel = await choices(page);
  await expect(panel.getByRole('status')).toContainText('aggregate statistics only (the default)');
  await panel.getByRole('button', { name: 'Close analytics choices' }).click();
  const recovery = page.locator('#draft-notice').getByRole('link', { name: 'open the earlier GitHub letters page' });
  await expect(recovery).toHaveAttribute('href', 'https://ystoneman.github.io/kew-riverside-website/letters.html?recover=draft#letter-form');
  await recovery.click();
  await expect(page).toHaveURL('https://ystoneman.github.io/kew-riverside-website/letters.html?recover=draft#letter-form');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kr-letter-draft')).text)).toBe('Fictional unfinished letter');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).choice, choiceKey)).toBe('deny');
});

test('A previous custom-domain objection and unfinished draft cannot transfer, so the new origin starts private', async ({ page, context }) => {
  await page.route('https://savekewriverside.org/**', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Old origin fixture</title>',
  }));
  await page.goto('https://savekewriverside.org/');
  await page.evaluate(key => {
    localStorage.setItem(key, JSON.stringify({ v: 1, choice: 'deny', until: Date.now() + 86_400_000 }));
    localStorage.setItem('kr-letter-draft', JSON.stringify({ v: 1, text: 'Fictional unfinished letter', name: '', saved: Date.now() }));
  }, choiceKey);
  const { sent } = await virtualProduction(context);
  await page.goto(site + 'letters.html');
  await freezeAfterLoad(page);
  expect(sent).toEqual([]);
  await expect(page.locator('#message')).toHaveValue('');
  await expect(page.locator('#draft-notice')).toContainText('Drafts saved on the old website address cannot appear here');
  const panel = await choices(page);
  await expect(panel.getByRole('status')).toContainText('aggregate statistics only (the default)');
  await panel.getByRole('button', { name: 'Close analytics choices' }).click();
  const recovery = page.locator('#draft-notice').getByRole('link', { name: 'open the previous letters page' });
  await expect(recovery).toHaveAttribute('href', 'https://savekewriverside.org/letters.html?recover=draft#letter-form');
  await page.goto(site + 'privacy.html#device-storage');
  const storage = page.locator('#device-storage + p');
  await expect(storage.getByRole('link', { name: 'open the previous letters page' })).toHaveAttribute('href', 'https://savekewriverside.org/letters.html?recover=draft#letter-form');
  await expect(storage.getByRole('link', { name: 'open the earlier GitHub letters page' })).toHaveAttribute('href', 'https://ystoneman.github.io/kew-riverside-website/letters.html?recover=draft#letter-form');
  await storage.getByRole('link', { name: 'open the previous letters page' }).click();
  await expect(page).toHaveURL('https://savekewriverside.org/letters.html?recover=draft#letter-form');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kr-letter-draft')).text)).toBe('Fictional unfinished letter');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).choice, choiceKey)).toBe('deny');
});

test('An explicit detailed choice sends fixed events without a cookie', async ({ page, context }) => {
  const { sent, configReads } = await virtualProduction(context);
  await controlledAttention(page);
  await savedChoice(page);
  await page.goto(site);
  await freezeAfterLoad(page);
  await expect(page.locator('.analytics-invitation')).toBeHidden();
  await expect(page.locator('#analytics-panel')).toBeHidden();
  await expect.poll(() => sent.length).toBe(1);
  expect(configReads).toHaveLength(1);
  expect(sent[0].body).toEqual({ type: 'event', payload: {
    website: fakeConfig.websiteId, hostname: 'savekewriversideprimaryschool.org',
    url: prefix, title: 'Home & evidence', referrer: '',
  } });
  expect(sent[0].headers).not.toHaveProperty('cookie');
  expect(sent[0].headers).not.toHaveProperty('referer');
  expect(sent[0].headers).not.toHaveProperty('authorization');
  // Explicit detailed usage includes sections, active time and named actions.
  await page.locator('#find-your-way').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.clock.runFor(10_000);
  await expect.poll(() => events(sent, 'Section reached')).toContainEqual({ section: 'find-your-way' });
  await expect.poll(() => events(sent, 'Section viewed 10s')).toEqual([{ section: 'find-your-way' }]);
  for (let interval = 0; interval < 10; interval += 1) {
    await page.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
    await page.clock.runFor(30_000);
  }
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([15, 30, 60, 120, 300].map(seconds => ({ seconds })));
  await analyticsDownloadClick(page, 'a[download][href="response-checklist.pdf"]');
  await expect.poll(() => events(sent, 'Action opened')).toEqual([{ action: 'Download clicked: checklist' }]);
  expect(pageViews(sent)).toHaveLength(1);
  expect(JSON.parse(await page.evaluate(key => localStorage.getItem(key), choiceKey)).choice).toBe('allow');
  expect(await context.cookies()).toEqual([]);
  for (const request of sent) {
    expect(Object.keys(request.body.payload).sort()).toEqual(request.body.payload.name
      ? ['data', 'hostname', 'name', 'referrer', 'title', 'url', 'website'] : ['hostname', 'referrer', 'title', 'url', 'website']);
    expect(request.headers).not.toHaveProperty('cookie');
  }
  const panel = await choices(page);
  await expect(panel.getByRole('heading')).toBeFocused();
  await expect(panel.getByRole('status')).toContainText('aggregate statistics and detailed Umami usage.');
  await expect(panel.getByRole('button', { name: ALLOW, exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const name of [ALLOW, BASIC, OFF]) {
    const button = panel.getByRole('button', { name, exact: true });
    await expect(button).toBeEnabled();
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  const styles = await panel.locator('.analytics-actions button:not([aria-pressed="true"])').evaluateAll(buttons => buttons.map(button => {
    const style = getComputedStyle(button);
    return { color: style.color, background: style.backgroundColor, weight: style.fontWeight };
  }));
  expect(styles[0]).toEqual(styles[1]);
});

test('Turning analytics off survives reload; detailed usage can later be allowed and reduced to basic', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await page.goto(site);
  await freezeAfterLoad(page);
  await allowAnalytics(page);
  await expect.poll(() => sent.length).toBe(1);
  let panel = await choices(page);
  await panel.getByRole('button', { name: OFF, exact: true }).click();
  await expect(panel).toBeHidden();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).choice, choiceKey)).toBe('deny');
  await page.reload();
  await freezeAfterLoad(page);
  await page.clock.runFor(30_000);
  expect(sent).toHaveLength(1);
  panel = await choices(page);
  await expect(panel.getByRole('status')).toContainText('analytics off');
  await expect(panel.getByRole('button', { name: OFF, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: ALLOW, exact: true }).click();
  await expect.poll(() => pageViews(sent).length).toBe(2);
  await page.clock.runFor(15_000);
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([{ seconds: 15 }]);
  panel = await choices(page);
  await panel.getByRole('button', { name: BASIC, exact: true }).click();
  const atReduction = sent.length;
  await page.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
  await page.clock.runFor(300_000);
  expect(sent).toHaveLength(atReduction);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).choice, choiceKey)).toBe('basic');
});

test('Turning analytics off in one tab stops the other tab and updates its visible choice', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await page.goto(site);
  await freezeAfterLoad(page);
  await allowAnalytics(page);
  await expect.poll(() => sent.length).toBe(1);
  const other = await context.newPage();
  // Playwright's clock belongs to the entire context: do not reinstall it
  // while the first tab already has a running interval.
  await simulatedAttentionState(other);
  await other.goto(site + 'faq.html');
  await freezeAfterLoad(other);
  await expect.poll(() => sent.length).toBe(2);
  const firstPanel = await choices(page);
  await firstPanel.getByRole('button', { name: OFF, exact: true }).click();
  const otherPanel = await choices(other);
  await expect(otherPanel.getByRole('status')).toContainText('analytics off');
  await otherPanel.getByRole('button', { name: 'Close analytics choices' }).click();
  await other.clock.runFor(30_000);
  expect(sent).toHaveLength(2);
  await other.close();
});

for (const operation of ['getItem', 'setItem']) {
  test(`Analytics fails closed when localStorage.${operation} is unavailable`, async ({ page, context }) => {
    const { sent } = await virtualProduction(context);
    await page.addInitScript(method => {
      Storage.prototype[method] = () => { throw new DOMException('Fictional blocked storage', 'SecurityError'); };
    }, operation);
    await page.goto(site);
    const panel = await choices(page);
    // Neither missing storage nor a failed attempt to save can turn analytics on.
    const expected = 0;
    await expect.poll(() => sent.length).toBe(expected);
    if (operation === 'setItem') await panel.getByRole('button', { name: ALLOW, exact: true }).click();
    await expect(panel.getByRole('status')).toContainText('could not save a choice');
    for (const name of [ALLOW, BASIC, OFF]) await expect(panel.getByRole('button', { name, exact: true })).toBeDisabled();
    expect(sent).toHaveLength(expected);
  });
}

for (const signal of ['globalPrivacyControl', 'doNotTrack']) {
  test(`The ${signal} privacy signal blocks basic counts and an earlier allow choice`, async ({ page, context }) => {
    const { sent } = await virtualProduction(context);
    await savedChoice(page);
    await page.addInitScript(property => {
      Object.defineProperty(navigator, property, { value: property === 'doNotTrack' ? '1' : true });
    }, signal);
    await page.goto(site);
    const panel = await choices(page);
    await expect(panel.getByRole('status')).toContainText('privacy signal');
    await expect(page.locator('.analytics-invitation')).toBeHidden();
    await expect(panel.getByRole('button', { name: ALLOW, exact: true })).toBeDisabled();
    expect(sent).toEqual([]);
  });
}

test('An expired allow choice stops Umami and falls back to aggregate statistics', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await savedChoice(page, 'allow', 'past');
  await page.goto(site);
  await freezeAfterLoad(page);
  expect(sent).toEqual([]);
  await page.clock.runFor(15_000);
  expect(sent).toEqual([]);
  const panel = await choices(page);
  await expect(panel.getByRole('status')).toContainText('aggregate statistics only (the default)');
});

// Before 25 September 2026 detailed usage was opt-in. A saved basic-only choice
// (or a later one) must never widen to the new default.
test('A saved Basic counts only choice sends page views but no detailed usage', async ({ page, context }) => {
  const { sent, aggregates } = await virtualProduction(context);
  await controlledAttention(page);
  await savedChoice(page, 'basic');
  await page.goto(site + 'evidence.html');
  await freezeAfterLoad(page);
  await expect.poll(() => aggregates.filter(r => r.body.counters.some(c => c.metric === 'page')).length).toBe(1);
  expect(sent).toEqual([]);
  await page.locator('#gaps').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  for (let interval = 0; interval < 11; interval += 1) {
    await page.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
    await page.clock.runFor(30_000);
  }
  await analyticsDownloadClick(page, 'a[download][href="sources.csv"]');
  await page.reload();
  await freezeAfterLoad(page);
  await expect.poll(() => aggregates.filter(r => r.body.counters.some(c => c.metric === 'page')).length).toBe(2);
  await page.clock.runFor(30_000);
  expect(sent).toEqual([]);
  expect(aggregates.every(r => r.body.counters.every(c => c.metric === 'page'))).toBe(true);
  expect(sent.every(request => !request.body.payload.name)).toBe(true);
  const panel = await choices(page);
  await expect(panel.getByRole('status')).toContainText('page-open totals only (earlier choice)');
  await expect(panel.getByRole('button', { name: BASIC, exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('Detailed opt-in in another tab starts timing after permission', async ({ page, context }) => {
  const { sent, aggregates } = await virtualProduction(context);
  await controlledAttention(page);
  await page.goto(site);
  await expect.poll(() => aggregates.length).toBe(1);
  await page.clock.runFor(10_000);
  expect(sent).toEqual([]);
  const other = await context.newPage();
  await other.goto(site + 'about.html');
  await other.evaluate(key => localStorage.setItem(key,
    JSON.stringify({ v: 2, choice: 'allow', until: Date.now() + 86_400_000 })), choiceKey);
  await expect.poll(() => pageViews(sent).length).toBe(1);
  await page.clock.runFor(5_000);
  expect(events(sent, 'Active viewing')).toEqual([]);
  await page.clock.runFor(10_000);
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([{ seconds: 15 }]);
});

for (const state of ['disabled', 'invalid-id', 'unavailable']) {
  test(`Analytics stays disconnected with ${state} configuration`, async ({ page, context }) => {
    const config = state === 'disabled' ? { enabled: false, websiteId: fakeConfig.websiteId } : { enabled: true, counterEnabled: true, websiteId: 'not-a-provider-id' };
    const { sent } = await virtualProduction(context, { config, configFailure: state === 'unavailable' });
    await savedChoice(page);
    await page.goto(site);
    const panel = await choices(page);
    await expect(panel.getByRole('status')).toContainText('not connected');
    await expect(page.locator('.analytics-invitation')).toBeHidden();
    await expect(panel.getByRole('button', { name: ALLOW, exact: true })).toBeDisabled();
    expect(sent).toEqual([]);
  });
}

test('Query strings, individual anchors, incoming private routes and search words never enter analytics', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await savedChoice(page);
  const sources = [
    ['https://accounts.example.invalid/reset?token=' + sentinel, 'https://external.example/'],
    [site + 'letters.html?reply=' + sentinel + '#letter-' + sentinel, prefix + 'letters.html'],
    [site + 'feedback.html?kind=privacy&message=' + sentinel, ''],
    [site + 'corrections.html?email=' + sentinel, ''],
    [site + 'sent.html', ''],
    ['https://www.google.com/search?q=' + sentinel, 'https://www.google.com/'],
  ];
  for (const [index, [referer, expected]] of sources.entries()) {
    const count = sent.length;
    await page.goto(site + 'faq.html?fixture=' + index + '&email=' + sentinel + '#' + sentinel, { referer });
    await expect.poll(() => sent.length).toBe(count + 1);
    const payload = sent.at(-1).body.payload;
    expect(payload.url).toBe(prefix + 'faq.html');
    expect(payload.title).toBe('FAQ');
    expect(payload.referrer).toBe(expected);
  }
  await page.locator('input[type="search"]').fill(sentinel);
  await page.keyboard.press('Enter');
  await page.clock.runFor(15_000);
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([{ seconds: 15 }]);
  expect(JSON.stringify(sent)).not.toContain(sentinel);
  for (const request of sent) expect(request.headers).not.toHaveProperty('referer');
});

test('Typed letter content and a successful intercepted submission are never analytics completion events', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  const submissions = await captureSubmissions(page);
  await controlledAttention(page);
  await page.goto(site + 'letters.html?email=' + sentinel + '#letter-' + sentinel);
  await freezeAfterLoad(page);
  await allowAnalytics(page);
  await expect.poll(() => sent.length).toBe(1);
  await page.locator('#message').fill('An entirely fictional test letter: ' + sentinel);
  await revealLetterChoices(page);
  await page.locator('#display-name').fill(sentinel);
  await page.locator('#email').fill(sentinel + '@example.invalid');
  await page.locator('#letter-consent').check();
  await page.getByRole('button', { name: 'Send my letter', exact: true }).click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('message')).toContain(sentinel);
  expect(sent).toHaveLength(1);
  expect(JSON.stringify(sent)).not.toContain(sentinel);
  expect(events(sent, 'Action opened')).toEqual([]);
});

for (const file of ['feedback.html?kind=privacy', 'corrections.html']) {
  for (const saved of ['allow', null]) {
    test(`The entire private route ${file} stays unmeasured (${saved || 'default'} choice)`, async ({ page, context }) => {
      const { sent } = await virtualProduction(context);
      await controlledAttention(page);
      if (saved) await savedChoice(page, saved);
      await page.goto(site + file);
      await freezeAfterLoad(page);
      await expect(page.locator('.analytics-invitation')).toBeHidden();
      await page.locator('#message').fill('Fictional private request ' + sentinel);
      await page.clock.runFor(30_000);
      expect(sent).toEqual([]);
      const panel = await choices(page);
      await expect(panel.getByRole('status')).toContainText(file.startsWith('feedback') ? 'Share ideas page' : 'private request page');
      await expect(panel.locator('[aria-pressed="true"]')).toHaveCount(0);
      await panel.getByRole('button', { name: 'Close analytics choices' }).click();
      await page.getByRole('link', { name: 'FAQ', exact: true }).last().click();
      if (saved) {
        await expect.poll(() => sent.length).toBe(1);
        expect(sent[0].body.payload.referrer).toBe('');
      } else expect(sent).toEqual([]);
      expect(events(sent, 'Action opened')).toEqual([]);
      expect(JSON.stringify(sent)).not.toContain(sentinel);
    });
  }
}

for (const saved of ['allow', null]) {
  test(`The next-steps page sent.html stays unmeasured (${saved || 'default'} choice)`, async ({ page, context }) => {
    // It follows every form, including private requests, so a count would measure submissions.
    const { sent } = await virtualProduction(context);
    await controlledAttention(page);
    if (saved) await savedChoice(page, saved);
    await page.goto(site + 'sent.html');
    await freezeAfterLoad(page);
    await page.clock.runFor(30_000);
    expect(sent).toEqual([]);
    await page.getByRole('link', { name: 'FAQ', exact: true }).last().click();
    if (saved) {
      await expect.poll(() => sent.length).toBe(1);
      expect(sent[0].body.payload.url).toBe(prefix + 'faq.html');
      expect(sent[0].body.payload.referrer).toBe('');
    } else expect(sent).toEqual([]);
  });
}

test('Real visible sections distinguish reaching, ten seconds of viewing and active page thresholds', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await page.goto(site + 'lessons.html');
  await freezeAfterLoad(page);
  await allowAnalytics(page);
  await page.locator('#visual-guide').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.clock.runFor(9000);
  await expect.poll(() => events(sent, 'Section reached')).toContainEqual({ section: 'visual-guide' });
  expect(events(sent, 'Section viewed 10s')).toEqual([]);
  expect(events(sent, 'Active viewing')).toEqual([]);
  await page.clock.runFor(1000);
  await expect.poll(() => events(sent, 'Section viewed 10s')).toEqual([{ section: 'visual-guide' }]);
  await page.clock.runFor(5000);
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([{ seconds: 15 }]);
  await page.clock.runFor(15_000);
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([{ seconds: 15 }, { seconds: 30 }]);
  for (let interval = 0; interval < 9; interval += 1) {
    await page.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
    await page.clock.runFor(30_000);
  }
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([15, 30, 60, 120, 300].map(seconds => ({ seconds })));
  expect(events(sent, 'Section viewed 10s')).toHaveLength(1);
  expect(events(sent, 'Section reached').filter(event => event.section === 'visual-guide')).toHaveLength(1);
});

// Section IDs are fixed, reviewed labels. Each must still exist on its page, and
// a heading ID stands for its enclosing section, as in analytics.js.
test('Every configured analytics section exists on its public page', async ({ page, context }) => {
  await virtualProduction(context);
  const source = readFileSync(path.join(root, 'analytics.js'), 'utf8');
  const literal = source.match(/const SECTIONS = (\{[\s\S]*?\n  \});/)[1];
  const sections = new Function('return ' + literal)();
  expect(Object.keys(sections)).toEqual(expect.arrayContaining(['evidence.html', 'options.html', 'letters.html', 'index.html']));
  for (const [file, ids] of Object.entries(sections)) {
    await page.goto(site + file);
    const found = await page.evaluate(list => list.map(id => {
      const element = document.getElementById(id);
      const target = element && /^H[1-6]$/.test(element.tagName) ? element.closest('section') : element;
      return target && !target.closest('.legacy-route') ? id : null;
    }), ids);
    expect(found, file).toEqual(ids);
  }
});

test('Visitors choosing detailed analytics report Evidence and Options sections, including the nested source library', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await savedChoice(page);
  await page.goto(site + 'evidence.html');
  await freezeAfterLoad(page);
  // Scripts keep the library closed until a visitor opens it.
  await page.locator('#source-library > summary').click();
  await expect(page.locator('#source-library')).toHaveAttribute('open', '');
  await page.locator('#source-search').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.clock.runFor(1000);
  await expect.poll(() => events(sent, 'Section reached')).toContainEqual({ section: 'source-search' });
  for (const id of ['gaps', 'source-library']) {
    await page.locator('#' + id).evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
    await page.clock.runFor(11_000);
    await expect.poll(() => events(sent, 'Section reached')).toContainEqual({ section: id });
    await expect.poll(() => events(sent, 'Section viewed 10s')).toContainEqual({ section: id });
  }
  // Time in the library is its own, not its parent's key findings.
  expect(events(sent, 'Section viewed 10s')).not.toContainEqual({ section: 'records' });
  await page.goto(site + 'options.html');
  await freezeAfterLoad(page);
  await page.locator('#options-navigation').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
  await page.clock.runFor(11_000);
  await expect.poll(() => events(sent, 'Section viewed 10s')).toContainEqual({ section: 'options-navigation' });
  expect(pageViews(sent)).toHaveLength(2);
  expect(JSON.stringify(sent)).not.toMatch(/scrollY|innerText|query/);
});

test('Jumps within a page are not counted as opening it; links to another page are', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await savedChoice(page);
  await page.goto(site + 'proposal.html');
  await expect.poll(() => pageViews(sent).length).toBe(1);
  // Programmatic clicks exercise the collector's handler for links that may sit in closed menus.
  for (const selector of ['a[href="#timetable"]', 'a[href="#main"]', 'a[href="proposal.html#parent-plan"]']) {
    await page.locator(selector).first().evaluate(link => link.click());
  }
  await page.waitForTimeout(300);
  expect(events(sent, 'Action opened')).toEqual([]);
  await page.goto(site + 'lessons.html');
  await expect.poll(() => pageViews(sent).length).toBe(2);
  await page.locator('a.nav-parent-plan').first().evaluate(link => link.click());
  await expect(page).toHaveURL(site + 'proposal.html#parent-plan');
  await expect.poll(() => events(sent, 'Action opened')).toEqual([{ action: 'Opened Proposal & action plan' }]);
});

// The notice says section timing pauses in a form field but page viewing time does not.
test('Writing a letter pauses section timing but not active page time, and sends no typed words', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await savedChoice(page);
  await page.goto(site + 'letters.html');
  await freezeAfterLoad(page);
  await page.locator('#message').focus();
  await page.locator('#message').fill('An entirely fictional test letter: ' + sentinel);
  const reachedBefore = events(sent, 'Section reached').length;
  for (let interval = 0; interval < 11; interval += 1) {
    await page.keyboard.press('Space');
    await page.clock.runFor(30_000);
  }
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([15, 30, 60, 120, 300].map(seconds => ({ seconds })));
  expect(events(sent, 'Section viewed 10s')).toEqual([]);
  expect(events(sent, 'Section reached')).toHaveLength(reachedBefore);
  expect(JSON.stringify(sent)).not.toContain(sentinel);
});

test('At 320px, every analytics choice is visible when the panel opens', async ({ page, context }) => {
  await virtualProduction(context);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(site + 'evidence.html');
  const panel = await choices(page);
  for (const name of [ALLOW, BASIC, OFF]) await expect(panel.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('Hidden, unfocused, idle and open-choice time is excluded from active viewing', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await page.goto(site + 'lessons.html');
  await freezeAfterLoad(page);
  await allowAnalytics(page);
  await page.clock.runFor(5000);
  await page.evaluate(() => { window.analyticsFixtureVisible = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(120_000);
  expect(events(sent, 'Active viewing')).toEqual([]);
  await page.evaluate(() => { window.analyticsFixtureVisible = 'visible'; window.analyticsFixtureFocused = false; document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(30_000);
  expect(events(sent, 'Active viewing')).toEqual([]);
  await page.evaluate(() => { window.analyticsFixtureFocused = true; window.dispatchEvent(new Event('pointerdown')); });
  const panel = await choices(page);
  await page.clock.runFor(30_000);
  expect(events(sent, 'Active viewing')).toEqual([]);
  await panel.getByRole('button', { name: 'Close analytics choices' }).click();
  await page.clock.runFor(10_000);
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([{ seconds: 15 }]);
  await page.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
  await page.clock.runFor(180_000);
  const before = events(sent, 'Active viewing');
  expect(before).toEqual([{ seconds: 15 }, { seconds: 30 }, { seconds: 60 }]);
  await page.clock.runFor(120_000);
  expect(events(sent, 'Active viewing')).toEqual(before);
});

test('Search-hidden FAQ sections produce no reached or viewed event', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await page.goto(site + 'faq.html');
  await freezeAfterLoad(page);
  await allowAnalytics(page);
  await page.locator('#faq-query').fill('fictional-no-matching-answer-91284');
  await expect(page.locator('#faq-empty')).toBeVisible();
  for (const id of ['taking-part', 'decisions', 'money', 'school-places', 'learning']) {
    await expect(page.locator('#' + id)).toBeHidden();
  }
  await page.clock.runFor(15_000);
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([{ seconds: 15 }]);
  expect(events(sent, 'Section reached')).toEqual([]);
  expect(events(sent, 'Section viewed 10s')).toEqual([]);
});

test('A collector 503 leaves reading and revocation usable without retries', async ({ page, context }) => {
  const { sent } = await virtualProduction(context, { collectorFailure: true });
  await controlledAttention(page);
  await page.goto(site + 'lessons.html');
  await freezeAfterLoad(page);
  await allowAnalytics(page);
  await expect.poll(() => sent.length).toBe(1);
  await expect(page.locator('main')).toBeVisible();
  await page.clock.runFor(5000);
  expect(sent.filter(request => !request.body.payload.name)).toHaveLength(1);
  const bodies = sent.map(request => JSON.stringify(request.body));
  expect(new Set(bodies).size, 'A failed event is never retried').toBe(bodies.length);
  const panel = await choices(page);
  await panel.getByRole('button', { name: OFF, exact: true }).click();
  const atRevocation = sent.length;
  await page.clock.runFor(300_000);
  expect(sent).toHaveLength(atRevocation);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).choice, choiceKey)).toBe('deny');
});

test('A simulated back-forward-cache return sends a fresh page view and resets viewing thresholds', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await page.goto(site + 'lessons.html');
  await freezeAfterLoad(page);
  await allowAnalytics(page);
  await page.clock.runFor(15_000);
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([{ seconds: 15 }]);
  // This verifies the lifecycle handler, not whether a browser chooses BFCache.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  const beforeReturn = sent.length;
  await page.clock.runFor(30_000);
  expect(sent).toHaveLength(beforeReturn);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect.poll(() => sent.filter(request => !request.body.payload.name).length).toBe(2);
  await page.clock.runFor(14_000);
  expect(events(sent, 'Active viewing')).toEqual([{ seconds: 15 }]);
  await page.clock.runFor(1000);
  await expect.poll(() => events(sent, 'Active viewing')).toEqual([{ seconds: 15 }, { seconds: 15 }]);
});

test('An official-form handoff records a fixed opening label, never a completed response', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  const handoffs = [];
  await context.route(officialForm, async route => {
    handoffs.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fictional form destination</title><p>Locally intercepted. No council service contacted.</p>' });
  });
  await page.goto(site + 'letters.html');
  await allowAnalytics(page);
  await page.locator('.official-notice a').first().click();
  await expect.poll(() => handoffs.length).toBe(1);
  await expect.poll(() => events(sent, 'Action opened')).toEqual([{ action: 'Opened official response form' }]);
  expect(JSON.stringify(sent)).not.toMatch(/submitted|completed|conversion|email|message|display_name/i);
  expect(JSON.stringify(sent)).not.toContain(officialForm);
});

test('A checklist download records a fixed click label once per page, without claiming completion', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await page.goto(site);
  await freezeAfterLoad(page);
  await allowAnalytics(page);
  for (let click = 0; click < 2; click += 1) {
    expect(await page.locator('a[download][href="response-checklist.pdf"]').getAttribute('download')).toBe('kew-riverside-response-checklist.pdf');
    await analyticsDownloadClick(page, 'a[download][href="response-checklist.pdf"]');
  }
  await expect.poll(() => events(sent, 'Action opened')).toEqual([{ action: 'Download clicked: checklist' }]);
  expect(JSON.stringify(sent)).not.toMatch(/downloaded|completed/i);
});

test('Opening consent controls and private request links adds no action label', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await controlledAttention(page);
  await page.goto(site + 'letters.html');
  await freezeAfterLoad(page);
  await allowAnalytics(page);
  await expect.poll(() => sent.length).toBe(1);
  const panel = await choices(page);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.getByRole('link', { name: 'Analytics choices', exact: true })).toBeFocused();
  await page.locator('footer a[href="feedback.html"]').click();
  await expect(page).toHaveURL(site + 'feedback.html');
  expect(sent).toHaveLength(1);
  expect(events(sent, 'Action opened')).toEqual([]);
});

test('At 320px, the choices panel fits, keeps letter fields unobstructed and returns focus', async ({ page, context }) => {
  const { sent } = await virtualProduction(context);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(site + 'letters.html#letter-form');
  expect(sent).toEqual([]);
  // The choices and Send step follow a written letter.
  await page.locator('#message').fill('An entirely fictional test letter for the layout check.');
  await revealLetterChoices(page);
  // With no banner, nothing fixed covers a keyboard-focused form field.
  await page.locator('#email').focus();
  await expect(page.locator('#email')).toBeInViewport();
  expect(await page.locator('#email').evaluate(input => {
    const rect = input.getBoundingClientRect();
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === input;
  })).toBe(true);
  const panel = await choices(page);
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await panel.getByRole('button', { name: OFF, exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('link', { name: 'Analytics choices', exact: true })).toBeFocused();
  // No analytics ran before this explicit objection and none follows it.
  const atObjection = sent.length;
  await page.waitForTimeout(2500);
  expect(sent).toHaveLength(atObjection);
  expect(pageViews(sent)).toHaveLength(0);
});

test('On the privacy page at 320px, How analytics works closes the panel to reveal the explanation', async ({ page, context }) => {
  await virtualProduction(context);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(site + 'privacy.html');
  const panel = await choices(page);
  await panel.getByRole('link', { name: 'How analytics works', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(site + 'privacy.html#analytics');
  await expect(page.locator('#analytics h2')).toBeInViewport();
});

test('Both enabled collectors remain off on localhost', async ({ page }) => {
  const sent = [], aggregates = [];
  await page.route('**/analytics-config.json', route => route.fulfill({ json: fakeConfig }));
  await page.route(endpoint, async route => { sent.push(route.request().postData()); await route.fulfill({ json: {} }); });
  await page.route(counterEndpoint, async route => { aggregates.push(route.request().postData()); await route.fulfill({ json: { accepted: true } }); });
  await savedChoice(page);
  await page.goto('/index.html');
  const panel = await choices(page);
  await expect(panel.getByRole('button', { name: ALLOW, exact: true })).toBeEnabled();
  expect(sent).toEqual([]);
  expect(aggregates).toEqual([]);
});

test('Both enabled collectors remain off on a nested path of the production hostname', async ({ page, context }) => {
  const { sent, aggregates } = await virtualProduction(context, { prefix: '/unrelated-project/' });
  await savedChoice(page);
  await page.goto(origin + '/unrelated-project/index.html');
  const panel = await choices(page);
  await expect(panel.getByRole('button', { name: ALLOW, exact: true })).toBeEnabled();
  expect(sent).toEqual([]);
  expect(aggregates).toEqual([]);
});

test.describe('Analytics with JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });
  test('The website remains usable and analytics choices lead to the privacy explanation', async ({ page, context }) => {
    const { sent, configReads } = await virtualProduction(context);
    await page.goto(site);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('.analytics-invitation, #analytics-panel')).toHaveCount(0);
    await page.getByRole('link', { name: 'Analytics choices', exact: true }).click();
    await expect(page).toHaveURL(site + 'privacy.html#analytics');
    await expect(page.locator('#analytics')).toBeVisible();
    expect(configReads).toEqual([]);
    expect(sent).toEqual([]);
  });
});
