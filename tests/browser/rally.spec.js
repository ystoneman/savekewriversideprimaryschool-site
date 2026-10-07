const { test, expect, expectStillArrival } = require('./fixtures');

test('Rally: map handoff selects the York House building rather than an address search', async ({ page, hasTouch }) => {
  // Richmond Council's York House directions identify this venue feature and
  // building coordinates. An address-only search can select Richmond Road.
  await page.goto('/rally.html#when-and-where');
  const map = page.getByRole('link', { name: 'Find York House on a map' });
  const destination = new URL(await map.getAttribute('href'));
  expect(destination.hostname).toBe('www.google.co.uk');
  expect(destination.pathname).toContain('/maps/place/York+House,');
  expect(destination.pathname).toContain('!1s0x48760c616adfa4c9:0x7c8748dc6e8c58b6');
  expect(destination.pathname).toContain('!3d51.447698!4d-0.324216');
  await expect(page.locator('#when-and-where')).toContainText('not a confirmed assembly point');
  const requests = [];
  await page.route('https://www.google.co.uk/maps/**', async route => {
    requests.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local map handoff fixture</title><h1>Venue handoff intercepted locally</h1>' });
  });
  if (hasTouch) await map.tap(); else await map.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Venue handoff intercepted locally');
  expect(requests).toEqual([destination.href]);
});

test('Rally: Parent plan entry leads to the schedule and returns without losing the plan', async ({ page, hasTouch }) => {
  await page.goto('/proposal.html#parent-plan');
  const link = page.locator('#parent-plan a[href="rally.html"]');
  await expect(link).toContainText('6–6.45pm');
  if (hasTouch) await link.tap(); else await link.click();
  await expect(page).toHaveURL(/rally\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rally at York House');
  await expect(page.locator('.rally-date')).toContainText('Tuesday 6 October 2026');
  await expect(page.locator('.rally-intro')).toContainText('awaiting confirmation');
  await page.goBack();
  await expect(page).toHaveURL(/proposal\.html#parent-plan$/);
  await expect(page.locator('#parent-plan')).toContainText('Respond to the council by 16 October 2026');
  await expect(page.locator('#prep-sessions')).toContainText('Past event');
  await expect(page.locator('#plan-attend')).toContainText('Follow up the 29 September meeting.');
  await page.locator('#plan-attend a[href="#school-meeting"]').click();
  await expect(page.locator('#school-meeting')).toContainText('PAST · 29 September');
  await expect(page.locator('#school-meeting')).toContainText('The advertised meeting date has passed.');
});

test('Rally: shared photo arrival preserves choice and formal response at narrow widths', async ({ page, hasTouch }) => {
  for (const width of [320, 390, 1101, 1250, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 568 });
    await page.goto('/rally.html');
    await expect(page.locator('.participation-label small').first()).toHaveCSS('display', 'block');
    if (width > 1100) {
      const brand = await page.locator('.brand').boundingBox();
      const navigation = await page.locator('.desktop-explore').boundingBox();
      expect(navigation.x).toBeGreaterThanOrEqual(brand.x + brand.width);
    }
    await page.screenshot({ path: test.info().outputPath('rally-arrival-' + width + '.png') });
    await page.goto('about:blank');
    await page.goto('/rally.html#photos');
    await expectStillArrival(page, '#photos');
    await expect(page.locator('#photos')).toContainText('does not give permission');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const menu = page.locator('.mobile-menu summary');
    if (hasTouch) await menu.tap(); else await menu.click();
    await expect(page.locator('.mobile-menu a[href="proposal.html#parent-plan"]')).toBeVisible();
    const parentPlan = page.locator('.mobile-menu a[href="proposal.html#parent-plan"]');
    if (hasTouch) await parentPlan.tap(); else await parentPlan.click();
    await expect(page).toHaveURL(/proposal\.html#parent-plan$/);
    await expect(page.locator('#parent-plan-title')).toBeInViewport();
  }
  await page.goto('/rally.html#council-and-response');
  await expect(page.locator('#council-and-response')).toContainText('Coming to the rally does not submit a consultation response');
  await expect(page.locator('#council-and-response')).toContainText('question-submission deadline for the 6 October Full Council meeting has passed');
  await expect(page.locator('#council-and-response a[href^="https://docs.google.com/forms/"]')).toBeVisible();
  await expect(page.locator('#updates a[href="about.html#contact"]')).toHaveCount(1);
});

test('Rally: calendar download uses London evening time and retains pending arrangements', async ({ page, request }) => {
  await page.goto('/rally.html');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Add the planned rally to your calendar' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('kew-riverside-primary-school-rally.ics');
  const response = await request.get('/rally-6-october.ics');
  expect(response.ok()).toBe(true);
  const body = (await response.text()).replace(/\r\n /g, '');
  expect(body).toContain('DTSTART:20261006T170000Z');
  expect(body).toContain('DTEND:20261006T174500Z');
  expect(body).toContain('STATUS:TENTATIVE');
  expect(body).toContain('access arrangements awaiting confirmation');
  expect(body).toContain('URL:https://savekewriversideprimaryschool.org/rally.html');
});
