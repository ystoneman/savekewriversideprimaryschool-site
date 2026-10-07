const { test, expect } = require('./fixtures');

const boards = [
  { file: 'feedback.html', resource: 'suggestions', list: '#suggestions-list', status: '#board-message', prefix: 'idea', review: 'AI reviewed', extra: { status: 'Received' } },
  { file: 'letters.html', resource: 'letters', list: '#letters-list', status: '#letters-message', prefix: 'letter', review: 'Human reviewed' },
  { file: 'supporters.html', resource: 'supporters', list: '#supporter-list', status: '#supporter-message', prefix: 'supporter', review: 'Confirmed with contributor; human reviewed' },
];

function boardData(board, entries) {
  const data = { version: 1, [board.resource]: entries };
  if (board.resource === 'supporters') Object.assign(data, { statementVersion: 'keep-open-2026-09-21', statement: 'We support keeping Kew Riverside Primary School open.' });
  return data;
}
function entry(board) {
  const item = { id: `${board.prefix}-0123456789ab`, date: '2026-09-21', review: board.review, displayName: 'Test contributor', ...board.extra };
  if (board.resource !== 'supporters') item.body = 'A synthetic contribution shown by a local test fixture.';
  return item;
}

async function readBoard(page, board, hasTouch) {
  if (board.resource !== 'suggestions') return;
  const summary = page.locator('#suggestions > summary');
  await expect(summary).toHaveText('Read reviewed ideas');
  await expect(page.locator('#suggestions')).not.toHaveAttribute('open', '');
  if (hasTouch) await summary.tap();
  else await summary.click();
  await expect(page.locator('#suggestions')).toHaveAttribute('open', '');
  await expect(page.locator(board.status)).toBeVisible();
}

for (const board of boards) {
  test(`${board.resource}: empty board explains its state without blocking the form`, async ({ page, hasTouch }) => {
    await page.route(`**/${board.resource}.json`, route => route.fulfill({ json: boardData(board, []) }));
    await page.goto('/' + board.file);
    await readBoard(page, board, hasTouch);
    await expect(page.locator(board.status)).toContainText(/No .*published yet/);
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();
  });

  test(`${board.resource}: approved entry renders with a removal route`, async ({ page, hasTouch }) => {
    await page.route(`**/${board.resource}.json`, route => route.fulfill({ json: boardData(board, [entry(board)]) }));
    await page.goto('/' + board.file);
    await readBoard(page, board, hasTouch);
    await expect(page.locator(board.list)).toContainText('Test contributor');
    await page.locator(board.list).getByRole('link', { name: /remove|removal/ }).click();
    await expect(page).toHaveURL(new RegExp(board.resource === 'supporters' ? 'corrections.html\\?supporter=' : 'feedback.html\\?kind=privacy'));
    await expect(page.locator('textarea')).toHaveValue(new RegExp(`${board.prefix}-0123456789ab`));
  });

  test(`${board.resource}: unexpected private fields fail closed`, async ({ page, hasTouch }) => {
    const invalid = { ...entry(board), email: 'private@example.invalid' };
    await page.route(`**/${board.resource}.json`, route => route.fulfill({ json: boardData(board, [invalid]) }));
    await page.goto('/' + board.file);
    await readBoard(page, board, hasTouch);
    await expect(page.locator(board.status)).toContainText('could not be loaded');
    await expect(page.locator(board.list)).toBeEmpty();
    await expect(page.locator('body')).not.toContainText('private@example.invalid');
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();
  });

  test(`${board.resource}: server failure leaves private intake usable`, async ({ page, hasTouch }) => {
    await page.route(`**/${board.resource}.json`, route => route.fulfill({ status: 503, body: 'Intentional test outage', headers: { 'X-Test-Fixture': 'intentional-error' } }));
    await page.goto('/' + board.file);
    await readBoard(page, board, hasTouch);
    await expect(page.locator(board.status)).toContainText('could not be loaded');
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();
  });
}

test('Letters show the actual assessment for mixed human-reviewed and AI-screened entries', async ({ page }) => {
  const board = boards.find(item => item.resource === 'letters');
  const human = entry(board);
  const screened = { ...entry(board), id: 'letter-abcdef012345', review: 'AI screened', displayName: 'Another test contributor' };
  await page.route('**/letters.json', route => route.fulfill({ json: boardData(board, [human, screened]) }));
  await page.goto('/letters.html');
  await expect(page.locator('#letters-message')).toHaveText('2 published letters.');
  await expect(page.locator('#' + human.id + ' .suggestion-meta')).toContainText('Human reviewed · Opinion');
  await expect(page.locator('#' + screened.id + ' .suggestion-meta')).toContainText('AI screened · Opinion');
  await page.locator('#' + screened.id).getByRole('link', { name: /removal/ }).click();
  await expect(page.locator('textarea')).toHaveValue(/letter-abcdef012345/);
});

for (const review of ['AI reviewed', 'ai screened', 'Human reviewed ', 'Approved', '', null]) {
  test(`Letters reject unsupported review label ${JSON.stringify(review)}`, async ({ page }) => {
    const board = boards.find(item => item.resource === 'letters');
    const invalid = { ...entry(board), review };
    await page.route('**/letters.json', route => route.fulfill({ json: boardData(board, [invalid]) }));
    await page.goto('/letters.html');
    await expect(page.locator('#letters-message')).toContainText('could not be loaded');
    await expect(page.locator('#letters-list')).toBeEmpty();
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();
  });
}

test('Letter previews and boards render markup-shaped text as plain text', async ({ page }) => {
  const literal = '<strong>Literal test contribution, never HTML.</strong>';
  const board = boards.find(item => item.resource === 'letters');
  const sample = { ...entry(board), body: literal };
  await page.route('**/letters.json', route => route.fulfill({ json: boardData(board, [sample]) }));
  await page.goto('/letters.html');
  await expect(page.locator('#letters-list .suggestion-body')).toHaveText(literal);
  await expect(page.locator('#letters-list strong')).toHaveCount(0);
  await page.locator('#message').fill(literal);
  await expect(page.locator('#preview-body')).toHaveText(literal);
  await expect(page.locator('#preview-body strong')).toHaveCount(0);
});

function longLetterBody() {
  const ending = '\n\nFinal fictional paragraph. End of the complete letter.🙂';
  return 'An entirely fictional community story.\n\n'.repeat(1000).slice(0, 30000 - ending.length) + ending;
}

for (const review of ['Human reviewed', 'AI screened']) {
  test(`Long letters preserve all 30000 characters and collapse accessibly: ${review}`, async ({ page, hasTouch }) => {
    const board = boards.find(item => item.resource === 'letters');
    const body = longLetterBody();
    const sample = { ...entry(board), body, review };
    expect(body.length).toBe(30000);
    await page.route('**/letters.json', route => route.fulfill({ json: boardData(board, [sample]) }));
    await page.goto('/letters.html');
    const article = page.locator('#' + sample.id);
    const story = article.locator('details');
    const summary = story.locator(':scope > summary');
    const full = story.locator('.suggestion-body');
    const excerpt = article.locator('.letter-excerpt');
    await expect(article.locator('.suggestion-meta')).toContainText(review + ' · Opinion');
    await expect(story).not.toHaveAttribute('open', '');
    await expect(excerpt).toBeVisible();
    expect((await excerpt.textContent()).length).toBeLessThan(700);
    await expect(full).toBeHidden();
    expect(await full.textContent()).toBe(body);
    await expect(summary).toHaveAccessibleName('Read full letter by Test contributor');
    if (hasTouch) await summary.tap();
    else await summary.click();
    await expect(story).toHaveAttribute('open', '');
    await expect(full).toBeVisible();
    expect(await full.textContent()).toBe(body);
    await expect(excerpt).toBeHidden();
    await expect(summary).toHaveAccessibleName('Show less of the letter by Test contributor');
    // The native top control also works with a keyboard and keeps focus.
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(story).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    await expect(summary).toBeInViewport();
    await expect(full).toBeHidden();
    await expect(excerpt).toBeVisible();
    await page.keyboard.press('Space');
    await expect(story).toHaveAttribute('open', '');
    const bottom = story.getByRole('button', { name: 'Show less of the letter by Test contributor' });
    if (hasTouch) await bottom.tap();
    else await bottom.click();
    await expect(story).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    await expect(summary).toBeInViewport();
    await expect(full).toBeHidden();
    await expect(excerpt).toBeVisible();
  });
}

test('Letters of 1200 characters remain fully readable without disclosure', async ({ page }) => {
  const board = boards.find(item => item.resource === 'letters');
  const sample = { ...entry(board), body: 'A short fictional letter. '.repeat(50).slice(0, 1197) + 'END' };
  expect(sample.body.length).toBe(1200);
  await page.route('**/letters.json', route => route.fulfill({ json: boardData(board, [sample]) }));
  await page.goto('/letters.html');
  const article = page.locator('#' + sample.id);
  await expect(article.locator('.suggestion-body')).toBeVisible();
  expect(await article.locator('.suggestion-body').textContent()).toBe(sample.body);
  await expect(article.locator('details, .letter-excerpt, .letter-collapse')).toHaveCount(0);
});

for (const suffix of ['E', '🙂']) {
  test(`Letter board rejects 30001 UTF-16 units ending ${suffix}`, async ({ page }) => {
    const board = boards.find(item => item.resource === 'letters');
    const sample = { ...entry(board), body: 'F'.repeat(30001 - suffix.length) + suffix };
    expect(sample.body.length).toBe(30001);
    await page.route('**/letters.json', route => route.fulfill({ json: boardData(board, [sample]) }));
    await page.goto('/letters.html');
    await expect(page.locator('#letters-message')).toContainText('could not be loaded');
    await expect(page.locator('#letters-list')).toBeEmpty();
    await expect(page.locator('#letter-form button[type="submit"]')).toBeEnabled();
  });
}

test('A 30000-character letter treats markup in the excerpt and full story as plain text', async ({ page }) => {
  const board = boards.find(item => item.resource === 'letters');
  const body = '<img src="missing" onerror="alert(1)">Fictional markup-shaped story. '.padEnd(30000, 'F');
  const sample = { ...entry(board), body };
  await page.route('**/letters.json', route => route.fulfill({ json: boardData(board, [sample]) }));
  await page.goto('/letters.html');
  const article = page.locator('#' + sample.id);
  await expect(article.locator('.letter-excerpt')).toContainText('<img src="missing"');
  await article.locator('summary').click();
  expect(await article.locator('.suggestion-body').textContent()).toBe(body);
  await expect(article.locator('img')).toHaveCount(0);
  await page.locator('#message').fill(body);
  expect(await page.locator('#preview-body').textContent()).toBe(body);
  await expect(page.locator('#preview-body img')).toHaveCount(0);
});

test('Long letter links open the complete story on arrival, hash changes and Back', async ({ page }) => {
  const board = boards.find(item => item.resource === 'letters');
  const first = { ...entry(board), body: longLetterBody() };
  const second = { ...entry(board), id: 'letter-abcdef012345', body: longLetterBody(), review: 'AI screened', displayName: 'Another fictional contributor' };
  await page.route('**/letters.json', route => route.fulfill({ json: boardData(board, [first, second]) }));
  await page.goto('/letters.html#' + first.id);
  const firstArticle = page.locator('#' + first.id);
  const secondArticle = page.locator('#' + second.id);
  await expect(firstArticle.locator('details')).toHaveAttribute('open', '');
  await expect(firstArticle.locator('.public-author')).toBeInViewport();
  expect(await firstArticle.locator('.suggestion-body').textContent()).toBe(first.body);
  await firstArticle.locator('summary').click();
  await expect(firstArticle.locator('details')).not.toHaveAttribute('open', '');
  await page.locator('main a[href="#letters"]').click();
  await expect(page).toHaveURL(/#letters$/);
  await page.goto('/letters.html#' + second.id);
  await expect(secondArticle.locator('details')).toHaveAttribute('open', '');
  await expect(secondArticle.locator('.public-author')).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/#letters$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp('#' + first.id + '$'));
  await expect(firstArticle.locator('details')).toHaveAttribute('open', '');
  await expect(firstArticle.locator('.public-author')).toBeInViewport();
  expect(await firstArticle.locator('.suggestion-body').textContent()).toBe(first.body);
});
