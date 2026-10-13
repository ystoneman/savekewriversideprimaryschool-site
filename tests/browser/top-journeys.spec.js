const { test, expect, expectScrollSettled } = require('./fixtures');
const official = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';

// Top parent journeys (J2, J3): the official response stays on the first screen of
// common phones in Safari, with the Parent action plan still leading. The homepage
// hero gained this through spacing only; text sizes are unchanged. At 320 × 568 the
// Parent action plan keeps the first screen (see the existing J2 arrival checks).
for (const [width, height] of [[375, 667], [390, 844]]) {
  test(`Top journeys: ${width}×${height} homepage arrival shows Help and the response button`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/index.html');
    await expect(page.locator('.home-plan')).toBeInViewport({ ratio: 1 });
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

// J1/J3: the council's own timetable and documents are the first thing on arrival
// from the shared Menu entry, with the form's deadline ahead of the leaflet's
// broader "September/November" row and no sideways scrolling on small phones.
for (const [width, height] of [[320, 568], [390, 844]]) {
  test(`Top journeys: ${width}×${height} council dates and documents arrival shows the deadline and documents first`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/proposal.html#council-documents');
    await expectScrollSettled(page, 'Council documents arrival');
    const section = page.locator('#council-documents');
    await expect(section.locator('h2')).toBeInViewport({ ratio: 1 });
    await expect(section.locator('.council-deadline')).toContainText('All responses must be submitted by 16 October 2026');
    const respond = section.locator('.council-deadline a');
    await expect(respond).toHaveAttribute('href', official);
    await expect(respond).toBeInViewport({ ratio: 1 });
    await expect(section.locator('.council-document-list a').first()).toBeInViewport({ ratio: 1 });
    expect(await section.locator('.council-timetable tbody th').allTextContents()).toEqual([
      'Pre-statutory consultation (current)',
      'Review of outcomes from pre-statutory consultation and development of final proposals',
      'Education and Children’s Services Committee - approval to proceed to statutory consultation',
      'Publication of statutory notices',
      'Statutory representation period',
      'Review of outcomes from statutory consultation',
      'Education and Children’s Services Committee - Determination',
      'Implementation',
    ]);
    expect(await section.locator('.council-table-wrap, .decision-table-wrap').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    // Dates must stay readable: no month or year split across lines.
    const brokenWords = await section.locator('.council-timetable td').evaluateAll(cells => {
      const broken = [];
      for (const cell of cells) {
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          for (const match of node.data.matchAll(/[A-Za-z0-9]+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            if (range.getClientRects().length !== 1) broken.push(match[0]);
          }
        }
      }
      return broken;
    });
    expect(brokenWords).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

// The homepage Menu no longer carries a family-specific row (13 October 2026);
// the named route stays exposed on the Parent action plan, one Menu tap away.
test('Top journeys: a child’s school place is clearly named on the Parent action plan', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('.mobile-menu summary').click();
  await page.locator('.mobile-menu').getByRole('link', { name: 'Parent action plan', exact: true }).click();
  await expect(page).toHaveURL(/proposal\.html#parent-plan$/);
  const next = page.locator('#parent-plan a[href="faq.html#school-places"]').first();
  await expect(next).toHaveAccessibleName('My child’s next steps');
  await expect(next).toBeVisible();
  await next.click();
  await expect(page).toHaveURL(/faq\.html#school-places$/);
});
