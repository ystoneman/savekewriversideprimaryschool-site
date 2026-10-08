const { test, expect, pages, headerLinks, expectDestination, expectStillArrival, captureSubmissions } = require('./fixtures');

test('No JavaScript: page identity and native section routes retain nested content and recovery', async ({ page }) => {
  await page.goto('/options.html');
  await expect(page.locator('.page-name')).toHaveText('Ways to keep Kew open');
  await expect(page.locator('.section-copy')).toBeHidden();
  const sections = page.locator('.page-sections');
  await sections.locator(':scope > summary').tap();
  await sections.locator('a[data-section-id="option-crowdfunding"]').tap();
  await expect(page).toHaveURL(/options\.html#option-crowdfunding$/);
  await expect(page.locator('#option-crowdfunding > details.option-card')).toHaveAttribute('open', '');
  await expect(page.locator('#option-crowdfunding .option-first')).toBeVisible();
  await expect(page.locator('#option-crowdfunding')).toBeInViewport();
  // Leaving from the reading position should return to that section.
  await page.locator('#option-crowdfunding .option-contribute').tap();
  await expect(page).toHaveURL(/feedback\.html\?kind=crowdfunding#feedback-form$/);
  await page.goBack();
  await expect(page).toHaveURL(/options\.html#option-crowdfunding$/);
  await expect(page.locator('#option-crowdfunding')).toBeInViewport();
  const menu = page.locator('.mobile-menu');
  await menu.locator(':scope > summary').tap();
  expect((await menu.locator('a').allTextContents()).slice(0, 5)).toEqual(['Respond to the council', 'Parent action plan', 'Community letters', 'Share a video', 'Share ideas']);
  await expect(menu.getByRole('link', { name: 'Ways to keep Kew open', exact: true })).toHaveAttribute('aria-current', 'page');
  await menu.getByRole('link', { name: 'FAQ', exact: true }).tap();
  await expect(page.locator('h1')).toHaveText('FAQ');
  await page.locator('.page-sections > summary').tap();
  await page.locator('.section-links a[data-section-id="school-places"]').tap();
  await expect(page).toHaveURL(/faq\.html#school-places$/);
  await expect(page.locator('#school-places')).toBeInViewport();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/options\.html#option-crowdfunding$/);
  await expect(page.locator('#option-crowdfunding > details.option-card')).toHaveAttribute('open', '');
  await expect(page.locator('#option-crowdfunding .option-first')).toBeVisible();
  // The static no-script menu requires returning to the header before leaving.
  // Back may restore that departure position instead of reapplying the fragment.
  // Recover through the real same-fragment link, never a test-only scroll.
  if (await sections.getAttribute('open') === null) await sections.locator(':scope > summary').tap();
  await sections.locator('a[data-section-id="option-crowdfunding"]').tap();
  await expect(page).toHaveURL(/options\.html#option-crowdfunding$/);
  await expect(page.locator('#option-crowdfunding')).toBeInViewport();
});

test('No JavaScript: Unanswered questions is a direct menu route with a matching section label', async ({ page }) => {
  await page.goto('/index.html');
  const menu = page.locator('.mobile-menu');
  const questions = menu.getByRole('link', { name: 'Unanswered questions', exact: true });
  await menu.locator(':scope > summary').tap();
  await expect(questions).toBeVisible();
  await expect(questions).toHaveAttribute('href', 'evidence.html#gaps');
  await questions.tap();
  await expect(page).toHaveURL(/evidence\.html#gaps$/);
  const heading = page.locator('#gaps h2');
  await expect(heading).toHaveText('Unanswered questions');
  await expect(heading).toBeInViewport();
  const sections = page.locator('.page-sections');
  await sections.locator(':scope > summary').tap();
  const section = sections.locator('a[data-section-id="gaps"]');
  await expect(section).toHaveText('Unanswered questions');
  await section.tap();
  await expect(heading).toBeInViewport();
  // Native same-document menu navigation must work with the existing hash too.
  await menu.locator(':scope > summary').tap();
  await questions.tap();
  await expect(page).toHaveURL(/evidence\.html#gaps$/);
  await expect(heading).toBeInViewport();
});

test('No JavaScript: all eight unanswered questions expose known evidence and missing answers', async ({ page }) => {
  await page.goto('/evidence.html#gaps');
  const ids = ['gap-budget', 'gap-pupil-impacts', 'gap-selection', 'gap-closure-costs', 'gap-alternatives', 'gap-recruitment', 'gap-forecasts', 'gap-answers'];
  const questions = page.locator('#gaps .gaps-grid > article');
  expect(await questions.evaluateAll(nodes => nodes.map(node => node.id))).toEqual(ids);
  for (const id of ids) {
    const question = page.locator('#' + id);
    await expect(question.locator('.gap-detail')).toHaveAttribute('open', '');
    await expect(question.locator('.gap-detail > p').filter({ has: page.locator('strong', { hasText: /^Known:$/ }) })).toBeVisible();
    await expect(question.locator('.gap-detail > p').filter({ has: page.locator('strong', { hasText: /^Still unanswered:$/ }) })).toBeVisible();
  }
  await expect(page.locator('#evidence-found .gap-detail')).toHaveAttribute('open', '');
  await expect(page.locator('#evidence-found a[href="#source-inspection-2026"]')).toBeVisible();
  await expect(page.locator('#gap-records .gap-detail')).toHaveAttribute('open', '');
  await page.goto('/evidence.html#gap-recruitment');
  await expect(page.locator('#gap-recruitment summary')).toBeInViewport();
  const detail = page.locator('#gap-recruitment .gap-detail');
  await detail.locator('summary').tap();
  await expect(detail).not.toHaveAttribute('open', '');
  await detail.locator('summary').tap();
  await expect(detail).toHaveAttribute('open', '');
});

test('Clarity pages preserve findings, funding questions and native process details without scripts', async ({ page }) => {
  await page.goto('/options.html#options');
  await expect(page.locator('#options h1')).toBeInViewport();
  await expect(page.locator('.options-response-button')).toBeVisible();
  await expect(page.locator('.options-response')).toContainText('16 October 2026');
  await expect(page.locator('#options-findings-title')).toBeVisible();
  await expect(page.locator('.action-card > details.option-card[open]')).toHaveCount(7);
  await expect(page.locator('.options-school-enquiry')).toBeVisible();
  await page.goto('/options.html#crowdfunding-recipient');
  await expect(page.locator('#option-crowdfunding > details.option-card')).toHaveAttribute('open', '');
  await expect(page.locator('.funding-questions details.question-detail[open]')).toHaveCount(8);
  const question = page.locator('#crowdfunding-recipient > details.question-detail');
  await question.locator(':scope > summary').tap();
  await expect(question).not.toHaveAttribute('open', '');
  await question.locator(':scope > summary').tap();
  await expect(question).toHaveAttribute('open', '');
  await expect(page.locator('#crowdfunding-recipient a')).toBeVisible();
  await page.goto('/proposal.html#school-meeting');
  await expect(page.locator('#school-meeting')).toBeInViewport();
  await expect(page.locator('#school-meeting > .stage-label')).toBeVisible();
  await page.goto('/proposal.html#who-decides');
  const details = page.locator('#roles-detail');
  await details.locator(':scope > summary').tap();
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('.role-profile')).toHaveCount(2);
});

for (const file of pages) {
  test(`${file}: every native mobile menu link works without JavaScript`, async ({ page, baseURL }) => {
    for (const href of headerLinks(file, 'mobile')) {
      await page.goto('/' + file);
      await page.locator('.mobile-menu summary').tap();
      await page.locator(`.mobile-menu a[href="${href}"]`).tap();
      await expectDestination(page, href, baseURL);
    }
  });
}

test('No JavaScript: evidence is readable and council identity stays disabled', async ({ page }) => {
  await page.goto('/evidence.html#records');
  expect(await page.locator('.source-card:visible').count()).toBeGreaterThan(0);
  await page.goto('/letters.html');
  await expect(page.locator('#council-name')).toBeDisabled();
  await expect(page.locator('#council-postcode')).toBeDisabled();
  await expect(page.locator('#letter-consent')).not.toBeChecked();
  await expect(page.locator('#allow-public')).not.toBeChecked();
  await expect(page.locator('#allow-council')).not.toBeChecked();
});

test('No JavaScript: homepage and Evidence expose the full report and web research', async ({ page }) => {
  await page.goto('/index.html');
  const shortcut = page.locator('#research-shortcut');
  await expect(shortcut).toContainText('44-page PDF');
  await shortcut.locator('a[href="lessons.html"]').tap();
  await expect(page).toHaveURL(/lessons\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What can other schools teach us?');
  await page.goBack();
  await shortcut.locator('a[href="evidence.html#source-lessons-report"]').tap();
  const report = page.locator('#source-lessons-report');
  await expect(report).toBeInViewport();
  await expect(report).toContainText(/site research/i);
  await expect(report.locator('a[href="lessons.html"]')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    report.locator('a[href="lessons-report.pdf"]').tap(),
  ]);
  expect(download.suggestedFilename()).toBe('lessons-report.pdf');
  expect(await download.failure()).toBeNull();
  await page.goto('/evidence.html?q=impossible-report-search&type=Inspection#source-lessons-report');
  await expect(report).toBeVisible();
  await expect(report).toBeInViewport();
  await expect(page.locator('.source-card:visible')).toHaveCount(61);
});

test('No JavaScript: budget and forecast answers, sources and optional data remain readable', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#find-your-way a[href="understand.html"]').tap();
  await expect(page).toHaveURL(/understand\.html$/);
  await expect(page.locator('#budget')).toContainText('£231,685');
  await expect(page.locator('#forecast-checks')).toContainText(/Kew planning area/i);
  const source = page.locator('#budget a[href="evidence.html#source-school-balances-mar-2026"]');
  const detail = page.locator('#budget-actuals');
  await detail.locator('summary').tap();
  await expect(source).toBeVisible();
  await expect(detail.locator('table').last()).toBeVisible();
  await source.tap();
  await expect(page.locator('#source-school-balances-mar-2026')).toBeInViewport();
  await expect(page.locator('#source-school-balances-mar-2026')).toContainText(/31 March 2026|March 2026/);
});

for (const [publish, council] of [[false, false], [true, false], [false, true], [true, true]]) {
  test(`No JavaScript: letter permissions submit independently: public=${publish}, council=${council}`, async ({ page }) => {
    const submissions = await captureSubmissions(page);
    await page.goto('/letters.html');
    await page.locator('#message').fill('A fictional community letter submitted without JavaScript.');
    await page.locator('#letter-consent').check();
    if (publish) await page.locator('#allow-public').check();
    if (council) await page.locator('#allow-council').check();
    await page.locator('#letter-form button[type="submit"]').tap();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0].get('notice_version')).toBe('2026-09-22-letters-v3');
    expect(submissions[0].get('letter_consent')).toBe('yes-process-my-letter-v3');
    expect(submissions[0].get('allow_public')).toBe(publish ? 'yes-publish-with-display-name-v3' : null);
    expect(submissions[0].get('allow_council')).toBe(council ? 'yes-share-with-richmond-council-v2' : null);
    for (const field of ['council_name', 'council_postcode', 'allow_quotes']) expect(submissions[0].has(field)).toBe(false);
  });
}

test('No JavaScript: the letter form shows every step, the written starter and an unticked quote choice', async ({ page }) => {
  await page.goto('/letters.html');
  await expect(page.locator('#to-choices')).toBeHidden();
  await expect(page.locator('#starters')).toBeHidden();
  await expect(page.locator('#starter-static')).toBeVisible();
  for (const id of ['#step-choose', '#step-send', '#quote-choice']) await expect(page.locator(id), id).toBeVisible();
  await expect(page.locator('#allow-quotes')).not.toBeChecked();
  await expect(page.locator('#allow-quotes')).toBeEnabled();
  await expect(page.locator('#sent-return')).toBeHidden();
  await expect(page.locator('#official-line')).toBeVisible();
  await expect(page.locator('#draft-notice')).toBeVisible();
});

test('No JavaScript: an incoming removal link exposes the private category and how to use it', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/feedback.html?kind=privacy&letter=letter-012345abcdef#feedback-form');
  await expect(page.locator('#kind-more')).toHaveAttribute('open', '');
  await expect(page.locator('input[name="kind"][value="privacy"]')).toBeVisible();
  await expect(page.getByText('For a privacy or removal request, choose')).toBeVisible();
  await page.locator('input[name="kind"][value="privacy"]').check();
  await page.locator('#message').fill('Please review fictional letter letter-012345abcdef.');
  await page.locator('#feedback-form button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('kind')).toBe('privacy');
  expect(submissions[0].get('allow_public')).toBeNull();
});

test('No JavaScript: dated invitations retain safe process guidance after their deadlines', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-17T12:00:00+01:00'));
  await page.goto('/letters.html');
  await expect(page.locator('#official-line')).toContainText('Check the current process');
  await expect(page.locator('#step-official-fallback')).toBeVisible();
  await expect(page.locator('#step-official-open')).toBeHidden();
  await page.goto('/feedback.html');
  await expect(page.locator('input[name="kind"][value="meeting"] + .kind-icon + span .kind-title')).toHaveText('A question about the proposal');
  await expect(page.locator('#meeting-date')).toBeHidden();
});

for (const publish of [true, false]) {
  test(`No JavaScript: a ticked quote choice submits its exact value (publication ${publish ? 'chosen' : 'not chosen'})`, async ({ page }) => {
    const submissions = await captureSubmissions(page);
    await page.goto('/letters.html');
    await page.locator('#message').fill('A fictional community letter with quote permission, sent without JavaScript.');
    await page.locator('#letter-consent').check();
    if (publish) await page.locator('#allow-public').check();
    await page.locator('#allow-quotes').check();
    await page.locator('#letter-form button[type="submit"]').tap();
    await expect.poll(() => submissions.length).toBe(1);
    // Without publication the value is not permission; the privacy notice and operations rules say so.
    expect(submissions[0].get('allow_quotes')).toBe('yes-quote-published-letter-v1');
    expect(submissions[0].get('allow_public')).toBe(publish ? 'yes-publish-with-display-name-v3' : null);
  });
}

test('No JavaScript: the thank-you page and the participation tiles work without scripts', async ({ page }) => {
  await page.goto('/sent.html');
  await expect(page.locator('#sent-title')).toHaveText('Thank you.');
  await expect(page.locator('#sent-lead')).toBeVisible();
  for (const id of ['#official-card', '#share-card', '#sent-more']) await expect(page.locator(id), id).toBeHidden();
  const nav = page.getByRole('navigation', { name: 'Take part' });
  await expect(nav.getByRole('link', { name: /^Community letters/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Share ideas/ })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/voice-cue/);
});

test('No JavaScript: letter accepts a full 30000-character message including an emoji', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  const body = 'F'.repeat(29998) + '🙂';
  await page.goto('/letters.html');
  await expect(page.locator('#message')).toHaveAttribute('maxlength', '30000');
  await page.locator('#message').fill(body);
  await expect(page.locator('#message')).toHaveValue(body);
  await page.locator('#letter-consent').check();
  await page.locator('#allow-public').check();
  await page.locator('#letter-form button[type="submit"]').tap();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('message')).toBe(body);
  expect(submissions[0].get('allow_public')).toBe('yes-publish-with-display-name-v3');
});

test('No JavaScript: Understand retains charts, underlying data and council context', async ({ page }) => {
  await page.goto('/understand.html');
  const controls = page.locator('[role="group"][aria-label="Pupil trend measure"]');
  await expect(controls).toHaveCount(1);
  await expect(controls).toBeHidden();
  await expect(page.locator('[data-trend-view="count"]')).toBeVisible();
  await expect(page.locator('[data-trend-view="count"] svg')).toHaveCount(3);
  await expect(page.locator('[data-trend-view="change"]')).toBeHidden();
  const local = page.locator('#pupil-trends summary').filter({ hasText: /^View the local trend data$/ });
  await local.tap();
  await expect(local.locator('..').locator('table')).toBeVisible();
  for (const id of ['pupil-trends', 'school-places', 'year-groups']) {
    const summary = page.locator('#' + id + ' summary').filter({ hasText: /^Compare all Richmond primary schools$/ });
    await summary.tap();
    await expect(summary.locator('..').locator('table')).toBeVisible();
  }
  await expect(page.locator('#other-proposals')).toBeVisible();
  await expect(page.locator('#methodology')).toBeVisible();
});

test('No JavaScript: contextual learning entry exposes the results, native tables and downloads', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#visit-school a[href="understand.html#learning-and-results"]').tap();
  const section = page.locator('#learning-and-results');
  await expect(section).toBeInViewport();
  await expect(page.locator('svg#attainment-chart')).toBeVisible();
  for (const value of ['75%', '67%', '73%', '60%', '61%', '62%', '74%', '76%', '78%']) {
    await expect(section).toContainText(value);
  }
  await page.locator('#attainment-tables > summary').tap();
  await expect(page.locator('#attainment-tables')).toHaveAttribute('open', '');
  expect(await page.locator('#attainment-tables table:visible').count()).toBeGreaterThan(0);
  await page.locator('#attainment-method > summary').tap();
  await expect(page.locator('#attainment-method')).toHaveAttribute('open', '');
  for (const filename of ['attainment.csv', 'attainment-data.json']) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      section.locator(`a[href="${filename}"][download]`).tap(),
    ]);
    expect(download.suggestedFilename()).toBe(filename);
    expect(await download.failure()).toBeNull();
  }
  await section.locator('#inspection-summary a[href="evidence.html#source-inspection-2026"]').tap();
  await expect(page.locator('#source-inspection-2026')).toBeInViewport();
  await expect(page.locator('#source-inspection-2026')).toContainText('Reviewed');
});

test('No JavaScript: prospective families can follow learning and open the sourced FAQ answers', async ({ page }) => {
  await page.goto('/index.html#visit-school');
  const visit = page.locator('#visit-school');
  await expect(visit.locator('a[href^="https://www.kewriverside.richmond.sch.uk/"]')).toBeVisible();
  await expect(visit.locator('a[href="proposal.html"]')).toBeVisible();
  await expect(visit.locator('a[href^="https://www.richmond.gov.uk/"][href*="primary"]')).toBeVisible();
  await visit.locator('a[href="understand.html#learning-and-results"]').tap();
  await expect(page.locator('#learning-and-results')).toBeInViewport();
  await page.goBack();
  await expect(visit).toBeInViewport();
  await page.goto('/faq.html#learning');
  await expect(page.locator('#learning')).toBeInViewport();
  for (const id of ['school-results', 'latest-inspection', 'mixed-age-learning', 'mixed-age-research']) {
    const answer = page.locator('details#' + id);
    await answer.locator(':scope > summary').tap();
    await expect(answer).toHaveAttribute('open', '');
    await expect(answer.locator('p').first()).toBeVisible();
    expect(await answer.locator('a[href]').count()).toBeGreaterThan(0);
  }
  await page.locator('#latest-inspection a[href="evidence.html#source-inspection-2026"]').tap();
  await expect(page.locator('#source-inspection-2026')).toBeInViewport();
});

test('No JavaScript: optional sharing details and reviewed ideas remain usable', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/feedback.html');
  await expect(page.locator('#publication-options')).not.toHaveAttribute('open', '');
  await page.locator('#publication-options > summary').tap();
  await expect(page.locator('#display-name')).toBeVisible();
  await expect(page.locator('#allow-public')).not.toBeChecked();
  await page.locator('#suggestions > summary').tap();
  await expect(page.locator('#suggestions')).toHaveAttribute('open', '');
  await expect(page.locator('#suggestions a[href="suggestions.json"]')).toBeVisible();
  await page.locator('input[name="kind"][value="evidence"]').check();
  await page.locator('#message').fill('Synthetic source information entered without JavaScript.');
  await page.locator('#display-name').fill('Optional test alias');
  await page.locator('#allow-public').check();
  await page.locator('#feedback-form button[type="submit"]').tap();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('kind')).toBe('evidence');
  expect(submissions[0].get('display_name')).toBe('Optional test alias');
  expect(submissions[0].has('allow_public')).toBe(true);
});

test('No JavaScript: all FAQ answers retain native disclosure and official routes', async ({ page }) => {
  await page.goto('/faq.html');
  await expect(page.locator('#faq-search')).toBeHidden();
  const answers = page.locator('main details');
  await expect(answers).toHaveCount(16);
  for (const answer of await answers.all()) {
    await expect(answer).toBeVisible();
    await answer.locator(':scope > summary').tap();
    await expect(answer).toHaveAttribute('open', '');
    await expect(answer.locator('p').first()).toBeVisible();
    expect(await answer.locator('a[href]').count()).toBeGreaterThan(0);
  }
});

test('No JavaScript: past meeting is absent on arrival and old links provide a reference route', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#meeting-invitation')).toBeHidden();
  await page.goto('/index.html#meeting-invitation');
  await expect(page.locator('#meeting-invitation')).toBeVisible();
  await expect(page.locator('#meeting-invitation')).toContainText('date has passed');
  await page.locator('#meeting-invitation a[href="proposal.html#school-meeting"]').tap();
  await expect(page).toHaveURL(/proposal\.html#school-meeting$/);
  await expect(page.locator('#school-meeting')).toBeInViewport();
});

test('No JavaScript: the parent plan, session dates and additional actions are available', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('.parent-plan-spotlight a').tap();
  await expect(page.locator('#parent-plan-title')).toBeInViewport();
  await expect(page.locator('#parent-plan #prep-sessions, #parent-plan #plan-attend')).toHaveCount(0);
  await page.locator('#prep-sessions > summary').tap();
  await expect(page.locator('#prep-sessions')).toContainText('Friday 25 September');
  await expect(page.locator('#prep-sessions')).toContainText('Monday 28 September');
  await expect(page.locator('#plan-respond')).toContainText('16 October');
  await page.getByRole('navigation', { name: 'Choose a parent action' }).getByRole('link', { name: 'More ways to help' }).tap();
  await expect(page.locator('#plan-keep-going')).toBeInViewport();
  await page.locator('#more-parent-actions > summary').tap();
  await expect(page.locator('#more-parent-actions')).toHaveAttribute('open', '');
  await expect(page.locator('#more-parent-actions').getByRole('link', { name: 'Find your MP' })).toBeVisible();
  await page.locator('.parent-reassurance a[href="faq.html#school-places"]').tap();
  await expect(page.locator('#school-places')).toBeInViewport();
  await page.locator('#choose-school > summary').tap();
  await expect(page.locator('#choose-school')).toContainText('normal admissions');
});

test('No JavaScript: research keeps all cases, graphics, evidence notes and citations available', async ({ page }) => {
  await page.goto('/lessons.html');
  await expect(page.locator('#lesson-filters')).toBeHidden();
  await expect(page.locator('.lesson-case')).toHaveCount(16);
  await page.locator('#exhibit-4 > summary').tap();
  await expect(page.locator('#exhibit-4 img')).toBeVisible();
  await page.locator('#exhibit-4 .lesson-data > summary').tap();
  await expect(page.locator('#exhibit-4 .lesson-data')).toContainText('£74,368');
  await page.locator('#case-st-bartholomew > summary').tap();
  await expect(page.locator('#case-st-bartholomew')).toContainText(/extra school term/);
  await page.goto('/lessons-sources.html');
  await expect(page.locator('.lesson-source')).toHaveCount(45);
  await page.locator('#X04 > summary').tap();
  await expect(page.locator('#X04')).toHaveAttribute('open','');
});

test('No JavaScript: shared research links land still before a graphic or source is opened', async ({ page }) => {
  await page.goto('/lessons.html#visual-guide');
  await expectStillArrival(page, '#visual-guide');
  await page.locator('#exhibit-1 > summary').tap();
  await expect(page.locator('#exhibit-1')).toHaveAttribute('open','');
  await page.goto('/lessons-sources.html#X04');
  await expectStillArrival(page, '#X04');
  await page.locator('#X04 > summary').tap();
  await expect(page.locator('#X04')).toHaveAttribute('open','');
});

test('No JavaScript: video guidance and external upload route remain available', async ({ page }) => {
  await page.goto('/letters.html');
  await page.locator('main a[href="videos.html#upload"]').tap();
  await expect(page.locator('#upload-step-two')).toContainText('No account needed');
  const destination = await page.locator('#video-upload-link').getAttribute('href');
  await page.route(destination, route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Fictional permission handoff</title><p>No upload sent.</p>'}));
  await expect(page.locator('#upload-help')).toHaveAttribute('open','');
  for (const id of ['recording-tips','video-choices','prompt-title','process-title']) await expect(page.locator('#'+id)).toBeVisible();
  await page.locator('#upload-help summary').tap();
  await expect(page.locator('#upload-help')).not.toHaveAttribute('open','');
  await page.locator('#upload-help summary').tap();
  await expect(page.locator('#upload-help')).toHaveAttribute('open','');
  await page.locator('#video-upload-link').tap();
  await expect(page).toHaveURL(destination);
});


test('No JavaScript: the named parent action plan is visible on arrival', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/index.html');
  const plan = page.getByRole('complementary', { name: 'Parent action plan', exact: true }).getByRole('link', { name: 'Parent action plan', exact: true });
  await expect(plan).toBeInViewport({ ratio: 1 });
  await plan.tap();
  await expect(page).toHaveURL(/proposal\.html#parent-plan$/);
  await expect(page.locator('#parent-plan-title')).toBeInViewport();
});

test('No JavaScript: former homepage fragments offer an explicit route to the moved content', async ({ page }) => {
  // Independently pinned public links, including a detail nested in a disclosure.
  for (const [id, destination] of [
    ['records', 'evidence.html'],
    ['source-inspection-2026', 'evidence.html'],
    ['source-lessons-report', 'evidence.html'],
    ['earlier-record', 'evidence.html'],
    ['gaps', 'evidence.html'],
    ['method', 'evidence.html'],
    ['options', 'options.html'],
    ['option-enrolment', 'options.html'],
    ['crowdfunding-recipient', 'options.html'],
  ]) {
    await page.goto('/index.html#' + id);
    const fallback = page.locator('.legacy-route#' + id);
    await expect(fallback).toBeInViewport();
    const link = fallback.locator(`a[href="${destination}#${id}"]`);
    await expect(link).toHaveAccessibleName(/Continue/i);
    await link.tap();
    await expect(page).toHaveURL(new RegExp(destination.replace('.', '\\.') + '#' + id + '$'));
    if (id === 'crowdfunding-recipient') {
      const details = page.locator('#crowdfunding-recipient').locator('xpath=ancestor::details[1]');
      if (!(await details.evaluate(element => element.open))) await details.locator(':scope > summary').tap();
    }
    if (id === 'earlier-record' && !(await page.locator('#earlier-record').evaluate(element => element.open))) {
      await page.locator('#earlier-record > summary').tap();
    }
    await expect(page.locator('#' + id)).toBeVisible();
  }
});

test('No JavaScript: the exact video QR upload address keeps a working permission handoff', async ({ page }) => {
  await page.goto('/videos.html#upload');
  await expect(page).toHaveURL(/\/videos\.html#upload$/);
  await expect(page.locator('#upload')).toBeInViewport();
  await expect(page.locator('#upload .video-council-note')).toContainText('not an official council response');
  // Without scripts, the complete main action remains in view on arrival.
  await expect(page.locator('#video-upload-link')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#upload .video-council-note a').first()).toHaveAttribute('href', 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform');
  await expect(page.locator('.video-three')).toContainText('Adults only. Keep children off camera.');
  await expect(page.locator('#upload-step-two')).toContainText('No account needed');
  const link = page.locator('#video-upload-link');
  const destination = await link.getAttribute('href');
  await page.route(destination, route => route.fulfill({ contentType: 'text/html', body: '<h1>Fictional video permission handoff</h1><p>No upload sent.</p>' }));
  await link.tap();
  await expect(page).toHaveURL(destination);
  await page.goBack();
  await expect(page).toHaveURL(/\/videos\.html#upload$/);
  await expect(page.locator('#upload')).toBeInViewport();
  await expect(page.locator('main a[href="letters.html#letter-form"]').last()).toBeVisible();
});

test('No JavaScript: video publication purpose and upload support survive direct arrival', async ({ page, baseURL }) => {
  await page.goto('/videos.html#upload');
  await expect(page.locator('#upload')).toContainText('YouTube permission required');
  await expect(page.locator('#upload')).toContainText('News-media and paid-ads permissions optional');
  await expect(page.locator('#resume-instructions')).toContainText('including any earlier private-only choice');
  await expect(page.locator('#private-video-alternative')).toHaveCount(0);
  await page.locator('#upload-help a[href="about.html#contact"]').last().tap();
  await expect(page).toHaveURL(/about.html#contact$/);
});

test('No JavaScript: old source links and council charts remain exposed after simplification', async ({ page }) => {
  await page.goto('/evidence.html#source-inspection-2026');
  await expect(page.locator('#source-library')).toHaveAttribute('open', '');
  await expect(page.locator('#source-inspection-2026')).toBeInViewport();
  await expect(page.locator('#source-grid .source-card:visible')).toHaveCount(61);
  await expect(page.locator('.school-roll-chart .source-card')).toHaveCount(0);
  await page.goto('/evidence.html#school-roll-title');
  await expect(page.locator('#school-roll-title')).toBeInViewport();
  await expect(page.locator('#council-figures')).toHaveAttribute('open', '');
});


test('No JavaScript: Current Kew findings retain access to London cases and source search', async ({ page }) => {
  await page.goto('/evidence.html#records');
  const findings = page.locator('#london-findings');
  await expect(page.locator('#kew-findings-title')).toBeInViewport();
  await page.locator('#kew-findings a[href="#london-findings"]').tap();
  await expect(findings.getByRole('heading', { name: 'Four London schools kept teaching.' })).toBeInViewport();
  await expect(findings).toContainText('Two adjudications in 2025');
  await expect(findings).toContainText('continued as an academy');
  await expect(findings.locator('.finding-stories article')).toHaveCount(3);
  await expect(findings.locator('details')).toHaveCount(0);
  await findings.locator('a[href="#source-search"]').tap();
  await expect(page.locator('#record-search')).toBeInViewport();
  await expect(page.locator('.source-card:visible')).toHaveCount(61);
  await page.goBack();
  await expect(page.locator('#london-findings-title')).toBeInViewport();
  await findings.locator('a[href="lessons.html#case-st-john"]').tap();
  await expect(page.locator('#case-st-john')).toBeInViewport();
  await expect(page.locator('#case-st-john')).toContainText('St John the Divine');
});

test('No JavaScript: researched demand and cost details open natively and retain their limits', async ({ page }) => {
  await page.goto('/evidence.html#records');
  for (const [id, fact, limit] of [
    ['kew-demand', '598', 'not an observed forecast error'],
    ['kew-costs', '£42.937 million', 'does not establish a PFI or land motive'],
  ]) {
    await page.locator(`#kew-findings a[href="#${id}"]`).tap();
    const detail = page.locator('#' + id);
    await expect(detail).toBeInViewport();
    if (await detail.getAttribute('open') === null) await detail.locator('summary').tap();
    await expect(detail).toHaveAttribute('open', '');
    await expect(detail).toContainText(fact);
    await expect(detail).toContainText(limit);
    await page.goBack();
    await expect(page).toHaveURL(/evidence\.html#records$/);
  }
  const invite = page.locator('#kew-findings .finding-meaning');
  await expect(invite).toContainText('identifying child information');
  await invite.getByRole('link', { name: 'Share one dated public record' }).tap();
  await expect(page.locator('#feedback-form')).toBeInViewport();
  await expect(page.locator('input[name="kind"][value="evidence"]')).toBeVisible();
  // Without scripts, all categories and permission choices remain native.
});

test('No JavaScript: received budget source and HTML figures remain reachable', async ({ page }) => {
  await page.goto('/evidence.html#source-search');
  await expect(page.locator('#type-filter')).toHaveValue('');
  await page.goto('/evidence.html#obtained-budget');
  await page.locator('#obtained-budget a[href="understand.html#budget-forecast"]').tap();
  const forecast = page.locator('#budget-forecast');
  if (await forecast.getAttribute('open') === null) await forecast.locator('summary').tap();
  await expect(forecast.locator('table')).toBeVisible();
  await expect(page.locator('a[href="kew-budget-summary-2026.pdf"]')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/evidence\.html#obtained-budget$/);
});

test('No JavaScript: full budget forecast has a native opening route from the FAQ', async ({ page }) => {
  await page.goto('/faq.html#deficit-meaning');
  const answer = page.locator('#deficit-meaning');
  if (await answer.getAttribute('open') === null) await answer.locator('summary').tap();
  await answer.locator('a[href="understand.html#budget-forecast"]').tap();
  const forecast = page.locator('#budget-forecast');
  await expect(forecast.locator('summary')).toBeInViewport();
  // Fragment auto-reveal differs between browsers; the native summary works either way.
  if (await forecast.getAttribute('open') === null) await forecast.locator('summary').tap();
  await expect(forecast.locator('table')).toBeVisible();
  await expect(forecast).toContainText('£212,417');
  await expect(forecast).toContainText('explains the earlier £1 difference');
  await page.goBack();
  await expect(page).toHaveURL(/faq\.html#deficit-meaning$/);
});

test('No JavaScript: the Parent action plan opens with its own response button in view', async ({ page }) => {
  await page.goto('/proposal.html#parent-plan');
  await expect(page.locator('#parent-plan-title')).toBeInViewport({ ratio: 1 });
  const respond = page.locator('#parent-plan .parent-plan-respond a');
  await expect(respond).toHaveAttribute('href', 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform');
  await expect(respond).toBeInViewport({ ratio: 1 });
});

test('No JavaScript: the homepage shows the Parent action plan and the response button on arrival', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('.parent-plan-spotlight a')).toBeInViewport({ ratio: 1 });
  const respond = page.locator('#top .button.primary');
  await expect(respond).toHaveAttribute('href', 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform');
  await expect(respond).toBeInViewport({ ratio: 1 });
  // The saved-search note for old evidence links stays available below the hero.
  await expect(page.locator('.saved-search-note a[href="evidence.html#records"]')).toBeVisible();
});

test('No JavaScript: the Menu opens Share a video at its permission step', async ({ page }) => {
  await page.goto('/letters.html');
  await page.locator('.mobile-menu > summary').tap();
  await page.locator('.mobile-menu').getByRole('link', { name: 'Share a video', exact: true }).tap();
  await expect(page).toHaveURL(/videos\.html#upload$/);
  await expect(page.locator('#video-upload-link')).toBeInViewport({ ratio: 1 });
});

for (const id of ['prompt-title','process-title','recording-tips','video-choices','upload-help']) {
  test(`No JavaScript: video #${id} guidance stays readable`,async({page})=>{
    await page.goto('/videos.html#'+id);
    await expect(page.locator('#upload-help')).toHaveAttribute('open','');
    await expect(page.locator('#'+id)).toBeInViewport();
  });
}
test('No JavaScript: letters reading comes first and writing remains an ordinary anchor', async ({ page }) => {
  await page.goto('/letters.html');
  await expect(page.locator('#letters')).toBeVisible();
  await expect(page.locator('#letters noscript a')).toHaveAttribute('href', 'letters.json');
  const write = page.locator('.invite-hero a[href="#letter-form"]');
  await write.tap();
  await expect(page).toHaveURL(/letters\.html#letter-form$/);
  await expect(page.locator('#message')).toBeInViewport();
  await expect(page.locator('#step-choose')).toBeVisible();
  await page.goto('/proposal.html#parent-plan');
  await page.locator('#plan-share a[href="letters.html#letter-form"]').tap();
  await expect(page.locator('#message')).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/proposal\.html#parent-plan$/);
});
