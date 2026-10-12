const { test, expect, expectScrollSettled } = require('./fixtures');

const letter = {
  id: 'letter-aaaaaaaaaaaa', displayName: 'Anonymous', date: '2026-10-12', review: 'Human reviewed',
  body: 'Fictional opening in the contributor’s own words. '.repeat(12) + '\n\nUnique fictional ending retained in full.',
};
const canonical = 'https://savekewriversideprimaryschool.org/letters.html#' + letter.id;
async function feed(page) {
  await page.route('**/letters.json', route => route.fulfill({ json: { version: 1, letters: [letter] } }));
}

for (const width of [320, 390]) {
  for (const appearance of ['light', 'dark']) {
    test(`Letter words precede compact source tools at ${width}px in ${appearance}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: appearance });
      await feed(page);
      await page.goto('/letters.html#letters');
      const card = page.locator('#' + letter.id);
      const excerpt = card.locator('.letter-excerpt');
      await expect(excerpt).toBeVisible();
      const text = await excerpt.textContent();
      expect(text.length).toBeLessThanOrEqual(181);
      expect(text.endsWith('…')).toBe(true);
      expect(letter.body.replace(/\s+/g, ' ').trim().startsWith(text.slice(0, -1))).toBe(true);
      const beforeSource = await excerpt.evaluate(el => Boolean(el.compareDocumentPosition(el.parentElement.querySelector('.letter-source')) & Node.DOCUMENT_POSITION_FOLLOWING));
      expect(beforeSource, 'Contributor excerpt comes before publication tools').toBe(true);
      await expect(card.locator('.public-author')).toHaveText('Anonymous');
      await expect(card.locator('.suggestion-meta')).toContainText('Human reviewed · Opinion');
      await expect(card.locator('time')).toHaveAttribute('datetime', letter.date);
      await expect(card.locator('.letter-source')).toContainText('Save Kew Riverside Primary School Campaign · Independent and parent-led');
      await expect(card.locator('.letter-permalink')).toHaveText('savekewriversideprimaryschool.org');
      await expect(card.locator('.letter-permalink')).toHaveAttribute('href', canonical);
      expect(await card.locator('.letter-source').evaluate(el => !el.closest('details'))).toBe(true);
      for (const selector of ['.letter-permalink', '.letter-copy', '.letter-story > summary', '.letter-removal']) {
        expect((await card.locator(selector).boundingBox()).height, selector + ' remains a touch target').toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const summary = card.locator('.letter-story > summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(card.locator('.suggestion-body')).toHaveText(letter.body);
      await expect(card.locator('.letter-source')).toBeVisible();
      await expect(excerpt).toBeHidden();
      await card.locator('.letter-collapse').click();
      await expect(summary).toBeFocused();
      await expect(excerpt).toBeVisible();
      await expect(card.locator('.letter-removal')).toHaveAttribute('href', 'feedback.html?kind=privacy&letter=' + letter.id + '#feedback-form');
    });
  }
}

test('Shared full letter keeps visible campaign identity and prints its complete unchanged body', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await feed(page);
  await page.goto('/letters.html#' + letter.id);
  const card = page.locator('#' + letter.id);
  await expect(card.locator('.letter-story')).toHaveAttribute('open', '');
  await expectScrollSettled(page, 'Mobile shared letter');
  await expect(card.locator('.public-author')).toBeInViewport({ ratio: 1 });
  await expect(card.locator('.letter-source')).toBeInViewport({ ratio: 1 });
  await expect(card.locator('.suggestion-body')).toHaveText(letter.body);
  await page.emulateMedia({ media: 'print' });
  await expect(card.locator('.letter-print-body')).toHaveText(letter.body);
  await expect(card.locator('.letter-print-body')).toBeVisible();
  await expect(card.locator('.letter-print-url')).toHaveText(canonical);
  await expect(card.locator('.letter-source p').first()).toHaveText('Published on Save Kew Riverside Primary School Campaign · Independent and parent-led');
  for (const selector of ['.letter-excerpt', '.letter-copy', '.letter-story']) await expect(card.locator(selector)).toBeHidden();
});
