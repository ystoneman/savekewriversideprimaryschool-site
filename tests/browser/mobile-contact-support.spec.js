const { test, expect, captureSubmissions } = require('./fixtures');

for (const width of [320, 390]) {
  for (const appearance of ['light', 'dark']) {
    test(`About: identity and campaign contact precede optional background at ${width}px ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 568 });
      await page.emulateMedia({ colorScheme: appearance });
      await page.goto('/about.html');
      const intro = page.locator('main > .simple-intro');
      for (const words of ['Independent and parent-led', 'Yann Stoneman', 'Separate from the school, PTA and council', 'do not speak for every family']) await expect(intro).toContainText(words);
      const email = intro.getByRole('link', { name: 'Email the campaign', exact: true });
      await expect(email).toHaveAttribute('href', 'mailto:pcfs2026@gmail.com');
      const bounds = await email.boundingBox();
      expect(bounds.y + bounds.height).toBeLessThan(568);
      await expect(intro.getByRole('link', { name: 'For journalists', exact: true })).toHaveAttribute('href', '#press');
      await expect(page.locator('#about-responsibility-details')).not.toHaveAttribute('open', /.*/);
      await page.locator('#about-responsibility-details > summary').click();
      await expect(page.locator('#about-responsibility-details')).toContainText('It brings together the case for keeping Kew Riverside Primary School open, community experiences and original sources.');
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
      await add.click();
      await expect(page.locator('#supporter-form')).toBeVisible();
      const choices = page.locator('#supporter-form input[type="checkbox"]');
      await expect(choices).toHaveCount(3);
      for (const choice of await choices.all()) await expect(choice).not.toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('Supporters: compact arrival keeps the exact statement version and independent confirmation consent', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/supporters.html#supporter-form');
  await page.locator('#public-name').fill('Fictional supporter');
  await page.locator('#supporter-email').fill('fictional@example.invalid');
  for (const checkbox of await page.locator('#supporter-form input[type="checkbox"]').all()) await checkbox.check();
  await page.locator('#supporter-form button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('statement_version')).toBe('keep-open-2026-09-21');
  expect(submissions[0].get('message')).toBe('We support keeping Kew Riverside Primary School open.');
  expect(submissions[0].get('allow_supporter')).toBe('yes-publish-name-and-statement-v1');
  expect(submissions[0].get('supporter_consent')).toBe('yes-process-support-request-v1');
  expect(submissions[0].get('adult_self')).toBe('yes-adult-own-support-v1');
});
