const { test, expect, expectScrollSettled } = require('./fixtures');

const official = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';

// Home's Help shortcut is Get involved (13 October 2026 slim-site decision), replacing
// the Parent action plan on the archived proposal page.
test('Short guides: homepage Help arrives at usable actions on Get involved', async ({ page }) => {
  // Consultation week, when the official response leads Get involved.
  await page.clock.setSystemTime(new Date('2026-10-13T09:00:00Z'));
  await page.setViewportSize({ width: 320, height: 568 });
  // A destination URL can commit before its stylesheet and deferred setup finish.
  await page.route('**/simplify.css*', async route => {
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.continue();
  });
  await page.goto('/index.html');
  await page.locator('a.home-plan').click();
  await expect(page).toHaveURL(/get-involved\.html$/);
  await page.waitForLoadState('load');
  await expectScrollSettled(page, 'compact Get involved');
  await expect(page.getByRole('heading', { level: 1, name: 'Get involved' })).toBeInViewport({ ratio: 1 });
  const respond = page.locator('#respond a[data-current-response]');
  await expect(respond).toBeInViewport({ ratio: 1 });
  await expect(respond).toHaveAttribute('href', official);
  await expect(page.locator('main details')).toHaveCount(0);
  await expect(page.locator('#petition a[href="https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249"]')).toBeVisible();
  const letter = page.locator('#share-your-story').getByRole('link', { name: 'Write a community letter' });
  await expect(letter).toBeVisible();
  await expect(letter).toHaveAttribute('href', 'letters.html#letter-form');
  const idea = page.locator('#help').getByRole('link', { name: 'Send an idea, a question or an offer of help' });
  await expect(idea).toBeVisible();
  await expect(idea).toHaveAttribute('href', 'feedback.html');
});

test('Short guides: old proposal links reveal their exact original guidance and sources', async ({ page }) => {
  const targets = [
    ['plan-share', '#parent-plan-full', 'Write a community letter'],
    ['question-budget', '#proposal-question-details', 'The budget explained'],
    ['school-meeting', '#proposal-timetable-details', 'Council leaflet'],
    ['share-qr', '#parent-plan-full', 'Homepage QR code, PNG image'],
    ['take-part', '#proposal-response-details', 'schoolorganisation@achievingforchildren.org.uk'],
  ];
  for (const [id, disclosure, text] of targets) {
    await page.goto('/proposal.html#' + id);
    await expect(page.locator(disclosure)).toHaveAttribute('open', '');
    await expect(page.locator('#' + id)).toBeVisible();
    await expect(page.locator('#' + id)).toContainText(text);
    await expect(page.locator('#' + id)).toBeInViewport();
  }
});

test('Short guides: About exposes campaign contact and opens the complete press and private-contact routes', async ({ page }) => {
  await page.goto('/about.html');
  await expect(page.locator('main [data-simple-detail][open]')).toHaveCount(0);
  await expect(page.locator('.simple-intro a[href="mailto:savekrps@gmail.com"]').first()).toBeVisible();
  await page.getByRole('navigation', { name: 'About and contact' }).getByRole('link', { name: 'For journalists' }).click();
  await expect(page.locator('#about-press-details')).toHaveAttribute('open', '');
  await expect(page.locator('#press .press-credit')).toBeVisible();
  await page.locator('#press a[href="#contact"]').click();
  await expect(page.locator('#about-contact-details')).toHaveAttribute('open', '');
  await expect(page.locator('#contact-message')).toBeVisible();
  await expect(page.locator('#contact form')).toHaveAttribute('action', 'https://formspree.io/f/xnpnenzy');
  await expect(page.locator('input[name="contact_consent"]')).not.toBeChecked();
  await expect(page.locator('input[name="contact_consent"]')).toHaveAttribute('value', 'yes-process-private-contact-v1');
});

test('Short guides: Privacy puts choices first and keeps complete permission notices reachable', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page.locator('main [data-simple-detail][open]')).toHaveCount(0);
  const choices = page.getByRole('navigation', { name: 'Privacy choices' });
  await expect(choices.getByRole('link', { name: 'Analytics choices' })).toBeVisible();
  await expect(choices.getByRole('link', { name: 'Request correction or removal' })).toHaveAttribute('href', 'feedback.html?kind=privacy#feedback-form');
  for (const [id, disclosure] of [
    ['letters-privacy', 'privacy-letter-details'],
    ['letter-quotes', 'privacy-quote-details'],
    ['video-ads-privacy', 'privacy-video-details'],
    ['requests', 'privacy-request-details'],
    ['analytics', 'privacy-analytics-details'],
    ['device-storage', 'privacy-device-details'],
  ]) {
    await page.goto('/privacy.html#' + id);
    await expect(page.locator('#' + disclosure)).toHaveAttribute('open', '');
    await expect(page.locator('#' + id)).toBeVisible();
    await expect(page.locator('#' + id)).toBeInViewport();
  }
});

test('Short guides: full reading and print include original detail then restore the short view', async ({ page }) => {
  await page.goto('/privacy.html');
  const details = page.locator('main [data-simple-detail]');
  const total = await details.count();
  await page.getByRole('button', { name: 'Show the full page', exact: true }).click();
  await expect(page.locator('main [data-simple-detail][open]')).toHaveCount(total);
  await expect(page.locator('#letter-quotes')).toBeVisible();
  await expect(page.locator('#video-ads-privacy')).toBeVisible();
  await page.getByRole('button', { name: 'Return to the short view', exact: true }).click();
  await expect(page.locator('main [data-simple-detail][open]')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('main [data-simple-detail][open]')).toHaveCount(total);
  await expect(page.locator('#letter-quotes')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('main [data-simple-detail][open]')).toHaveCount(0);
});

test('Short guides: returning from a local source retains the opened original section', async ({ page }) => {
  await page.goto('/proposal.html#other-schools');
  await page.locator('#other-schools a[href="lessons.html"]').click();
  await expect(page).toHaveURL(/lessons\.html$/);
  await page.goBack();
  await expect(page).toHaveURL(/proposal\.html#other-schools$/);
  await expect(page.locator('#proposal-research-details')).toHaveAttribute('open', '');
  await expect(page.locator('#other-schools')).toBeInViewport();
});

test.describe('Short guide fallback', () => {
  test.use({ javaScriptEnabled: false });
  test('complete policy, family story and plan remain readable without scripts', async ({ page }) => {
    for (const [url, target] of [
      ['/proposal.html#question-budget', '#question-budget'],
      ['/about.html#contact', '#contact-message'],
      ['/privacy.html#video-ads-privacy', '#video-ads-privacy'],
    ]) {
      await page.goto(url);
      await expect(page.locator(target)).toBeVisible();
      expect(await page.locator('main [data-simple-detail]:not([open])').count()).toBe(0);
    }
  });
});
