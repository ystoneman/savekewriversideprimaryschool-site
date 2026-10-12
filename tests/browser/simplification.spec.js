const { test, expect, expectScrollSettled } = require('./fixtures');
const council = 'https://www.richmond.gov.uk/services/children_and_family_care/schools_and_colleges/school_organisation_consultations/kew_riverside_consultation';
const official = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';

test('Full reading returns every optional disclosure to its prior state without changing form choices', async ({ page }) => {
  await page.goto('/feedback.html');
  const before = await page.locator('main details').evaluateAll(nodes => nodes.map(node => node.open));
  await page.getByLabel('Your message', { exact: true }).fill('A fictional public source for review.');
  const button = page.locator('[data-simple-toggle]');
  await button.click();
  await expect(page.locator('main details:not([open])')).toHaveCount(0);
  await expect(button).toHaveAccessibleName('Return to the short view');
  await button.click();
  expect(await page.locator('main details').evaluateAll(nodes => nodes.map(node => node.open))).toEqual(before);
  await expect(page.getByLabel('Your message', { exact: true })).toHaveValue('A fictional public source for review.');
  await expect(page.locator('main')).toBeFocused();
});

test('Closed guide topics remain discoverable through the section menu and repeated shared links', async ({ page }) => {
  await page.goto('/proposal.html');
  const menu = page.locator('.page-sections');
  await menu.locator('summary').click();
  const link = menu.locator('a[data-section-id="questions"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator('#proposal-question-details')).toHaveAttribute('open', '');
  await expect(page.locator('#questions')).toBeInViewport();
  await page.locator('#proposal-question-details > summary').click();
  await menu.locator('summary').click();
  await link.click();
  await expect(page.locator('#questions')).toBeInViewport();
  await expectScrollSettled(page, 'Repeated link opens optional questions');
});

test('Current official response actions retire at the London deadline even on deep arrivals', async ({ page }) => {
  await page.clock.setSystemTime(new Date('2026-10-16T22:59:59Z'));
  await page.goto('/proposal.html#take-part');
  const action = page.locator('#take-part [data-current-response]').first();
  await expect(action).toHaveAttribute('href', official);
  await page.clock.setSystemTime(new Date('2026-10-16T23:00:01Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect(action).toHaveAttribute('href', council);
  await expect(page.locator('#take-part [data-current-status]').first()).toBeVisible();
  await expect(page.locator('#take-part [data-current-status]').first()).toContainText('retained with its original dates');
  await expect(page.locator('#take-part [data-current-status]').first()).not.toContainText('was checked on 12 October');
});

test('An expired response activation preserves the Safari pressed target and reaches the current council route', async ({ page, hasTouch }) => {
  await page.clock.setSystemTime(new Date('2026-10-16T18:00:00Z'));
  await page.goto('/proposal.html#parent-plan');
  const action = page.locator('.parent-plan-respond a');
  await expect(action).toHaveAttribute('href', official);
  await page.clock.setSystemTime(new Date('2026-10-17T10:00:00Z'));
  await page.route(council, route => route.fulfill({contentType:'text/html',body:'<h1>Fictional current consultation information</h1>'}));
  if (hasTouch) await action.tap(); else await action.click();
  await expect(page).toHaveURL(council);
  await expect(page.getByRole('heading')).toHaveText('Fictional current consultation information');
});

test('Compact shared chrome retains exposed contribution routes and useful touch targets', async ({ page }) => {
  await page.setViewportSize({width:320,height:568});
  for (const file of ['proposal.html','about.html','privacy.html','evidence.html','letters.html']) {
    await page.goto('/'+file);
    for (const href of ['letters.html','feedback.html']) {
      const link = page.locator(`.participation-nav a[href="${href}"]`);
      await expect(link).toBeInViewport({ratio:1});
      expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('.mobile-menu summary')).toBeInViewport({ratio:1});
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
});
