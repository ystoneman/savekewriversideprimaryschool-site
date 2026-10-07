const { test, expect, pages, headerLinks, expectDestination } = require('./fixtures');

for (const file of pages) {
  test(`${file}: every desktop header destination works`, async ({ page, baseURL }) => {
    for (const href of headerLinks(file, 'desktop')) {
      await test.step(href, async () => {
        await page.goto('/' + file);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await page.locator(`.desktop-explore a[href="${href}"]`).click();
        await expectDestination(page, href, baseURL);
      });
    }
    for (const [href, label] of [['letters.html', 'Community letters'], ['feedback.html', 'Share ideas']]) {
      await page.goto('/' + file);
      const link = page.locator(`.participation-nav a[href="${href}"]`);
      await expect(link).toHaveAccessibleName(new RegExp(label));
      await expect(link.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      await link.click();
      await expectDestination(page, href, baseURL);
    }
  });

  test(`${file}: compact menu supports keyboard entry, exit and Escape`, async ({ page, baseURL, browserName }) => {
    // macOS WebKit uses Option+Tab to include links in keyboard navigation.
    const next = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
    await page.setViewportSize({ width: 800, height: 1000 });
    await page.goto('/' + file);
    const menu = page.locator('.mobile-menu');
    const summary = menu.locator('summary');
    const links = menu.locator('a');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('open', '');
    await page.keyboard.press(next);
    await expect(links.first()).toBeFocused();
    await expect(menu).toHaveAttribute('open', '');
    await page.keyboard.press(next);
    await expect(links.nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    await page.keyboard.press('Space');
    await expect(menu).toHaveAttribute('open', '');
    await page.keyboard.press('Shift+' + next);
    await expect(menu).not.toHaveAttribute('open', '');
    await summary.focus();
    await page.keyboard.press('Enter');
    // The menu now follows the participation links. Its next control is a section
    // summary or page content, depending on whether this page has local navigation.
    const followingControl = await menu.evaluateHandle(menu => [...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].find(node => {
      if (menu.contains(node) || !(menu.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) || node.tabIndex < 0 || node.matches(':disabled,[type="hidden"]')) return false;
      for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.hidden || getComputedStyle(ancestor).display === 'none' || getComputedStyle(ancestor).visibility === 'hidden') return false;
        if (ancestor.tagName === 'DETAILS' && !ancestor.open && !ancestor.querySelector(':scope > summary')?.contains(node)) return false;
      }
      return true;
    }));
    for (let i = 0; i <= await links.count(); i++) await page.keyboard.press(next);
    await expect(menu).not.toHaveAttribute('open', '');
    expect(await followingControl.evaluate(node => node === document.activeElement), 'Tab exits to the next available control after the menu').toBe(true);
    await summary.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press(next);
    await page.keyboard.press(next);
    const destination = await links.nth(1).getAttribute('href');
    await page.keyboard.press('Enter');
    await expectDestination(page, destination, baseURL);
  });
}

test('Menu closes when resized to desktop, then stays closed on return', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1000 });
  await page.goto('/feedback.html');
  await page.locator('.mobile-menu summary').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
  await expect(page.locator('.mobile-menu > summary')).toBeVisible();
  await expect(page.locator('.desktop-explore')).toBeVisible();
  await page.setViewportSize({ width: 800, height: 1000 });
  await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
});
