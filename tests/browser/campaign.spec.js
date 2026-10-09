const { test, expect, expectScrollSettled } = require('./fixtures');

const site = 'https://savekewriversideprimaryschool.org/';
const campaign = 'Save Kew Riverside Primary School Campaign';
const first = { id: 'letter-aaaaaaaaaaaa', date: '2026-10-08', review: 'Human reviewed', displayName: 'Fictional writer', body: 'A fictional community letter about friendships and everyday school life.' };
const second = { ...first, id: 'letter-bbbbbbbbbbbb', displayName: 'Anonymous', date: '2026-10-07' };
const credit = item => `Community letter by ${item.displayName}, published ${item.date === '2026-10-08' ? '8' : '7'} October 2026 on ${campaign}, an independent parent-led website.\n${site}letters.html#${item.id}`;
async function feed(page, letters = [first, second]) {
  await page.route('**/letters.json', route => route.fulfill({ json: { version: 1, letters } }));
}

for (const width of [320, 390, 700, 701, 1100, 1101, 1440]) {
  for (const appearance of ['light', 'dark']) {
    test(`Campaign identity stays readable and participation remains exposed at ${width}px in ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      await page.emulateMedia({ colorScheme: appearance });
      await page.goto('/index.html');
      const label = page.locator('.campaign-subtitle strong');
      await expect(label).toHaveText('CAMPAIGN');
      await expect(label).toBeInViewport({ ratio: 1 });
      expect(await label.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
      for (const selector of ['.nav-letters', '.nav-contribute']) {
        await expect(page.locator('.participation-nav ' + selector)).toBeInViewport({ ratio: 1 });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width <= 390) await expect(page.locator('.parent-plan-spotlight a')).toBeInViewport({ ratio: 1 });
    });
  }
}

test('A direct long-letter arrival carries contributor and publisher together', async ({ page }) => {
  const letter = { ...first, body: 'Fictional complete paragraph. '.repeat(80) + 'Unique final fictional sentence.' };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/letters.json', async route => {
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({ json: { version: 1, letters: [letter] } });
  });
  await page.goto('/letters.html?utm_source=fictional#' + letter.id);
  const card = page.locator('#' + letter.id);
  await expect(card.locator('.letter-story')).toHaveAttribute('open', '');
  await expectScrollSettled(page, 'Direct letter with publisher');
  await expect(card.locator('.public-author')).toBeInViewport({ ratio: 1 });
  await expect(card.locator('.letter-source')).toBeInViewport({ ratio: 1 });
  await expect(card.locator('.letter-permalink')).toHaveAttribute('href', site + 'letters.html#' + letter.id);
  await expect(card.locator('.letter-permalink')).toHaveAccessibleName('savekewriversideprimaryschool.org — Permanent link to the letter by ' + letter.displayName);
  await expect(card.locator('.letter-source')).toContainText(campaign);
  await expect(card.locator('.suggestion-body')).toHaveText(letter.body);
});

test('Attribution copies the selected contributor, date and canonical URL without navigation', async ({ page }) => {
  await feed(page);
  await page.addInitScript(() => {
    window.copiedCredits = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => window.copiedCredits.push(text) } });
  });
  await page.goto('/letters.html?utm_source=fictional');
  const originalURL = page.url();
  const history = await page.evaluate(() => window.history.length);
  for (const item of [first, second]) {
    const card = page.locator('#' + item.id);
    const button = card.locator('.letter-copy');
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(card.locator('.letter-copy-status')).toHaveText('Attribution copied.');
    await expect(button).toBeFocused();
    await expect(card.locator('.letter-attribution-fallback')).toBeHidden();
  }
  expect(await page.evaluate(() => window.copiedCredits)).toEqual([credit(first), credit(second)]);
  expect(page.url()).toBe(originalURL);
  expect(await page.evaluate(() => window.history.length)).toBe(history);
});

for (const mode of ['absent', 'rejected']) {
  test(`Attribution has a usable manual-copy fallback when clipboard is ${mode}`, async ({ page }) => {
    await feed(page);
    await page.addInitScript(mode => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'absent' ? undefined : { writeText: async () => { throw new Error('Fictional clipboard rejection'); } } });
    }, mode);
    await page.goto('/letters.html#' + second.id);
    const card = page.locator('#' + second.id);
    await card.locator('.letter-copy').click();
    const field = card.locator('.letter-attribution-fallback');
    await expect(field).toBeVisible();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(credit(second));
    expect(await field.evaluate(el => el.readOnly)).toBe(true);
    expect(await field.evaluate(el => el.selectionEnd - el.selectionStart)).toBe(credit(second).length);
    await expect(card.locator('.letter-copy-status')).toContainText('Select and copy');
    await expect(card.locator('.letter-permalink')).toHaveAttribute('href', site + 'letters.html#' + second.id);
    await expect(page.locator('#' + first.id + ' .letter-attribution-fallback')).toBeHidden();
  });
}

test('An unavailable letter explains recovery after loading and retains no missing content', async ({ page }) => {
  await feed(page);
  await page.goto('/letters.html#letter-cccccccccccc');
  await expect(page.locator('#letter-unavailable')).toBeVisible();
  await expect(page.locator('#letter-cccccccccccc')).toHaveCount(0);
  await page.locator('#letter-unavailable a').click();
  await expect(page).toHaveURL(/letters\.html#letters$/);
  await expect(page.locator('#letter-unavailable')).toBeHidden();
  await expect(page.locator('#letters-list .public-author')).toHaveCount(2);
});

test('Printed letters retain publisher and complete URL with the full body once', async ({ page }) => {
  const letter = { ...first, body: 'Fictional long letter paragraph. '.repeat(80) + 'Unique ending for print.' };
  await feed(page, [letter]);
  await page.goto('/letters.html');
  const card = page.locator('#' + first.id);
  await expect(card.locator('.suggestion-body')).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  for (const open of [false, true]) {
    await card.locator('details').evaluate((el, open) => el.open = open, open);
    await expect(card.locator('.suggestion-body')).toBeHidden();
    await expect(card.locator('.letter-print-body')).toBeVisible();
    await expect(card.locator('.letter-print-body')).toHaveText(letter.body);
    await expect(card.locator('.letter-print-url')).toBeVisible();
    await expect(card.locator('.letter-print-url')).toHaveText(site + 'letters.html#' + letter.id);
    await expect(card.locator('.letter-source')).toContainText(campaign);
    for (const selector of ['.letter-excerpt', '.letter-copy', 'summary', '.letter-collapse', '.letter-removal']) await expect(card.locator(selector)).toBeHidden();
  }
});

test('Journalist guidance is linked from letters and About and provides a contact route', async ({ page }) => {
  await page.goto('/letters.html');
  await expect(page).toHaveTitle('Community letters | ' + campaign);
  await page.locator('.invite-lead a[href="about.html#press"]').click();
  await expect(page.locator('#press h2')).toBeInViewport();
  await expect(page.locator('#press')).toContainText('Yann Stoneman');
  await expect(page.locator('#press')).toContainText('displayed name');
  await expect(page.locator('#press')).toContainText('does not grant further reuse permission');
  await page.locator('#press a[href="#contact"]').click();
  await expect(page.locator('#contact > h2')).toBeInViewport();
  await page.locator('.page-sections summary').click();
  await expect(page.locator('.section-links a[href="#press"]')).toBeVisible();
});
