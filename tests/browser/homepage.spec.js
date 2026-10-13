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

test('Short homepage: petition joins the response, Get involved and Share before optional detail', async ({ page, hasTouch }) => {
  // Consultation week: the response action still leads (the deadline stages are in home-landing.spec.js).
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
  await page.goto('/index.html');
  await expect(page.locator('main .source-card, main .action-card, main .school-roll-chart')).toHaveCount(0);
  await expect(page.locator('.actions .action:visible')).toHaveCount(4);
  await expect(page.locator('#petition-action')).toHaveAccessibleName('Sign the petition');
  await expect(page.locator('#petition-action')).toHaveAttribute('href', 'https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249');
  await expect(page.locator('.home-plan')).toHaveAccessibleName('Get involved');
  await expect(page.locator('#top')).toContainText(/proposes closure/i);
  await expect(page.locator('#top')).toContainText('no decision yet.');
  await expect(page.locator('#top')).toContainText(/16\s+October/i);
  for (const action of await page.locator('.actions .action:visible').all()) {
    expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(64);
  }
  // 13 October 2026 slim-site decision: the Menu names the five campaign pages; the archived
  // proposal, FAQ, options and evidence pages have no Menu entry.
  for (const [destination, target] of [['dates.html', '#deadline'], ['get-involved.html', '#respond']]) {
    await activate(page.locator('.mobile-menu summary'), hasTouch);
    for (const [href, name] of [['dates.html', 'Dates, leaflet & FAQs'], ['get-involved.html', 'Get involved'], ['updates.html', 'Campaign updates'], ['about.html', 'About & contact']]) {
      await expect(page.locator(`.mobile-menu a[href="${href}"]`)).toHaveAccessibleName(name);
      await expect(page.locator(`.mobile-menu a[href="${href}"]`)).toBeVisible();
    }
    await expect(page.locator('.mobile-menu a[href="proposal.html"], .mobile-menu a[href="proposal.html#council-documents"], .mobile-menu a[href="faq.html"], .mobile-menu a[href="options.html"], .mobile-menu a[href="evidence.html#records"]')).toHaveCount(0);
    await activate(page.locator(`.mobile-menu a[href="${destination}"]`), hasTouch);
    await expect(page).toHaveURL(new RegExp(destination.replace('.', '\\.') + '$'));
    await expect(page.locator('main h1')).toBeInViewport();
    await expect(page.locator(target)).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(/index\.html$/);
  }
});

test('Dedicated pages: local navigation exposes depth and retains a homepage recovery path', async ({ page, hasTouch }) => {
  await page.goto('/evidence.html#records');
  await activate(page.locator('#evidence-library-guide > summary'), hasTouch);
  await expect(page.locator('#evidence-library-guide')).toHaveAttribute('open', '');
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
  await expect(page.locator('#options .action-card')).toHaveCount(6);
  await expect(page.locator('.options-response-button')).toHaveCount(0);
  for (const id of ['option-recovery-plan', 'option-crowdfunding', 'option-demand']) {
    const detail = page.locator('#' + id + ' > details.option-card');
    const summary = detail.locator(':scope > summary');
    await expect(summary).toHaveAccessibleName(/\S/);
    await activate(summary, hasTouch);
    await expect(detail).toHaveAttribute('open', '');
    await expect(page.locator('#' + id + ' .option-first')).toBeVisible();
  }
  await activate(page.locator('header a.brand'), hasTouch);
  await expect(page).toHaveURL(/index\.html(?:#top)?$/);
  await expect(page.locator('#headline')).toBeVisible();
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
  await page.goto('/index.html#press');
  await expect(page).toHaveURL(/index\.html#press$/);
  await expect(page.locator('#press')).toBeInViewport();
  await page.evaluate(() => { location.hash = '#crowdfunding-recipient'; });
  await expect(page).toHaveURL(/options\.html#crowdfunding-recipient$/);
  await expect(page.locator('#crowdfunding-recipient')).toBeVisible();
  await expect(page.locator('#crowdfunding-recipient')).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/index\.html#press$/);
  await expect(page.locator('#press')).toBeInViewport();
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
test('Homepage: the ladybird loads locally and follows actions on phones', async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto('/index.html');
    const photo = page.locator('.hero-school-photo img');
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute('alt', 'Hands holding an autumn leaf with a ladybird.');
    await expect.poll(() => photo.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    expect(await photo.evaluate(el => new URL(el.currentSrc).origin === location.origin)).toBe(true);
    if (width <= 700) {
      const actions = await page.locator('.actions').boundingBox(), image = await photo.boundingBox();
      expect(image.y).toBeGreaterThan(actions.y + actions.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
