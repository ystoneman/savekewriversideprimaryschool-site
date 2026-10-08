const { test, expect, expectScrollSettled } = require('./fixtures');

// Legacy links redirect while the homepage is still loading. These tests run without
// request routing, which in WebKit left requests in flight to be cancelled and could
// lose the redirected navigation (TESTING.md); the network guard still checks them.
const legacyTest = test.extend({ routeRequests: [false, { option: true }] });

// Independently pinned public destinations from the former homepage. These are
// not derived from the new alias map, so removing a mapping cannot remove its test.
const legacyDestinations = [
  ['evidence', 'evidence.html'],
  ['school-roll-title', 'evidence.html'],
  ['borough-context', 'evidence.html'],
  ['timeline', 'evidence.html'],
  ['earlier-record', 'evidence.html'],
  ['records', 'evidence.html'],
  ['source-lessons-report', 'evidence.html'],
  ['source-inspection-2003', 'evidence.html'],
  ['source-inspection-2026', 'evidence.html'],
  ['source-consultation-response', 'evidence.html'],
  ['gaps', 'evidence.html'],
  ['method', 'evidence.html'],
  ['options', 'options.html'],
  ['option-recovery-plan', 'options.html'],
  ['option-crowdfunding', 'options.html'],
  ['crowdfunding-recipient', 'options.html'],
  ['option-demand', 'options.html'],
  ['option-enrolment', 'options.html'],
];

async function activate(locator, hasTouch) {
  if (hasTouch) await locator.tap();
  else await locator.click();
}

test('Short homepage: visitors choose destinations before any long document or strategy collection', async ({ page, hasTouch }) => {
  await page.goto('/index.html');
  await expect(page.locator('main .source-card, main .action-card, main .school-roll-chart')).toHaveCount(0);
  await expect(page.locator('#find-your-way .route-card')).toHaveCount(6);
  await expect(page.locator('#find-your-way .discovery-heading')).toContainText('Shortcuts to pages and answers on this website.');
  expect((await page.locator('#find-your-way .route-arrow').allTextContents()).map(text => text.trim())).toEqual(Array(6).fill('→'));
  await expect(page.locator('#top')).toContainText(/proposal to close/i);
  await expect(page.locator('#top')).toContainText('No final decision has been made.');
  await expect(page.locator('#top')).toContainText(/16\s+October/i);
  await expect(page.locator('#research-shortcut a[href="lessons.html"]')).toBeVisible();
  await expect(page.locator('#research-shortcut a[href="lessons.html"]')).toHaveAccessibleName(/Lessons/);
  await expect(page.locator('#research-shortcut a[href="lessons-report.pdf"]')).toBeVisible();
  await expect(page.locator('#visit-school a[href="understand.html#learning-and-results"]')).toBeVisible();
  await expect(page.locator('#find-your-way a[href="faq.html#school-places"]')).toBeVisible();
  const chooser = await page.locator('#find-your-way').boundingBox();
  const answers = await page.locator('#quick-answers').boundingBox();
  expect(chooser.y + chooser.height).toBeLessThanOrEqual(answers.y + 1);
  for (const [destination, target] of [['options.html', 'main h1'], ['evidence.html#records', '#records']]) {
    await activate(page.locator(`#find-your-way a[href="${destination}"]`), hasTouch);
    await expect(page).toHaveURL(new RegExp(destination.replace('.', '\\.') + '$'));
    await expect(page.locator(target)).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(/index\.html$/);
  }
});

test('Dedicated pages: local navigation exposes depth and retains a homepage recovery path', async ({ page, hasTouch }) => {
  await page.goto('/evidence.html#records');
  const evidenceNav = page.locator('#evidence-navigation, .evidence-more');
  for (const id of ['evidence', 'records', 'source-lessons-report', 'earlier-record', 'gaps', 'method']) {
    const link = evidenceNav.locator(`a[href="#${id}"]`);
    await expect(link).toBeVisible();
    await expect(link).toHaveAccessibleName(/\S/);
    await activate(link, hasTouch);
    await expect(page.locator('#' + id)).toBeInViewport();
  }
  await page.goto('/options.html#options');
  await expect(page.locator('#options-navigation')).toBeVisible();
  await expect(page.locator('#options .action-card')).toHaveCount(7);
  await expect(page.locator('#option-7 .options-response-button')).toBeVisible();
  for (const id of ['option-recovery-plan', 'option-crowdfunding', 'option-demand', 'option-enrolment']) {
    const detail = page.locator('#' + id + ' > details.option-card');
    const summary = detail.locator(':scope > summary');
    await expect(summary).toHaveAccessibleName(/\S/);
    await activate(summary, hasTouch);
    await expect(detail).toHaveAttribute('open', '');
    await expect(page.locator('#' + id + ' .option-first')).toBeVisible();
  }
  await activate(page.locator('header a.brand'), hasTouch);
  await expect(page).toHaveURL(/index\.html(?:#top)?$/);
  await expect(page.locator('#find-your-way')).toBeVisible();
});

legacyTest('Legacy homepage: representative shared fragments reach their original content', async ({ page }) => {
  for (const [id, destination] of legacyDestinations) {
    await test.step(id, async () => {
      await page.goto('/index.html#' + id);
      await expect(page).toHaveURL(new RegExp(destination.replace('.', '\\.') + '#' + id + '$'));
      await expect(page.locator('#' + id)).toBeVisible();
      await expect(page.locator('#' + id)).toBeInViewport();
      if (['borough-context', 'earlier-record'].includes(id)) {
        await expect(page.locator('#' + id)).toHaveAttribute('open', '');
      }
    });
  }
});

legacyTest('Legacy homepage: saved search without a fragment survives migration and reload', async ({ page }) => {
  await page.goto('/index.html?q=Ofsted&type=Inspection&year=2003');
  await expect(page).toHaveURL(/evidence\.html\?q=Ofsted&type=Inspection&year=2003#source-search$/);
  await expect(page.getByLabel('Search source records and research reports')).toHaveValue('Ofsted');
  await expect(page.getByLabel('Record type', { exact: true })).toHaveValue('Inspection');
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('2003');
  await expect(page.locator('.source-card:visible')).toHaveCount(1);
  await expect(page.locator('.source-card:visible h3')).toContainText('First Ofsted inspection');
  await page.reload();
  await expect(page.getByLabel('Search source records and research reports')).toHaveValue('Ofsted');
  await expect(page.locator('.source-card:visible')).toHaveCount(1);
});

legacyTest('Legacy homepage: source links recover conflicting filters and do not trap Back', async ({ page }) => {
  await page.goto('/faq.html#school-places');
  await page.goto('/index.html?q=unfindable-source&type=Inspection&year=2003#source-inspection-2026');
  await expect(page).toHaveURL(/evidence\.html#source-inspection-2026$/);
  await expect(page.locator('#source-inspection-2026')).toBeInViewport();
  await expect(page.getByLabel('Search source records and research reports')).toHaveValue('');
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('');
  await page.goBack();
  await expect(page).toHaveURL(/faq\.html#school-places$/);
  await expect(page.locator('#school-places')).toBeInViewport();
  await page.goForward();
  await expect(page).toHaveURL(/evidence\.html#source-inspection-2026$/);
  await expect(page.locator('#source-inspection-2026')).toBeInViewport();
});

legacyTest('Legacy homepage: a fragment added after arrival routes without changing unrelated homepage links', async ({ page }) => {
  await page.goto('/index.html#visit-school');
  await expect(page).toHaveURL(/index\.html#visit-school$/);
  await expect(page.locator('#visit-school')).toBeInViewport();
  await page.evaluate(() => { location.hash = '#crowdfunding-recipient'; });
  await expect(page).toHaveURL(/options\.html#crowdfunding-recipient$/);
  await expect(page.locator('#crowdfunding-recipient')).toBeVisible();
  await expect(page.locator('#crowdfunding-recipient')).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/index\.html#visit-school$/);
  await expect(page.locator('#visit-school')).toBeInViewport();
});

test('Shared video QR: the exact upload path remains directly usable with an intercepted handoff', async ({ page, hasTouch }) => {
  await page.goto('/videos.html#upload');
  await expect(page).toHaveURL(/\/videos\.html#upload$/);
  await expect(page.locator('#upload')).toBeInViewport();
  await expect(page.locator('#recording-rule')).toContainText('Adults only. Keep children off camera.');
  await expect(page.locator('#upload-step-two')).toContainText('No account needed');
  const link = page.locator('#video-upload-link');
  const destination = await link.getAttribute('href');
  await page.route(destination, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional handoff</title><h1>Fictional video permission handoff</h1><p>No upload sent.</p>' }));
  await activate(link, hasTouch);
  await expect(page).toHaveURL(destination);
  await page.waitForURL(destination, { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: 'Fictional video permission handoff' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/videos\.html#upload$/);
  await expect(page.locator('#upload')).toBeInViewport();
  await expect(page.locator('main a[href="letters.html#letter-form"]').last()).toBeVisible();
  await expectScrollSettled(page, 'Back to video upload');
});
test('Homepage: real school photos load locally with readable descriptions and keep phone tasks first', async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto('/index.html');
    const discovery = page.locator('.hero-school-photo');
    if (width <= 700) await expect(discovery).toBeHidden();
    else {
      await expect(discovery).toBeVisible();
      await expect(discovery.locator('img')).toHaveAttribute('alt', 'Hands holding an autumn leaf with a ladybird.');
      expect(await discovery.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    const project = page.locator('.school-project-photo img');
    await project.scrollIntoViewIfNeeded();
    await expect(project).toHaveAttribute('alt', 'A handmade solar-system model on a classroom table.');
    await expect.poll(() => project.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    expect(await project.evaluate(el => new URL(el.currentSrc).origin === location.origin)).toBe(true);
    expect(await page.locator('#find-your-way').evaluate(el => Boolean(el.compareDocumentPosition(document.getElementById('visit-school')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
