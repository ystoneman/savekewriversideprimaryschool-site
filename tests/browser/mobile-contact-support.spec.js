const { test, expect } = require('./fixtures');

for (const width of [320, 390]) {
  for (const appearance of ['light', 'dark']) {
    test(`About: identity and campaign contact precede optional background at ${width}px ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 568 });
      await page.emulateMedia({ colorScheme: appearance });
      await page.goto('/about.html');
      const intro = page.locator('main > .simple-intro');
      for (const words of ['Independent and parent-led', 'Yann Stoneman', 'Separate from the school, PTA and council', 'do not speak for every family']) await expect(intro).toContainText(words);
      const email = intro.getByRole('link', { name: 'Email the campaign', exact: true });
      await expect(email).toHaveAttribute('href', 'mailto:savekrps@gmail.com');
      const bounds = await email.boundingBox();
      expect(bounds.y + bounds.height).toBeLessThan(568);
      await expect(intro.getByRole('link', { name: 'For journalists', exact: true })).toHaveAttribute('href', '#press');
      await expect(page.locator('#about-responsibility-details')).not.toHaveAttribute('open', /.*/);
      await page.locator('#about-responsibility-details > summary').click();
      // Reworded by the 13 October 2026 slim-site decision: research pages are archived, so About no longer offers original sources.
      await expect(page.locator('#about-responsibility-details')).toContainText('It brings together the campaign to keep Kew Riverside Primary School open, the council’s own documents and community experiences.');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
    test(`Supporters: compact exact statement and scope stay before participation at ${width}px ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 568 });
      await page.emulateMedia({ colorScheme: appearance });
      await page.goto('/supporters.html');
      const statement = page.locator('.support-statement');
      await expect(statement).toHaveText('We support keeping Kew Riverside Primary School open.');
      expect(await statement.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(18);
      const scope = page.locator('.support-scope');
      await expect(scope).toContainText('Private confirmation and human approval before publication');
      await expect(scope).toContainText('Not a petition or an official consultation response');
      const add = page.getByRole('link', { name: 'Add my name', exact: true });
      const bounds = await add.boundingBox();
      expect((await scope.boundingBox()).y).toBeLessThan(bounds.y);
      expect(bounds.y + bounds.height).toBeLessThan(650);
      await expect(page.getByRole('link', { name: 'Read the supporter list' })).toHaveAttribute('href', '#supporter-list-section');
      await expect(page.locator('#supporter-scope-details')).not.toHaveAttribute('open', /.*/);
      await page.locator('#supporter-scope-details > summary').click();
      await expect(page.locator('#supporter-scope-details')).toContainText('does not mean you run this website, speak for all parents or agree with every part of the analysis');
      // 13 October 2026 slim-site decision: Add my name now reveals a pointer to the petition, not a request form.
      await add.click();
      await expect(page.locator('#supporter-form')).toBeVisible();
      await expect(page.locator('#supporter-form')).toBeInViewport();
      await expect(page.locator('#supporter-form a[href="get-involved.html#petition"]')).toBeVisible();
      await expect(page.locator('#supporter-form input[type="checkbox"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

// Removed by the 13 October 2026 slim-site decision: the supporter request form (and its compact submission check) was retired.
