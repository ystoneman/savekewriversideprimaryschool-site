const { test, expect, captureSubmissions } = require('./fixtures');

test('Short letters: medium letters preview briefly but retain their complete text and shared arrival', async ({ page }) => {
  const body = 'A fictional community letter about everyday school life. '.repeat(8) + 'UNIQUE FINAL WORDS';
  const id = 'letter-aaaaaaaaaaaa';
  await page.route('**/letters.json', route => route.fulfill({ json: { version: 1, letters: [{ id, date: '2026-10-12', review: 'Human reviewed', displayName: 'Fictional contributor', body }] } }));
  await page.goto('/letters.html');
  const article = page.locator('#' + id);
  await expect(article.locator('.letter-excerpt')).toBeVisible();
  expect((await article.locator('.letter-excerpt').textContent()).length).toBeLessThan(310);
  await expect(article.locator('.letter-story .suggestion-body')).toBeHidden();
  await article.locator('.letter-story > summary').click();
  await expect(article.locator('.letter-story .suggestion-body')).toHaveText(body);
  await page.goto('/letters.html#' + id);
  await expect(article.locator('.letter-story .suggestion-body')).toBeVisible();
});

test('Short writing help: storage notice remains beside the field and old-draft routes open on demand', async ({ page }) => {
  await page.goto('/letters.html#letter-form');
  await expect(page.locator('#draft-notice')).toBeVisible();
  await expect(page.locator('#draft-notice')).toContainText('seven days');
  await expect(page.locator('#message')).toHaveAttribute('aria-describedby', /draft-notice/);
  await expect(page.locator('#draft-recovery-notice')).toBeHidden();
  await page.locator('#draft-recovery > summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#draft-recovery-notice')).toBeVisible();
  await expect(page.locator('#draft-recovery-notice a[href^="https://savekewriverside.org/"]')).toHaveAttribute('href', 'https://savekewriverside.org/letters.html?recover=draft#letter-form');
  await page.goto('/letters.html#letter-guidelines');
  await expect(page.locator('#letter-guidelines')).toBeVisible();
});

// 13 October 2026 slim-site decision: the archived supporters page no longer takes new names.
// Old links to its form now land on a pointer to the council petition instead of the form.
test('Short supporters: reading and adding a name are distinct, and incoming form links reach the petition pointer', async ({ page }) => {
  await page.goto('/supporters.html');
  await expect(page.locator('.support-statement')).toBeVisible();
  await expect(page.locator('#supporter-form')).toBeHidden();
  await expect(page.locator('#supporter-list-section')).toBeVisible();
  await page.getByRole('link', { name: 'Add my name', exact: true }).click();
  await expect(page.locator('#supporter-form')).toBeVisible();
  await expect(page.locator('#supporter-form')).toContainText('New names are no longer being added.');
  await page.goto('/supporters.html#supporter-form');
  await expect(page.locator('#supporter-form')).toBeInViewport();
  await expect(page.locator('#supporter-form a[href="get-involved.html#petition"]')).toBeVisible();
  await expect(page.locator('main form, #public-name')).toHaveCount(0);
});

test('Short sent page: the official action precedes optional instructions without claiming delivery', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-12T12:00:00Z'));
  await page.addInitScript(() => sessionStorage.setItem('kr-sent-kind', JSON.stringify({ kind: 'letter', at: Date.now() })));
  await page.goto('/sent.html');
  await expect(page.locator('#sent-letter-lead')).toContainText('If Formspree confirmed');
  await expect(page.locator('#official-card > .next-actions a')).toBeVisible();
  await expect(page.locator('#official-answering-help')).not.toHaveAttribute('open', '');
  const before = await page.locator('#official-card > .next-actions').evaluate(el => Boolean(el.compareDocumentPosition(document.getElementById('official-answering-help')) & Node.DOCUMENT_POSITION_FOLLOWING));
  expect(before).toBe(true);
  await page.locator('#official-answering-help > summary').click();
  await expect(page.locator('#official-answering-help')).toContainText('postal routes');
});

test('Short corrections: review explanation opens separately and private submission remains private', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/corrections.html');
  await expect(page.locator('#correction-review .review-note')).toBeHidden();
  await page.locator('#correction-review > summary').click();
  await expect(page.locator('#correction-review .review-note')).toBeVisible();
  await page.locator('textarea[name="message"]').fill('Fictional correction request intercepted locally.');
  await page.getByRole('button', { name: 'Send private request' }).click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('kind')).toBe('privacy');
  expect(submissions[0].has('allow_public')).toBe(false);
});

test('Short rally archive: the current plan stays exposed and old section links reveal historical detail', async ({ page }) => {
  await page.goto('/rally.html');
  await expect(page.locator('.rally-intro')).toContainText('advertised date has passed');
  await expect(page.locator('.rally-intro a[href="proposal.html#parent-plan"]')).toBeVisible();
  await expect(page.locator('#schedule')).toBeHidden();
  await page.goto('/rally.html#photos');
  await expect(page.locator('#photos')).toBeVisible();
  await expect(page.locator('#photos')).toContainText('does not give permission');
});

for (const file of ['fundraising-admin.html', 'fundraising-trustees.html']) {
  test(`${file}: short brief retains its boundary and opens shared detailed questions`, async ({ page }) => {
    await page.goto('/' + file);
    await expect(page.locator('.notice strong')).toContainText('Donations are not open');
    await expect(page.locator('#reply')).toBeVisible();
    await expect(page.locator('#question-2 p')).toBeHidden();
    await page.goto('/' + file + '#question-2');
    await expect(page.locator('#question-2 p')).toBeVisible();
    await expect(page.locator('.brief-boundary')).toBeVisible();
  });
}
