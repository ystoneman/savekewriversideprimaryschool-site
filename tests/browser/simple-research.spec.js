const { test, expect } = require('./fixtures');

const compactPages = [
  ['evidence.html', '#evidence-kew-detail', 550],
  ['lessons.html', '#research-takeaways', 250],
  ['lessons-sources.html', '#citation-sources', 240],
  ['understand.html', '#campaign-case-detail', 150],
];

test('Short research entries expose the next task while keeping complete material available', async ({ page }) => {
  for (const [file, detail, wordBudget] of compactPages) {
    await page.goto('/' + file);
    await expect(page.locator(detail)).not.toHaveAttribute('open', '');
    const words = (await page.locator('main').innerText()).trim().split(/\s+/).length;
    expect(words, `${file} keeps its ordinary reading layer concise`).toBeLessThan(wordBudget);
    await expect(page.locator('main [data-simple-toggle]')).toBeVisible();
    await page.locator('main [data-simple-toggle]').click();
    await expect(page.locator('main details:not([open])')).toHaveCount(0);
    expect((await page.locator('main').innerText()).trim().split(/\s+/).length).toBeGreaterThan(words);
  }
});

test('Evidence retains qualified current findings and immediate source search', async ({ page }) => {
  await page.goto('/evidence.html#records');
  const entry = page.locator('#records > .simple-intro');
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('does not establish the saving from closure');
  await expect(entry).toContainText('if closure proceeds');
  await expect(entry).toContainText('A funded, viable alternative still needs establishing');
  await expect(page.getByLabel('Search source records and research reports')).toBeVisible();
  await expect(page.locator('#evidence-kew-detail')).not.toHaveAttribute('open', '');
  await page.locator('#records > .simple-intro a[href="#kew-findings"]').click();
  await expect(page.locator('#evidence-kew-detail')).toHaveAttribute('open', '');
  await expect(page.locator('#kew-finance')).toContainText('assumptions, ledger and current monitoring');
  await page.locator('#kew-finance a[href="#source-kew-budget-summary-2026"]').click();
  await expect(page.locator('#source-kew-budget-summary-2026')).toBeInViewport();
});

test('Direct research and citation targets open their full context without a second reveal', async ({ page }) => {
  for (const [url, parent, content] of [
    ['/evidence.html#finding-pooles', '#evidence-london-detail', '#finding-pooles .finding-source'],
    ['/lessons.html#case-broad-oak', '#research-cases', '#case-broad-oak .lesson-case-body'],
    ['/lessons.html#exhibit-4', '#research-graphics', '#exhibit-4 img'],
    ['/lessons-sources.html#S01', '#citation-sources', '#S01 .lesson-full-url'],
    ['/lessons-sources.html#X04', '#citation-claims', '#X04 > div'],
  ]) {
    await page.goto(url);
    await expect(page.locator(parent)).toHaveAttribute('open', '');
    await expect(page.locator(content)).toBeVisible();
  }
});

test('Citation search finds full locators, recovers empty results and reveals filtered direct links', async ({ page }) => {
  await page.goto('/lessons-sources.html');
  const search = page.getByLabel('Find a source or claim');
  await search.fill('Sections 3.10');
  await expect(page.locator('#S01')).toBeVisible();
  await expect(page.locator('.lesson-source:not([hidden])')).toHaveCount(1);
  await expect(page.locator('#citation-S01')).not.toHaveAttribute('open', '');
  await search.fill('fictional-unmatchable-reference');
  await expect(page.locator('#citation-empty')).toBeVisible();
  await expect(page.locator('.lesson-source:not([hidden]), .lesson-claim:not([hidden])')).toHaveCount(0);
  await page.locator('.lesson-source-index a[href="#S01"]').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('#S01 .lesson-full-url')).toBeVisible();
  await expect(page.locator('#S01')).toBeInViewport();
  await search.fill('Sections 3.10');
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(page.locator('.lesson-source:not([hidden])')).toHaveCount(45);
  await expect(page.locator('.lesson-claim:not([hidden])')).toHaveCount(49);
});

test('Full research printing restores the reader’s prior disclosure choices', async ({ page }) => {
  await page.goto('/understand.html#budget-forecast');
  const before = await page.locator('main details').evaluateAll(nodes => nodes.map(node => node.open));
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('main details:not([open])')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  expect(await page.locator('main details').evaluateAll(nodes => nodes.map(node => node.open))).toEqual(before);
  await expect(page.locator('#budget-forecast table')).toBeVisible();
  await expect(page.locator('#campaign-case-detail')).not.toHaveAttribute('open', '');
});

test.describe('Complete research with JavaScript unavailable', () => {
  test.use({ javaScriptEnabled: false });
  test('the new reading wrappers retain every original source and answer', async ({ page }) => {
    for (const [file] of compactPages) {
      await page.goto('/' + file);
      await expect(page.locator('main details[data-simple-detail]:not([open])')).toHaveCount(0);
    }
    await page.goto('/lessons-sources.html#S01');
    await expect(page.locator('#S01 .lesson-full-url')).toBeVisible();
    await expect(page.locator('#citation-search-controls')).toBeHidden();
    await page.goto('/evidence.html#kew-findings');
    await expect(page.locator('#kew-finance')).toBeVisible();
  });
});
