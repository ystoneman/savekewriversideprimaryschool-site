const { test, expect } = require('./fixtures');

test('Legal fund: Get involved entry preserves existing actions and Back', async ({ page }) => {
  await page.goto('/get-involved.html');
  const order = await page.locator('main > section').evaluateAll(nodes => nodes.map(n => n.id));
  expect(order.indexOf('parent-video')).toBe(order.indexOf('share-your-story') + 1);
  expect(order.indexOf('legal-fund')).toBe(order.indexOf('spread-the-word') + 1);
  expect(order.indexOf('school-contributions')).toBe(order.indexOf('legal-fund') + 1);
  expect(order.indexOf('help')).toBe(order.indexOf('respond') - 1);
  await page.locator('#legal-fund a').click();
  await expect(page).toHaveURL(/\/legal-fund.html$/);
  await expect(page.getByRole('heading', { name: 'Help fund independent legal advice' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/get-involved.html$/);
  await expect(page.locator('#legal-fund a')).toBeInViewport();
});

for (const theme of ['light', 'dark']) {
  test(`Legal fund: ${theme} small phone and enlarged content reflow`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/legal-fund.html');
    for (const enlarged of [false, true]) {
      if (enlarged) {
        await page.route('**/legal-fund.css*', async route => {
          const response = await route.fetch();
          await route.fulfill({ response, body: await response.text() + '\n.legal-fund { font-size:200%; } .legal-fund p,.legal-fund a,.legal-fund summary { font-size:inherit !important; }' });
        });
        await page.reload();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const card = page.locator('.fund-card');
      await expect(card).toBeVisible();
      expect(await card.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    }
  });
}

test('Legal fund: small-phone arrival offers a direct contribution action', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/legal-fund.html');
  const action = page.locator('.fund-primary');
  await expect(action).toBeInViewport({ ratio: 1 });
  await action.click();
  await expect(page).toHaveURL(/#contribute$/);
  await expect(page.getByRole('heading', { name: 'Contribute to the legal fund' })).toBeInViewport();
  const box = await page.locator('#give-title').boundingBox();
  const bar = await page.locator('.site-orientation').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height);
});

test('Legal fund: purpose and dated manual total remain readable without payment inputs', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/legal-fund.html');
  await expect(page.locator('.fund-total')).toBeVisible();
  await expect(page.locator('.fund-updated time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
  await expect(page.locator('.fund-story')).toContainText('The school’s closure is proposed, not decided.');
  await expect(page.locator('main form, main input, main iframe')).toHaveCount(0);
  expect(requests.filter(url => /paypal|revolut|gofundme/i.test(url))).toEqual([]);
});
