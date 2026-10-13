const { test, expect } = require('./fixtures');

for (const scripts of [true, false]) {
  test.describe(`Compact mobile header, scripts ${scripts}`, () => {
    test.use({ javaScriptEnabled: scripts });
    test('Menu stays exposed while page status remains reachable, and archived pages say so', async ({ page }) => {
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
        await page.goto('/dates.html');
        // The header participation tiles and live pages' "On this page" chooser were retired by the 13 October 2026 slim-site decision.
        await expect(page.locator('.participation-nav, .page-sections')).toHaveCount(0);
        const summary = page.locator('.mobile-menu > summary');
        await expect(summary).toBeInViewport({ ratio: 1 });
        expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await expect(page.locator('main h1')).toBeInViewport({ ratio: 1 });
        // The dated status strip moves into the Menu on narrow screens.
        const status = (await page.locator('.independent-bar span').textContent()).trim();
        expect(status).not.toBe('');
        await summary.click();
        await expect(page.locator('.mobile-page-note')).toContainText(status);
        await expect(page.locator('.mobile-page-note')).toBeVisible();
        await summary.click();
        await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        // Archived pages keep their section chooser, show an Archived flag beside it and
        // drop the dated Menu status note (13 October 2026 slim-site decision).
        await page.goto('/evidence.html');
        await expect(page.locator('.site-orientation .archive-flag')).toBeInViewport({ ratio: 1 });
        await expect(page.locator('.mobile-menu > summary')).toBeInViewport({ ratio: 1 });
        const chooser = page.locator('.page-sections > summary');
        await expect(chooser).toBeInViewport({ ratio: 1 });
        await expect(chooser).toContainText('On this page');
        await expect(page.locator('.mobile-page-note')).toHaveCount(0);
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
