const { test, expect, allPages, pages, redirectPages } = require('./fixtures');

// Independently pin the intended school destination; changing the handoff needs
// a deliberate update here as well as the HTML, never a URL from visitor input.
const destination = 'https://www.kewriverside.richmond.sch.uk/page/?pid=525&title=Contact+Us';
async function interceptSchool(page) {
  await page.route(destination, route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Test school contact</title><main><h1>School contact intercepted locally</h1></main>',
  }));
}

for (const entry of ['/visit', '/visit/', '/visit/index.html', '/kew-riverside-website/visit', '/kew-riverside-website/visit/']) {
  test(`QR: ${entry} reaches the school and Back returns to the previous page`, async ({ page, baseURL }) => {
    await interceptSchool(page);
    await page.goto('/about.html');
    await page.goto(entry);
    await expect(page).toHaveURL(destination);
    await expect(page.getByRole('heading')).toHaveText('School contact intercepted locally');
    await page.goBack();
    await expect(page).toHaveURL(baseURL + '/about.html');
    await expect(page.locator('main')).toBeVisible();
  });
}

test('QR: incoming parameters and fragments cannot change or leak into the destination', async ({ page }) => {
  await interceptSchool(page);
  await page.goto('/visit/?url=https%3A%2F%2Fexample.invalid&email=fictional%40example.invalid#fictional');
  await expect(page).toHaveURL(destination);
});

test('QR: native fallback stays readable and usable if automatic refresh is disabled', async ({ page, hasTouch, browserName }) => {
  expect(redirectPages).toEqual(['visit/index.html']);
  expect([...pages, ...redirectPages].sort()).toEqual(allPages);
  await interceptSchool(page);
  await page.route('**/visit/', async route => {
    const response = await route.fetch();
    // Model a browser/accessibility preference that disables automatic refresh.
    const body = (await response.text()).replace(/<meta http-equiv="refresh"[^>]*>/, '');
    await route.fulfill({ response, body });
  });
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/visit/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const link = page.getByRole('link', { name: 'continue to the school’s contact page' });
    await expect(link).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(requests.every(url => url.endsWith('/visit/')), 'No scripts, analytics or third-party resources').toBe(true);
  const link = page.getByRole('link', { name: 'continue to the school’s contact page' });
  if (hasTouch) {
    await link.tap();
  } else {
    // macOS Safari's default keyboard setting reaches links with Option-Tab.
    await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await expect(page).toHaveURL(destination);
});

test('QR: nested server paths expose only public files', async ({ request }) => {
  for (const name of ['/README.md', '/.github/scripts/check_site.py', '/visit/%2e%2e%2fREADME.md']) {
    expect((await request.get(name)).status()).toBe(404);
  }
});

test('QR: earlier downloaded homepage and visit images remain public after the domain change', async ({ request }) => {
  for (const base of ['kew-riverside-website-qr', 'kew-riverside-visit-qr']) {
    for (const extension of ['png', 'svg']) {
      const response = await request.get(`/qr/${base}.${extension}`);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain(extension === 'png' ? 'image/png' : 'image/svg+xml');
    }
  }
});
