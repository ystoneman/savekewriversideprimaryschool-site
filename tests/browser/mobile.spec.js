const { test, expect, pages, headerLinks, expectDestination } = require('./fixtures');

for (const file of pages) {
  test(`${file}: every mobile menu destination responds to a touch`, async ({ page, baseURL }) => {
    for (const href of headerLinks(file, 'mobile')) {
      await test.step(href, async () => {
        await page.goto('/' + file);
        await page.locator('.mobile-menu summary').tap();
        await expect(page.locator('.mobile-menu')).toHaveAttribute('open', '');
        if (href.endsWith('.pdf')) {
          const [download] = await Promise.all([page.waitForEvent('download'),page.locator(`.mobile-menu a[href="${href}"]`).tap()]);
          expect(download.suggestedFilename()).toBe(href === 'response-checklist.pdf' ? 'kew-riverside-response-checklist.pdf' : href);expect(await download.failure()).toBeNull();
        } else {
          await page.locator(`.mobile-menu a[href="${href}"]`).tap();
          await expectDestination(page, href, baseURL);
        }
        await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
      });
    }
  });

  test(`${file}: clear participation actions work on touch`, async ({ page, baseURL }) => {
    for (const [href, label] of [['letters.html', 'Community letters'], ['feedback.html', 'Share ideas']]) {
      await page.goto('/' + file);
      if (file === 'index.html') await page.locator('.mobile-menu summary').click();
      const link = page.locator(`${file === 'index.html' ? '.mobile-menu' : '.participation-nav'} a[href="${href}"]`);
      await expect(link).toHaveAccessibleName(new RegExp(label));
      if (file !== 'index.html') await expect(link.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      await link.tap();
      await expectDestination(page, href, baseURL);
    }
  });

  test(`${file}: content and expanded menu fit narrow screens`, async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/' + file);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.locator('.mobile-menu summary').tap();
      const menu = await page.locator('.mobile-menu nav').boundingBox();
      expect(menu.x).toBeGreaterThanOrEqual(0);
      expect(menu.x + menu.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
  });
}

test('Share ideas: a focused menu summary must not swallow a following touch', async ({ page, baseURL }) => {
  await page.goto('/feedback.html');
  const summary = page.locator('.mobile-menu summary');
  await summary.tap();
  // Safari can focus the summary when it opens, then blur it with no relatedTarget
  // before dispatching a tap's click on a link. Keep this interaction covered.
  await summary.focus();
  await page.locator('.mobile-menu a[href="about.html"]').tap();
  await expectDestination(page, 'about.html', baseURL);
});

test('Share ideas: outside touch closes the menu', async ({ page }) => {
  await page.goto('/feedback.html');
  await page.locator('.mobile-menu summary').tap();
  await expect(page.locator('.mobile-menu')).toHaveAttribute('open', '');
  // Touch the empty header margin, outside the open Menu and its links.
  await page.locator('.site-header').tap({ position: { x: 4, y: 4 } });
  await expect(page).toHaveURL(/feedback\.html$/);
  await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
});
