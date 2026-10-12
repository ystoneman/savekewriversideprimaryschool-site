const { test, expect, captureSubmissions, chooseKind } = require('./fixtures');

for (const width of [320, 390]) {
  for (const appearance of ['light', 'dark']) {
    test(`Share ideas: compact ${width}px ${appearance} arrival reaches the message before optional reading`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: appearance });
      await page.clock.setFixedTime(new Date('2026-10-12T12:00:00+01:00'));
      await page.goto('/feedback.html');
      await expect(page.getByRole('heading', { name: 'Share ideas', exact: true })).toBeVisible();
      await expect(page.locator('.feedback-intro .invite-lead')).toContainText('Nothing is published unless you choose. No donations.');
      const official = page.locator('#ideas-official-open');
      await expect(official).toContainText('16 October 2026');
      await expect(page.locator('.feedback-intro .ideas-read-link')).toBeVisible();
      const message = await page.locator('#message').boundingBox();
      const council = await official.boundingBox();
      expect(council.y).toBeLessThan(message.y);
      expect(message.y).toBeLessThan(900); // Previously beyond 1,200px on smaller phones.
      const cards = page.locator('#kind-cards > .kind-grid > .kind-card');
      await expect(cards).toHaveCount(4);
      for (const card of await cards.all()) {
        const bounds = await card.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeLessThan(135);
        await expect(card.locator('small')).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('#ideas-introduction')).not.toHaveAttribute('open', /.*/);
      const intro = await page.locator('#ideas-introduction').boundingBox();
      expect(intro.y).toBeGreaterThan(message.y + message.height);
      await page.locator('#ideas-introduction > summary').click();
      await expect(page.locator('#ideas-introduction')).toContainText('A sentence is fine.');
      await expect(page.locator('#ideas-introduction')).toContainText('This is not a donation form.');
    });
  }
}

test('Share ideas: compact category labels select native radios and private kinds clear publication permission', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/feedback.html');
  await page.locator('label.kind-card').filter({ has: page.locator('input[value="evidence"]') }).click();
  await expect(page.locator('input[value="evidence"]')).toBeChecked();
  await expect(page.locator('#kind-help')).toContainText('what the source shows');
  await page.locator('#publication-options > summary').click();
  await page.locator('#allow-public').check();
  for (const kind of ['privacy', 'crowdfunding']) {
    await chooseKind(page, kind);
    await expect(page.locator('#allow-public')).not.toBeChecked();
    await expect(page.locator('#allow-public')).toBeDisabled();
    await expect(page.locator('#publication-options')).toBeHidden();
    await expect(page.locator('#privacy-only')).toBeVisible();
  }
  await expect(page.locator('#funding-context')).toContainText('no financial pledge or commitment');
  await chooseKind(page, 'suggestion');
  await expect(page.locator('#allow-public')).not.toBeChecked();
  await expect(page.locator('#publication-options')).toBeVisible();
});

test('Share ideas: simplified arrival retains contextual direct categories, values and required message', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const submissions = await captureSubmissions(page);
  await page.goto('/feedback.html?kind=privacy&letter=letter-aaaaaaaaaaaa#feedback-form');
  await expect(page.locator('input[value="privacy"]')).toBeChecked();
  await expect(page.locator('#message')).toHaveValue(/letter-aaaaaaaaaaaa/);
  await expect(page.locator('#kind-more')).toHaveAttribute('open', '');
  await expect(page.locator('#publication-options')).toBeHidden();
  await page.locator('#message').fill('short');
  await page.locator('button[type="submit"]').click();
  expect(submissions).toHaveLength(0);
  await page.locator('#message').fill('A fictional request to remove a test-only reference.');
  await page.locator('button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('kind')).toBe('privacy');
  expect(submissions[0].get('notice_version')).toBe('2026-09-22-v3');
  expect(submissions[0].has('allow_public')).toBe(false);
  expect(submissions[0].get('email')).toBe('');
  expect(submissions[0].get('source')).toBe('');
});

test('Share ideas: without scripts all original guidance and native category choices remain usable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 568 }, ignoreHTTPSErrors: true });
  const unexpected = [];
  await context.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).origin === new URL(baseURL).origin && ['GET', 'HEAD'].includes(request.method())) return route.continue();
    unexpected.push(request.url());
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto(baseURL + '/feedback.html');
  await expect(page.locator('#ideas-introduction')).toHaveAttribute('open', '');
  await expect(page.locator('#ideas-introduction')).toContainText('A sentence is fine.');
  await expect(page.locator('#kind-more')).toHaveAttribute('open', '');
  for (const kind of ['suggestion', 'evidence', 'meeting', 'correction', 'crowdfunding', 'privacy']) {
    const radio = page.locator(`input[name="kind"][value="${kind}"]`);
    await radio.check();
    await expect(radio).toBeChecked();
  }
  await expect(page.locator('#feedback-form noscript')).toContainText('Funding ideas and privacy requests stay private', { useInnerText: true });
  await expect(page.locator('#message')).toHaveAttribute('required', '');
  await expect(page.locator('#allow-public')).not.toBeChecked();
  await expect(page.locator('#privacy-route-help')).toBeVisible();
  await context.close();
  expect(unexpected).toEqual([]);
});
