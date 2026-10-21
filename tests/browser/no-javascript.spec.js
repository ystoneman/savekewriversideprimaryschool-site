const { test, expect, pages, headerLinks, expectDestination, expectStillArrival, captureSubmissions } = require('./fixtures');

test('No JavaScript: a shared written-letter link reaches the full fictional letter', async ({ page }) => {
  const { execFileSync } = require('node:child_process');
  const fictional = execFileSync('python3', ['-c', "import sys; sys.path.insert(0,'.github/scripts'); from build_video_letters import render_fallback; print(render_fallback({'version':1,'letters':[{'id':'letter-012345abcdef','date':'2026-10-21','review':'Human reviewed','displayName':'Fictional parent','body':'A fictional written letter.\\n\\nIts complete ending remains available without scripts.'}]}))"], { encoding: 'utf8' });
  await page.route('**/letters.html', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/(<!-- video-letters-fallback:start -->)[\s\S]*?(<!-- video-letters-fallback:end -->)/, '$1\n' + fictional + '$2');
    await route.fulfill({response,body});
  });
  await page.goto('/letters.html#letter-012345abcdef');
  const card = page.locator('#letter-012345abcdef');
  await expect(card.locator('h3')).toBeInViewport();
  await expect(card).toContainText('Its complete ending remains available without scripts.');
  await expect(card.locator('.letter-permalink')).toHaveAttribute('href', 'https://savekewriversideprimaryschool.org/letters.html#letter-012345abcdef');
  await expect(card.locator('button')).toHaveCount(0);
  await card.getByRole('link', { name: 'Report this community letter or request removal' }).tap();
  await expect(page).toHaveURL(/feedback\.html\?kind=privacy&letter=letter-012345abcdef#feedback-form$/);
  await page.goBack();
  await expect(card.locator('h3')).toBeInViewport();
});

for (const [name, url] of [['TikTok', 'https://www.tiktok.com/@savekrps'], ['X', 'https://x.com/SaveKRPS']]) {
  test(`No JavaScript: campaign socials ${name} opens directly and supports Back`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/index.html');
    const socials = page.getByRole('region', { name: 'Amplify the campaign on our socials' });
    const link = socials.getByRole('link', { name, exact: true });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', url);
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<h1>Fictional campaign profile</h1>' }));
    await link.tap();
    await expect(page).toHaveURL(url);
    await page.goBack();
    await expect(link).toBeVisible();
    await expect(page.locator('.footer-discovery').getByRole('link', { name: 'Parent Voices on YouTube' })).toBeVisible();
  });
}

test('No JavaScript: campaign ownership, letter-data fallback and journalist guidance remain available', async ({ page }) => {
  await page.goto('/letters.html');
  await expect(page).toHaveTitle('Community letters | Save Kew Riverside Primary School Campaign');
  await expect(page.locator('.campaign-subtitle strong')).toHaveText('CAMPAIGN');
  await expect(page.locator('noscript a[href="letters.json"]')).toBeVisible();
  await page.locator('.invite-lead a[href="about.html#press"]').click();
  await expect(page.locator('#press h2')).toBeInViewport();
  await expect(page.locator('#press')).toContainText('independent parent-led website run by Yann Stoneman');
  await page.locator('#press a[href="#contact"]').click();
  await expect(page.locator('#contact > h2')).toBeInViewport();
});

test('No JavaScript: a video letter retains its watch and private removal links', async ({ page }) => {
  await page.route('**/letters.html', async route => {
    const response = await route.fetch();
    const fictional = '<article id="letter-012345abcdef"><h3>Parent voice</h3><p>Video letter · Human reviewed · Opinion</p><div class="letter-source"><p>Published on Save Kew Riverside Primary School Campaign · Independent and parent-led</p><div class="letter-source-actions"><a class="letter-permalink" href="https://savekewriversideprimaryschool.org/letters.html#letter-012345abcdef">savekewriversideprimaryschool.org</a></div></div><a href="https://www.youtube.com/watch?v=AbC0123_-xy">Watch on YouTube</a><a href="feedback.html?kind=privacy&amp;letter=letter-012345abcdef#feedback-form">Report this video letter or request removal</a></article>\n';
    const html = (await response.text()).replace(/(<!-- video-letters-fallback:start -->)[\s\S]*?(<!-- video-letters-fallback:end -->)/, '$1\n' + fictional + '$2');
    await route.fulfill({response, body: html});
  });
  await page.goto('/letters.html#letters');
  const card = page.locator('#letter-012345abcdef');
  await expect(card).toContainText('Video letter · Human reviewed · Opinion');
  await expect(card.locator('.letter-source')).toContainText('Independent and parent-led');
  await expect(card.locator('.letter-permalink')).toHaveAttribute('href', 'https://savekewriversideprimaryschool.org/letters.html#letter-012345abcdef');
  await expect(card.getByRole('link', {name: 'Watch on YouTube'})).toHaveAttribute('href', 'https://www.youtube.com/watch?v=AbC0123_-xy');
  await expect(page.locator('iframe')).toHaveCount(0);
  await card.getByRole('link', {name: 'Report this video letter or request removal'}).tap();
  await expect(page).toHaveURL(/feedback\.html\?kind=privacy&letter=letter-012345abcdef#feedback-form$/);
});

test('No JavaScript: page identity and native section routes retain nested content and recovery', async ({ page }) => {
  // Supporting research remains outside the five-page Menu and keeps its section chooser.
  await page.goto('/options.html');
  await expect(page.locator('.page-name')).toHaveText('Ways to keep Kew open');
  await expect(page.locator('.archive-flag, .archive-banner')).toHaveCount(0);
  await expect(page.locator('.section-copy')).toBeHidden();
  const sections = page.locator('.page-sections');
  await sections.locator(':scope > summary').tap();
  await sections.locator('a[data-section-id="option-crowdfunding"]').tap();
  await expect(page).toHaveURL(/options\.html#option-crowdfunding$/);
  await expect(page.locator('#option-crowdfunding > details.option-card')).toHaveAttribute('open', '');
  await expect(page.locator('#option-crowdfunding .option-first')).toBeVisible();
  await expect(page.locator('#option-crowdfunding')).toBeInViewport();
  // Leaving from the reading position should return to that section.
  const fundingQuestion = page.locator('#crowdfunding-funding-needed');
  if (await fundingQuestion.locator('details').getAttribute('open') === null) await fundingQuestion.locator('summary').tap();
  await expect(page.locator('.funding-questions')).toContainText('Funding ideas go privately to Yann, not the council.');
  await fundingQuestion.locator('a').tap();
  await expect(page).toHaveURL(/feedback\.html\?kind=crowdfunding&question=funding-needed#feedback-form$/);
  await page.goBack();
  await expect(page).toHaveURL(/options\.html#option-crowdfunding$/);
  await expect(page.locator('#option-crowdfunding')).toBeInViewport();
  const menu = page.locator('.mobile-menu');
  await menu.locator(':scope > summary').tap();
  // Supporting pages do not add Menu links or a misleading current-page highlight.
  expect(await menu.locator('a').allTextContents()).toEqual(['Home', 'Dates, leaflet & FAQs', 'Get involved', 'Campaign updates', 'About & contact', 'Watch Parent Voices', 'Book an Open Day']);
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(0);
  await expect(menu.locator('.mobile-page-note')).toContainText('Supporting research');
  await menu.getByRole('link', { name: 'Dates, leaflet & FAQs', exact: true }).tap();
  await expect(page).toHaveURL(/dates\.html$/);
  await expect(page.locator('h1')).toHaveText('Dates, leaflet & FAQs');
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

test('No JavaScript: Dates, leaflet & FAQs is a direct Menu route to the council documents and timetable', async ({ page }) => {
  await page.goto('/index.html');
  const menu = page.locator('.mobile-menu');
  const dates = menu.getByRole('link', { name: 'Dates, leaflet & FAQs', exact: true });
  await menu.locator(':scope > summary').tap();
  await expect(dates).toBeVisible();
  await expect(dates).toHaveAttribute('href', 'dates.html');
  await dates.tap();
  await expect(page).toHaveURL(/dates\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dates, leaflet & FAQs');
  await expect(page.locator('.mobile-menu a[href="dates.html"]')).toHaveAttribute('aria-current', 'page');
  // Without scripts the deadline is stated with its date, and everything is visible without a disclosure.
  await expect(page.locator('#deadline')).toContainText('16 October 2026');
  for (const href of ['kew_riverside_consultation_leaflet.pdf', 'school_organisation_kew_riverside_faq.pdf', 'school_organisation_consultation_faq.pdf', 'kew_riverside_consultation']) {
    await expect(page.locator(`#council-documents .council-document-list a[href$="${href}"]`)).toBeVisible();
  }
  await expect(page.locator('#timetable .council-timetable tbody tr')).toHaveCount(8);
  await expect(page.locator('#timetable .council-timetable')).toBeVisible();
  // Slim-site decision (13 October 2026): live pages no longer have an "On this page" chooser.
  await expect(page.locator('.page-sections')).toHaveCount(0);
  // Former homepage fragments for the overview and dates reach the new page natively.
  for (const [id, destination] of [['overview', 'dates.html#council-documents'], ['quick-answers', 'dates.html#council-documents'], ['next-dates', 'dates.html#timetable']]) {
    await page.goto('/index.html#' + id);
    const fallback = page.locator('.legacy-route#' + id);
    await expect(fallback).toBeInViewport();
    await fallback.locator(`a[href="${destination}"]`).tap();
    await expect(page).toHaveURL(new RegExp(destination.replace('.', '\\.') + '$'));
    await expect(page.locator(destination.slice(destination.indexOf('#')) + ' h2')).toBeInViewport();
  }
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
  await expect(page.locator('.options-response-button')).toHaveCount(0);

  await expect(page.locator('#options-findings-title')).toBeVisible();
  await expect(page.locator('.action-card > details.option-card[open]')).toHaveCount(6);
  await expect(page.locator('.options-school-enquiry')).toHaveCount(0);
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
    const openDay = 'https://docs.google.com/forms/d/e/1FAIpQLSfwTdpsQB5HOlbJxumjINzFjWiZZCshEHUIrkgXlUDCBBPGrw/viewform';
    await page.route(openDay, route => route.fulfill({ contentType: 'text/html', body: '<main><h1>Open Day booking intercepted locally</h1></main>' }));
    for (const href of headerLinks(file, 'mobile')) {
      await page.goto('/' + file);
      await page.locator('.mobile-menu summary').tap();
      if (href.endsWith('.pdf')) {
        const [download]=await Promise.all([page.waitForEvent('download'),page.locator(`.mobile-menu a[href="${href}"]`).tap()]);
        expect(download.suggestedFilename()).toBe(href==='response-checklist.pdf'?'kew-riverside-response-checklist.pdf':href);
        expect(await download.failure()).toBeNull();
      } else {
        await page.locator(`.mobile-menu a[href="${href}"]`).tap();
        if (href === 'visit/index.html') {
          await expect(page).toHaveURL(openDay);
          await expect(page.getByRole('heading')).toHaveText('Open Day booking intercepted locally');
        } else {
          await expectDestination(page, href, baseURL);
        }
      }
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

test('No JavaScript: archived Evidence still exposes the full report and web research', async ({ page }) => {
  // Owner correction: dated references return only within the optional Home footer.
  await page.goto('/index.html');
  await expect(page.locator('.mobile-menu a[href^="evidence.html"], .mobile-menu a[href^="lessons.html"], .mobile-menu a[href^="understand.html"]')).toHaveCount(0);
  await page.locator('footer #supporting-research > summary').tap();
  await page.locator('footer #supporting-research a[href="evidence.html#records"]').tap();
  await page.locator('#research-shortcut').tap();
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
  await report.locator('a[href="lessons.html"]').tap();
  await expect(page).toHaveURL(/lessons\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What can other schools teach us?');
  await page.goto('/evidence.html?q=impossible-report-search&type=Inspection#source-lessons-report');
  await expect(report).toBeVisible();
  await expect(report).toBeInViewport();
  await expect(page.locator('.source-card:visible')).toHaveCount(61);
});

test('No JavaScript: budget and forecast answers, sources and optional data remain readable', async ({ page }) => {
  // Understand left the homepage footer on 13 October 2026 (slim-site decision); the archived page opens directly.
  await page.goto('/understand.html');
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

test('No JavaScript: the thank-you page works without scripts and routes onward through Get involved', async ({ page }) => {
  await page.goto('/sent.html');
  await expect(page.locator('#sent-title')).toHaveText('Thank you.');
  await expect(page.locator('#sent-lead')).toBeVisible();
  for (const id of ['#official-card', '#share-card', '#sent-more']) await expect(page.locator(id), id).toBeHidden();
  // Slim-site decision (13 October 2026): the header participation tiles and their arrival cue were removed.
  // Letters and ideas are reached through Get involved and every footer instead.
  await expect(page.locator('.participation-nav')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Take part' })).toHaveCount(0);
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Community letters', exact: true })).toHaveAttribute('href', 'letters.html');
  await expect(footer.getByRole('link', { name: 'Share ideas', exact: true })).toHaveAttribute('href', 'feedback.html');
  await expect(page.getByRole('link', { name: 'Back to the homepage' })).toBeVisible();
  const menu = page.locator('.mobile-menu');
  await menu.locator(':scope > summary').tap();
  await expect(menu.getByRole('link', { name: 'Next steps', exact: true })).toHaveAttribute('aria-current', 'page');
  await menu.getByRole('link', { name: 'Get involved', exact: true }).tap();
  await expect(page).toHaveURL(/get-involved\.html$/);
  await page.locator('#share-your-story a[href="letters.html#letter-form"]').tap();
  await expect(page).toHaveURL(/letters\.html#letter-form$/);
  await expect(page.locator('#message')).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/get-involved\.html$/);
  await page.locator('#help a[href="feedback.html"]').tap();
  await expect(page).toHaveURL(/feedback\.html$/);
  await expect(page.locator('#feedback-form')).toBeVisible();
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
  // The homepage Menu shortcut left with the shared Menu (13 October 2026); Evidence keeps the contextual entry.
  await page.goto('/evidence.html');
  await page.getByRole('complementary', { name: 'How does Kew Riverside Primary School compare?' }).locator('a[href="understand.html#learning-and-results"]').tap();
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
  await expect(visit.locator('a[href="visit/index.html"]')).toBeVisible();
  await page.goto('/faq.html#learning');
  await page.locator('#school-results > summary').tap();
  await page.locator('#school-results a[href="understand.html#learning-and-results"]').tap();
  await expect(page.locator('#learning-and-results')).toBeInViewport();
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
  const answers = page.locator('main .faq-answer');
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

test('No JavaScript: Get involved offers every action and the archived parent plan still opens directly', async ({ page }) => {
  // Slim-site decision (13 October 2026): the homepage's secondary action now opens Get involved, not the parent plan.
  await page.goto('/index.html');
  await page.locator('.home-plan').tap();
  await expect(page).toHaveURL(/get-involved\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get involved');
  const respond = page.locator('#respond');
  await expect(respond.locator('[data-stage="closed"]')).toBeVisible();
  await expect(respond.locator('[data-stage="open"]')).toBeHidden();
  await expect(respond).toContainText('16 October 2026');
  expect(await page.locator('main > section').last().getAttribute('id')).toBe('respond');
  const [checklist] = await Promise.all([page.waitForEvent('download'), respond.locator('a[href="response-checklist.pdf"]').tap()]);
  expect(checklist.suggestedFilename()).toBe('kew-riverside-response-checklist.pdf');
  expect(await checklist.failure()).toBeNull();
  await expect(page.locator('#petition a[href="https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249"]')).toBeVisible();
  await expect(page.locator('#petition time')).toHaveAttribute('datetime', '2027-01-13');
  await expect(page.locator('#petition a.primary')).toHaveAccessibleName('Sign petition by 13 Jan 2027');
  for (const href of ['https://cabnet.richmond.gov.uk/mgMemberIndex.aspx?bcr=1', 'https://members.parliament.uk/FindYourMP']) await expect(page.locator(`#representatives a[href="${href}"]`)).toBeVisible();
  for (const href of ['letters.html#letter-form', 'letters.html']) await expect(page.locator(`#share-your-story a[href="${href}"]`)).toBeVisible();
  await expect(page.locator('#parent-video.recruitment-action a[href="videos.html#upload"]')).toBeVisible();
  await expect(page.locator('#share-your-story a[href="videos.html#upload"]')).toHaveCount(0);
  for (const href of ['feedback.html', 'mailto:savekrps@gmail.com']) await expect(page.locator(`#help a[href="${href}"]`)).toBeVisible();
  for (const href of ['qr/savekewriverside-home-qr.png', 'qr/savekewriverside-home-qr.svg']) await expect(page.locator(`#spread-the-word a[href="${href}"][download]`)).toBeVisible();
  await expect(page.locator('.page-sections')).toHaveCount(0);
  await page.goto('/get-involved.html#respond');
  await expect(page.locator('#respond-closed-title')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#respond')).toHaveAccessibleName('The consultation response deadline has passed');
  // The parent plan was archived in place; its own steps still work from a direct link.
  await page.goto('/proposal.html#parent-plan');
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


test('No JavaScript: the named Get involved action is visible on arrival', {tag:'@home-smoke'}, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/index.html');
  const involved = page.locator('.home-plan');
  await expect(involved).toBeVisible();
  await expect(involved).toHaveAccessibleName('Get involved');
  await expect(page.locator('#main-action')).toBeInViewport({ratio:1});
  // Since 13 October 2026 (slim-site decision) this action opens Get involved instead of the archived parent plan.
  await involved.tap();
  await expect(page).toHaveURL(/get-involved\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Get involved' })).toBeInViewport();
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
  await expect(page.locator('#upload')).toContainText('News-media and paid-ads choices are optional');
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

test('No JavaScript: the homepage has a date-safe council link, Help and manual Share', async ({ page }) => {
 await page.goto('/index.html');await expect(page.locator('.home-plan')).toBeVisible();
 const respond=page.locator('#main-action');await expect(respond).toHaveAttribute('href',/richmond.gov.uk.*kew_riverside_consultation/);
 await expect(respond).toHaveAccessibleName(/Check the council consultation/);await expect(page.locator('.intro')).toContainText('As of 12 October 2026');await expect(page.locator('.intro')).toContainText('Check the council’s latest position.');
 await page.locator('#share-fallback > summary').tap();await expect(page.getByLabel('Campaign link')).toHaveValue('https://savekewriversideprimaryschool.org/');
 await expect(page.locator('#share-trigger')).toBeHidden();
});

test('No JavaScript: Get involved and the footer open Share a video at its permission step', async ({ page }) => {
  // Slim-site decision (13 October 2026): Share a video left the Menu; Get involved and every footer link to it.
  await page.goto('/letters.html');
  const menu = page.locator('.mobile-menu');
  await menu.locator(':scope > summary').tap();
  await expect(menu.getByRole('link', { name: 'Share a video', exact: true })).toHaveCount(0);
  await menu.getByRole('link', { name: 'Get involved', exact: true }).tap();
  await page.locator('#parent-video.recruitment-action a[href="videos.html#upload"]').tap();
  await expect(page).toHaveURL(/videos\.html#upload$/);
  await expect(page.locator('#video-upload-link')).toBeInViewport({ ratio: 1 });
  await page.goto('/letters.html');
  await page.locator('footer').getByRole('link', { name: 'Share a video', exact: true }).tap();
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
  // Since 13 October 2026 (slim-site decision) the live letter entry is Get involved (Menu), not the archived parent plan.
  await page.locator('.mobile-menu > summary').tap();
  await page.locator('.mobile-menu').getByRole('link', { name: 'Get involved', exact: true }).tap();
  await expect(page).toHaveURL(/get-involved\.html$/);
  await page.locator('#share-your-story a[href="letters.html#letter-form"]').tap();
  await expect(page).toHaveURL(/letters\.html#letter-form$/);
  await expect(page.locator('#message')).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/get-involved\.html$/);
  await expect(page.locator('#share-your-story a[href="letters.html#letter-form"]')).toBeInViewport();
});

test('No JavaScript: petition is a dated direct action and school footer links need no disclosure',async({page})=>{
 await page.goto('/index.html');await expect(page.locator('#petition-action')).toHaveAccessibleName('Sign the petition');await expect(page.locator('#petition-note')).toContainText('13 January 2027');
 const petition='https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249';await page.route(petition,r=>r.fulfill({contentType:'text/html',body:'<h1>Fictional petition</h1>'}));await page.locator('#petition-action').tap();await expect(page).toHaveURL(petition);
 await page.goBack();const footer=page.locator('.footer-discovery');await footer.scrollIntoViewIfNeeded();await expect(footer.getByRole('link',{name:'Parent Voices on YouTube'})).toBeVisible();await expect(footer.getByRole('link',{name:'Visit our Open Days'})).toBeVisible();
});

// Preview correction keeps saved homepage campaign-case links usable without scripts.
for (const id of ['our-case', 'case-title']) {
  test(`No JavaScript: old campaign-case anchor ${id} reaches About`, async ({ page }) => {
    await page.goto('/index.html#' + id);
    const link = page.locator('#' + id + ' a');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator('#our-case')).toContainText('A funded, workable alternative has not yet been established.');
    await expect(page.locator('#case-title')).toBeInViewport();
  });
}

test('No JavaScript: optional research footer opens and its five references remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/index.html');
  const group=page.locator('footer #supporting-research');
  await expect(group).not.toHaveAttribute('open', '');
  await group.locator('summary').click();
  for (const [href, name] of [['questions.html#questions','Six questions worth asking'],['evidence.html#records','Evidence & original sources'],['understand.html#budget','School finances & closure costs'],['options.html#options','Ways to keep Kew open'],['lessons.html#key-lessons','Historical school cases']]) {
    await group.getByRole('link', { name, exact: true }).click();
    await expect(page.locator('.archive-flag, .archive-banner')).toHaveCount(0);
    await expect(page.locator('#'+href.split('#')[1])).toBeInViewport();
    await page.goBack();
    // Native Back may reload the static page; its disclosure remains operable.
    if (!(await group.evaluate(element => element.open))) await group.locator('summary').click();
    await expect(group).toHaveAttribute('open', '');
  }
});
