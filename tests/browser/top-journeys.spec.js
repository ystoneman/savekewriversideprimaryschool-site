const { test, expect, expectScrollSettled } = require('./fixtures');
const official = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';

// Top parent journeys (J2, J3): the official response stays on the first screen of
// common phones in Safari, with the Parent action plan still leading. The homepage
// hero gained this through spacing only; text sizes are unchanged. At 320 × 568 the
// Parent action plan keeps the first screen (see the existing J2 arrival checks).
for (const [width, height] of [[375, 667], [390, 844]]) {
  test(`Top journeys: ${width}×${height} homepage arrival shows the Parent action plan and the response button`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/index.html');
    await expect(page.locator('.parent-plan-spotlight a')).toBeInViewport({ ratio: 1 });
    const respond = page.locator('#top .button.primary');
    await expect(respond).toHaveAttribute('href', official);
    await expect(respond).toBeInViewport({ ratio: 1 });
  });
}

// People reach the plan from the homepage spotlight and the Menu, arriving below the
// page's own deadline panel, so the plan carries its own response button.
for (const [width, height] of [[320, 568], [390, 844]]) {
  test(`Top journeys: ${width}×${height} Parent action plan arrival shows its title, response button and first action`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/proposal.html#parent-plan');
    await expectScrollSettled(page, 'Parent action plan arrival');
    await expect(page.locator('#parent-plan-title')).toBeInViewport({ ratio: 1 });
    const respond = page.locator('#parent-plan .parent-plan-respond a');
    await expect(respond).toHaveAttribute('href', official);
    await expect(respond).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.parent-plan-lead')).toContainText('Respond to the council by 16 October 2026');
    await expect(page.getByRole('navigation', { name: 'Choose a parent action' }).getByRole('link').first()).toBeInViewport({ ratio: 1 });
  });
}

test('Top journeys: a child\'s school place leads the six homepage routes', async ({ page }) => {
  await page.goto('/index.html');
  const first = page.locator('#find-your-way .route-card').first();
  await expect(first).toHaveAttribute('href', 'faq.html#school-places');
  await expect(first).toContainText('My child’s next steps');
});
