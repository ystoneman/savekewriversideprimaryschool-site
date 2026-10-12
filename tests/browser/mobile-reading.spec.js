const { test, expect } = require('./fixtures');

for (const width of [320, 390]) {
  for (const appearance of ['light', 'dark']) {
    test(`FAQ: essentials and search precede optional introduction at ${width}px ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: appearance });
      await page.goto('/faq.html');
      const intro = page.locator('.faq-compact-intro');
      await expect(intro).toContainText('No final closure decision.');
      await expect(intro).toContainText('1 September 2027, if approved.');
      await expect(intro).toContainText('16 October 2026');
      const search = page.locator('#faq-query');
      await expect(search).toBeInViewport({ ratio: 1 });
      const before = await intro.evaluate(el => Boolean(el.compareDocumentPosition(document.getElementById('faq-search')) & Node.DOCUMENT_POSITION_FOLLOWING));
      expect(before).toBe(true);
      await expect(page.locator('#faq-introduction')).not.toHaveAttribute('open', '');
      await search.fill('no matching fictional answer');
      await expect(page.locator('#faq-empty')).toBeVisible();
      await page.locator('#faq-clear').click();
      await expect(search).toBeFocused();
      await page.locator('.faq-topics a[href="#school-places"]').click();
      await expect(page.locator('#school-places')).toBeVisible();
      await page.locator('#faq-introduction > summary').click();
      await expect(page.locator('#faq-introduction')).toContainText('links to its sources or the website’s contribution rules');
      await expect(page.locator('#faq-introduction')).toContainText('Forecasts keep their dates and qualifications');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });

    test(`Evidence: search remains exposed while overlapping exploration links are optional at ${width}px ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: appearance });
      await page.goto('/evidence.html#records');
      await expect(page.locator('#record-search')).toBeVisible();
      await expect(page.locator('#record-search-help')).toContainText('not the full text of linked documents or every website answer');
      await expect(page.locator('#records > .simple-intro')).toContainText('delivery details remain unresolved');
      await expect(page.locator('#records > .simple-intro')).toContainText('A funded, viable alternative still needs establishing');
      await expect(page.locator('#evidence-library-guide')).not.toHaveAttribute('open', '');
      await expect(page.locator('#evidence-navigation')).toBeHidden();
      await expect(page.locator('.evidence-answer-links')).toBeHidden();
      await expect(page.locator('a[href="sources.csv"]')).toBeVisible();
      await expect(page.locator('#result-count')).toHaveText('61 of 61 records');
      await expect(page.locator('#research-count')).toHaveText('1 of 1 site research reports');
      await page.locator('#evidence-library-guide > summary').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#evidence-navigation')).toBeVisible();
      await expect(page.locator('.evidence-answer-links a')).toHaveCount(4);
      for (const link of await page.locator('.evidence-answer-links a').all()) await expect(link).toBeVisible();
      await expect(page.locator('#evidence-library-guide')).toContainText('61 sources; 57 reviewed, 2 index-only and 2 not retrieved');
      await page.goto('/evidence.html#research-shortcut');
      await expect(page.locator('#evidence-library-guide')).toHaveAttribute('open', '');
      await expect(page.locator('#research-shortcut')).toBeVisible();
      await page.locator('#research-shortcut').click();
      await expect(page.locator('#source-lessons-report')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('FAQ and Evidence retain complete introductory/exploration information without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 568 }, ignoreHTTPSErrors: true });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(baseURL + '/faq.html');
  await expect(page.locator('#faq-introduction')).toHaveAttribute('open', '');
  await expect(page.locator('#faq-introduction')).toContainText('what the published papers establish');
  await expect(page.locator('.faq-topics a')).toHaveCount(5);
  await page.goto(baseURL + '/evidence.html#research-shortcut');
  await expect(page.locator('#evidence-library-guide')).toHaveAttribute('open', '');
  await expect(page.locator('#evidence-navigation')).toBeVisible();
  await expect(page.locator('.evidence-answer-links a')).toHaveCount(4);
  await expect(page.locator('#source-library')).toHaveAttribute('open', '');
  await context.close();
});
