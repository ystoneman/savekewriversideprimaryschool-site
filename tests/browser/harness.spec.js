const http = require('node:http');
const { test, expect } = require('./fixtures');

// Properties of the test harness that the visitor-journey tests rely on.
const unroutedTest = test.extend({ routeRequests: [false, { option: true }] });

// A local stand-in for another origin, which records any request that reaches it.
// Its probe is reported by URL, whichever scheme the browser uses.
const probeRequest = url => expect.stringMatching(new RegExp(`^GET ${url.replace(/^http/, 'https?').replaceAll('.', '\\.')}$`));
async function otherOrigin(use) {
  const received = [];
  const server = http.createServer((request, response) => { received.push(request.url); response.end('Local stand-in'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await use(`http://127.0.0.1:${server.address().port}/guard-probe`, received);
  } finally {
    // WebKit preconnects to a navigation target even when the request is blocked.
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('Harness: pages and their resources load over HTTP/2, as on GitHub Pages', async ({ page }) => {
  await page.goto('/evidence.html');
  const protocols = await page.evaluate(() => [...new Set([...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map(entry => entry.nextHopProtocol))]);
  expect(protocols).toEqual(['h2']);
});

test('Harness: a request to another origin is reported and blocked before it is sent', async ({ page, networkGuard }) => {
  await otherOrigin(async (url, received) => {
    await page.goto(url, { timeout: 5_000 }).catch(() => {});
    expect(networkGuard).toEqual([probeRequest(url)]);
    expect(received, 'The other origin received nothing').toEqual([]);
    networkGuard.splice(0); // Deliberate probe, reported above.
  });
});

test('Harness: tests see an empty letters board instead of published letters', async ({ page }) => {
  await page.goto('/index.html');
  const board = await page.evaluate(() => fetch('letters.json', { cache: 'no-store' }).then(response => response.json()));
  expect(board).toEqual({ version: 1, letters: [] });
});

unroutedTest('Harness: without routing, other origins, local writes and the real letters board are still reported', async ({ page, networkGuard, baseURL }) => {
  await otherOrigin(async url => {
    await page.goto('/index.html');
    // HEAD keeps the published letters out of any failure trace.
    await page.evaluate(() => fetch('letters.json', { method: 'HEAD', cache: 'no-store' }));
    // Only the write is fulfilled locally, and the route is removed straight afterwards.
    await page.route('**/guard-write-probe', route => route.fulfill({ status: 204 }));
    await page.evaluate(() => fetch('guard-write-probe', { method: 'POST', body: 'Fictional' }));
    await page.unroute('**/guard-write-probe');
    await page.goto(url);
    expect(networkGuard).toHaveLength(3);
    expect(networkGuard).toEqual(expect.arrayContaining([`HEAD ${baseURL}/letters.json`, `POST ${baseURL}/guard-write-probe`, probeRequest(url)]));
    networkGuard.splice(0); // Deliberate probes, reported above.
  });
});
