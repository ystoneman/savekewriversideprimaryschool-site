const { test, expect } = require('./fixtures');

for (const scripts of [true, false]) {
  test.describe(`Compact mobile header, scripts ${scripts}`, () => {
    test.use({ javaScriptEnabled: scripts });
    test('participation and page navigation stay exposed while page status remains reachable', async ({ page }) => {
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
        await page.goto('/evidence.html');
        const header = page.locator('.site-header');
        for (const href of ['letters.html', 'feedback.html']) {
          const action = header.locator(`.participation-nav a[href="${href}"]`);
          await expect(action).toBeInViewport({ ratio: 1 });
          expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44);
        }
        const chooser = page.locator('.page-sections > summary');
        await expect(chooser).toBeInViewport({ ratio: 1 });
        await expect(chooser).toContainText('On this page');
        await page.locator('.mobile-menu > summary').click();
        await expect(page.locator('.mobile-page-note')).toContainText('Source library updated 8 October 2026');
        await expect(page.locator('.mobile-page-note')).toBeVisible();
        await page.locator('.mobile-menu > summary').click();
        await chooser.click();
        await page.locator('.section-links a[href="#gaps"]').click();
        await expect(page).toHaveURL(/#gaps$/);
        await expect(page.locator('#gaps')).toBeVisible();
        if (scripts) await expect(page.locator('.page-sections')).not.toHaveAttribute('open', '');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    });
  });
}

test('mobile header leaves the short Share ideas heading and essential privacy meaning on arrival', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/feedback.html');
  await expect(page.locator('main h1')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.feedback-intro .invite-lead')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.feedback-intro')).toContainText('Nothing is published');
  await page.locator('.mobile-menu > summary').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
  await expect(page.locator('.mobile-menu > summary')).toBeFocused();
});
