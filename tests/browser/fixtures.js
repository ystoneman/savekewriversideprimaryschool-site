const { test: base, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
// Discover nested public pages too. Only explicit redirect routes use dedicated
// handoff/Back/no-JavaScript/fallback coverage in qr.spec.js instead of site menus.
const manifest = readFileSync(path.join(root, '.github/scripts/check_site.py'), 'utf8');
const publicFiles = manifest.match(/PUBLIC_FILES = frozenset\('''([\s\S]*?)'''\.split\(\)\)/)[1].trim().split(/\s+/);
const redirectPages = ['visit/index.html'];
const allPages = publicFiles.filter(name => name.endsWith('.html')).sort();
const pages = allPages.filter(name => !redirectPages.includes(name));
function headerLinks(file, selector) {
  const html = readFileSync(path.join(root, file), 'utf8');
  const className = selector === 'mobile' ? 'mobile-menu' : 'desktop-explore';
  const container = html.match(new RegExp(`<${selector === 'mobile' ? 'details' : 'nav'}\\b[^>]*class="[^"]*\\b${className}\\b[^\"]*"[^>]*>([\\s\\S]*?)</${selector === 'mobile' ? 'details' : 'nav'}>`));
  if (!container) throw new Error(`${file} has no ${selector} navigation; review its navigation coverage.`);
  const links = [...container[1].matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
  if (!links.length) throw new Error(`${file} has no ${selector} navigation links.`);
  return links;
}

// The analytics collector is the only other origin a page's policy allows. analytics.js
// contacts it only from the production host (analytics.spec.js), never from this server.
const productionOnly = { 'connect-src': ['https://gateway.umami.is/api/send'] };

// True when the page's policy, including the default that other fetch directives fall
// back to, lets it reach no other origin when served by this test harness.
function staysOnSite(file) {
  const policy = readFileSync(path.join(root, file), 'utf8').match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1]?.toLowerCase() || '';
  const sources = policy.split(';').map(directive => directive.trim().split(/\s+/)).filter(([name]) => /-src(?:-elem|-attr)?$/.test(name));
  return sources.some(([name]) => name === 'default-src') && sources.every(([name, ...allowed]) => allowed.every(source => ["'self'", "'none'", ...(productionOnly[name] || [])].includes(source)));
}

const test = base.extend({
  // Only journeys that submit no forms and follow no links to other origins may turn
  // routing off (the legacy-route tests); without routes nothing is aborted.
  routeRequests: [true, { option: true }],
  // An unexpected external request fails the test and, with routing, is aborted before
  // sending. Form tests install a more specific page route that returns a local fake response.
  networkGuard: [async ({ context, baseURL, routeRequests }, use) => {
    const unexpected = [];
    if (!routeRequests) {
      // In WebKit any route pauses every request until Playwright continues it, which keeps
      // more homepage requests in flight when a legacy link redirects. Cancelling them trips
      // a network-process defect that can lose the redirected navigation (TESTING.md).
      // Without routes nothing can abort a request: no page's policy may let it reach another
      // origin from this server, and the journey must not submit forms or leave the site.
      // Requests to other origins, local writes and the letters board are still reported.
      for (const file of pages) expect(staysOnSite(file), `${file} can reach no other origin from this server`).toBe(true);
      context.on('request', request => {
        const url = new URL(request.url());
        if (url.origin !== new URL(baseURL).origin || !['GET', 'HEAD'].includes(request.method()) || url.pathname === '/letters.json') unexpected.push(`${request.method()} ${request.url()}`);
      });
      await use(unexpected);
      expect(unexpected, 'No real submissions, analytics or other external traffic during tests').toEqual([]);
      return;
    }
    await context.route('**/*', async route => {
      const request = route.request();
      if (new URL(request.url()).origin === new URL(baseURL).origin && ['GET', 'HEAD'].includes(request.method())) {
        // Real published letters are not test fixtures or screenshot content.
        // Board journeys supply their own fictional page-level fixtures.
        if (new URL(request.url()).pathname === '/letters.json') {
          await route.fulfill({ json: { version: 1, letters: [] } });
        } else {
          await route.continue();
        }
      } else {
        unexpected.push(`${request.method()} ${request.url()}`);
        await route.abort('blockedbyclient');
      }
    });
    // The harness checks inspect, then clear, requests they make deliberately.
    await use(unexpected);
    expect(unexpected, 'No real submissions, analytics or other external traffic during tests').toEqual([]);
  }, { auto: true }],
  browserErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && response.headers()['x-test-fixture'] !== 'intentional-error') errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    page.on('requestfailed', request => {
      const message = request.failure()?.errorText || 'Request failed';
      // Navigation may cancel an in-flight read. Documents also use a cancellation
      // when a download starts; neither is a missing runtime dependency.
      if (['script', 'stylesheet', 'image', 'fetch', 'xhr'].includes(request.resourceType()) && !/aborted|cancelled|canceled/i.test(message)) errors.push(`${message}: ${request.url()}`);
    });
    await use();
    expect(errors, 'No uncaught browser JavaScript errors').toEqual([]);
  }, { auto: true }],
});

async function expectDestination(page, href, baseURL) {
  const expected = new URL(href, baseURL + new URL(page.url()).pathname);
  await expect(page).toHaveURL(expected.href);
  await expect(page.locator('main')).toBeVisible();
  if (expected.hash) {
    const target = page.locator(expected.hash);
    await expect(target).toBeVisible();
    await expect(target).toBeInViewport();
  }
}

// Where scripts can run, sample the scroll position for 600 ms: a page that is
// still animating can move a link or summary beneath an immediate click or tap.
async function expectScrollSettled(page, label) {
  // Page timers never run without JavaScript; the current position is then final.
  if (test.info().project.use.javaScriptEnabled === false) return;
  const positions = await page.evaluate(async () => {
    const seen = new Set([Math.round(scrollY)]);
    for (const start = performance.now(); performance.now() - start < 600;) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      seen.add(Math.round(scrollY));
    }
    return seen.size;
  });
  expect(positions, `${label} does not keep scrolling`).toBe(1);
}

// A shared fragment must already be in view when the page loads and stay still.
async function expectStillArrival(page, selector) {
  const arrival = await page.evaluate(selector => ({ top: document.querySelector(selector).getBoundingClientRect().top, viewport: innerHeight }), selector);
  expect(arrival.top, `${selector} is in view on arrival`).toBeGreaterThanOrEqual(0);
  expect(arrival.top, `${selector} is in view on arrival`).toBeLessThan(arrival.viewport / 2);
  await expectScrollSettled(page, `${selector} arrival`);
}

async function captureSubmissions(page) {
  const submissions = [];
  await page.route('https://formspree.io/**', async route => {
    const request = route.request();
    expect(request.url()).toBe('https://formspree.io/f/xnpnenzy');
    expect(request.method()).toBe('POST');
    submissions.push(new URLSearchParams(request.postData() || ''));
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Test capture only</title><p>Submission intercepted locally. Nothing was sent.</p>' });
  });
  return submissions;
}

// Share ideas categories are visible radio cards; funding and privacy sit under "More options".
async function chooseKind(page, value) {
  const radio = page.locator(`input[name="kind"][value="${value}"]`);
  const more = page.locator('#kind-more');
  if (['crowdfunding', 'privacy'].includes(value) && await more.getAttribute('open') === null) {
    await more.locator(':scope > summary').click();
  }
  await radio.check();
}

// The letters form asks for the words first; where scripts run, "Next" reveals the choices and Send.
async function revealLetterChoices(page) {
  const next = page.locator('#to-choices');
  if (await next.isVisible()) await next.click();
  await expect(page.locator('#letter-consent')).toBeVisible();
}

module.exports = { test, expect, pages, allPages, redirectPages, headerLinks, expectDestination, expectScrollSettled, expectStillArrival, captureSubmissions, chooseKind, revealLetterChoices };
