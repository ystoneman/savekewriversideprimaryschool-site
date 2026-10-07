const fs = require('node:fs/promises');
const { test, expect, expectDestination } = require('./fixtures');

const questions = {
  'school-places': ['choose-school', 'school-choice', 'apply-during-consultation'],
  learning: ['school-results', 'latest-inspection', 'mixed-age-learning', 'mixed-age-research'],
  money: ['deficit-meaning', 'deficit-build-up', 'crowdfunding-target'],
  decisions: ['decided', 'next-meeting', 'respond-deadline'],
  'taking-part': ['useful-response', 'letters-official', 'share-evidence'],
};
const questionIds = Object.values(questions).flat();
// A child's school place is many parents' first question, so it leads the six routes.
const entryRoutes = [
  'faq.html#school-places',
  'options.html',
  'proposal.html#timetable',
  'understand.html',
  'evidence.html#records',
  'feedback.html?kind=evidence#feedback-form',
];

async function activate(locator, hasTouch) {
  if (hasTouch) await locator.tap();
  else await locator.click();
}

test('Homepage: responsive copy keeps words separated on mobile and desktop', async ({ page }) => {
  const originalViewport = page.viewportSize();
  try {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/index.html');
      const story = page.locator('#top a[href="about.html#our-story"]');
      await expect(story).toBeVisible();
      await expect(story).toHaveAccessibleName(/family|story|chose/i);
      for (const [selector, wording] of [
        ['.discovery-heading > p', 'Shortcuts to pages and answers on this website.'],
        ['#visit-school .visit-school-action > p', 'page. Please check directly'],
      ]) {
        const copy = page.locator(selector);
        await expect(copy).toBeVisible();
        expect((await copy.innerText()).replace(/\s+/g, ' ').trim(), `${selector} rendered at ${width}px`).toContain(wording);
      }
    }
  } finally {
    if (originalViewport) await page.setViewportSize(originalViewport);
  }
});

test('Prospective families can enquire directly from Home and Options without a promised tour', async ({ page }) => {
  const schoolContact = 'https://www.kewriverside.richmond.sch.uk/page/?pid=525&title=Contact+Us';
  await page.goto('/index.html#visit-school');
  const homeVisit = page.locator('#visit-school');
  await expect(homeVisit).toContainText('what visits are available now');
  await expect(homeVisit).toContainText('Closure is proposed, not decided');
  await expect(homeVisit.locator('a.button.primary')).toHaveAttribute('href', schoolContact);
  await expect(homeVisit.locator('a[href="https://www.richmond.gov.uk/primary_school_admissions"]')).toBeVisible();

  await page.goto('/options.html#option-enrolment');
  const option = page.locator('#option-enrolment');
  await option.locator('.option-evidence > summary').click();
  await expect(option.locator('.option-evidence')).toHaveAttribute('open', '');
  await expect(option).toContainText('Ask the school what visits are available now');
  await expect(option).toContainText('applications and admissions can continue');
  await expect(option.locator('a[href^="https://www.kewriverside.richmond.sch.uk/page/"]').filter({ hasText: 'Ask the school about visits and places' })).toBeVisible();
});

test('Proposal presents six plain questions with children first and the official response independent', async ({ page }) => {
  await page.goto('/proposal.html#questions');
  const ids = ['question-continuity', 'question-learning', 'question-budget', 'question-closure-costs', 'question-demand', 'question-alternatives'];
  expect(await page.locator('#questions .question-list > article').evaluateAll(items => items.map(item => item.id))).toEqual(ids);
  for (const id of ids) {
    const item = page.locator('#' + id);
    await expect(item.getByRole('heading', { level: 3 })).toBeVisible();
    await expect(item.locator(':scope > p a[href$=".html"], :scope > p a[href*=".html#"]')).toHaveCount(1);
    await expect(item.locator(':scope > p a[href$=".html"], :scope > p a[href*=".html#"]')).toHaveAccessibleName(/\S/);
    await expect(item.locator('details')).toHaveCount(0);
  }
  const budget = page.locator('#question-budget');
  await expect(budget).toContainText(/March 2026/);
  await expect(budget).toContainText(/2028\/29/);
  await expect(page.locator('#questions')).toContainText(/respond without waiting for answers/i);
  await expect(page.locator('#plan-respond a.button.primary')).toHaveAttribute('href', /docs\.google\.com\/forms/);
});

test.describe('Government closure guidance on a 320 × 568 phone', () => {
  // Mobile emulation wraps text differently from a resized desktop window.
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  test('the response citation keeps the official response button fully on screen', async ({ page }) => {
    await page.goto('/proposal.html#plan-respond');
    await expect(page.locator('#plan-respond a.button.primary')).toBeInViewport({ ratio: 1 });
  });
});

test('Government closure guidance is cited at the point of use without adding response actions', async ({ page }) => {
  const guidance = 'https://assets.publishing.service.gov.uk/media/6a034409e71c4cdf4026bab8/Closing_maintained_schools_guidance_-_May_2026.pdf';
  await page.goto('/proposal.html#plan-respond');
  const respond = page.locator('#plan-respond');
  await expect(respond.locator(`a[href="${guidance}#page=6"]`)).toBeVisible();
  await expect(respond).toContainText('every view should be considered');
  await expect(respond.locator('a.button')).toHaveCount(1);
  await expect(page.locator(`#question-demand a[href="${guidance}#page=8"]`)).toBeVisible();
  await expect(page.locator(`#question-alternatives a[href="${guidance}#page=8"]`)).toBeVisible();
  await page.goto('/options.html#options');
  await page.locator('.response-detail > summary').click();
  await expect(page.locator(`.response-detail a[href="${guidance}#page=6"]`)).toBeVisible();
});

test('Options ranking links to the council’s published alternatives rather than site questions', async ({ page }) => {
  await page.goto('/options.html#options');
  await page.locator('.options-method > summary').click();
  await expect(page.locator('.ranking-method').getByRole('link', { name: /published reasons for not preferring/ })).toHaveAttribute(
    'href',
    'https://www.richmond.gov.uk/media/fxhbilws/kew_riverside_consultation_leaflet.pdf#page=6',
  );
});

test('Homepage: the retained meeting block marks the past date and leads to follow-up, source and details', async ({ page, hasTouch }) => {
  await page.clock.setFixedTime(new Date('2026-09-22T12:00:00Z'));
  await page.goto('/index.html');
  const invitation = page.locator('main #meeting-invitation');
  await expect(invitation).toBeVisible();
  await expect(invitation.getByRole('heading', { name: 'Follow up the September meeting.', exact: true })).toBeVisible();
  expect((await invitation.locator('time').innerText()).replace(/\s+/g, ' ')).toContain('Tuesday 29 September 2026');
  await expect(invitation).toContainText(/3[.:]30\s*p\.?m\.?/i);
  await expect(invitation).toContainText('Kew Riverside Primary School');
  await expect(invitation).toContainText('29 September date has passed');
  await expect(invitation).toContainText('outstanding questions in your consultation response');
  await expect(invitation.locator('a[href="proposal.html#parent-plan"]')).toBeVisible();
  await expect(invitation.locator('blockquote, .meeting-attribution')).toHaveCount(0);
  const position = await invitation.boundingBox();
  const hero = await page.locator('#top').boundingBox();
  const chooser = await page.locator('#find-your-way').boundingBox();
  expect(hero.y + hero.height).toBeLessThanOrEqual(position.y + 1);
  expect(position.y + position.height).toBeLessThanOrEqual(chooser.y + 1);
  await expect(invitation.locator('a[href="https://www.richmond.gov.uk/media/fxhbilws/kew_riverside_consultation_leaflet.pdf#page=8"]')).toBeVisible();
  await activate(invitation.locator('a[href="proposal.html#school-meeting"]'), hasTouch);
  await expect(page).toHaveURL(/proposal\.html#school-meeting$/);
  await expect(page.locator('#school-meeting')).toBeInViewport();
});

test.describe('Meeting invitation uses the London calendar date', () => {
  // A visitor outside the UK must still see the label for the school's day.
  test.use({ timezoneId: 'America/Los_Angeles' });
  for (const [date, label] of [
    ['2026-09-22T12:00:00Z', 'Next week’s meeting'],
    ['2026-09-28T12:00:00Z', 'Tomorrow’s meeting'],
    ['2026-09-29T12:00:00Z', 'Today’s meeting'],
    ['2026-09-30T12:00:00Z', null],
    ['2026-09-29T23:30:00Z', null],
  ]) {
    test(`${date}: ${label || 'invitation is over'}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(date));
      await page.goto('/index.html');
      const invitation = page.locator('#meeting-invitation');
      await expect(invitation).toHaveCount(1);
      if (label) {
        await expect(invitation).toBeVisible();
        await expect(page.locator('#meeting-relative')).toHaveText(label);
      } else {
        await expect(invitation).toBeHidden();
        await page.goto('/proposal.html#school-meeting');
        await expect(page.locator('#school-meeting')).toBeVisible();
        await expect(page.locator('#school-meeting')).toContainText(/29\s+September\s+2026/);
      }
    });
  }
});

test('Homepage: six clear entry routes lead to answers, dates, evidence and participation', async ({ page, hasTouch, baseURL }) => {
  await page.goto('/index.html');
  const routes = page.locator('#find-your-way .route-card');
  expect(await routes.evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(entryRoutes);
  expect((await routes.locator('.route-destination').allTextContents()).map(text => text.trim())).toEqual(['FAQ · School places', 'Ways to keep Kew open', 'Proposal & dates · Timeline', 'Numbers & results', 'Evidence', 'Share ideas']);
  for (const href of entryRoutes) {
    await page.goto('/index.html');
    const link = page.locator(`#find-your-way a[href="${href}"]`);
    await expect(link).toHaveAccessibleName(/\S/);
    await activate(link, hasTouch);
    await expectDestination(page, href, baseURL);
    if (href.includes('kind=evidence')) {
      await expect(page.locator('input[name="kind"][value="evidence"]')).toBeChecked();
      await expect(page.locator('#message')).toHaveValue('');
      await expect(page.locator('#allow-public')).not.toBeChecked();
    }
  }
});

test('Homepage: compact dates lead to the school meeting and official response route', async ({ page, hasTouch }) => {
  // Exercise this invitation before the meeting; the calendar-boundary test covers expiry.
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00Z'));
  await page.goto('/index.html');
  const notice = page.locator('#meeting-invitation');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/29\s+Sep(?:tember)?/i);
  await expect(notice).toContainText(/3[.:]30\s*p\.?m\.?/i);
  await expect(page.locator('#top')).toContainText(/16\s+Oct(?:ober)?/i);
  await expect(page.locator('#top')).toContainText(/propos/i);
  const official = page.locator('#top a[href^="https://docs.google.com/forms/"]');
  await expect(official).toHaveCount(1);
  await expect(official).toHaveAttribute('href', 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform');
  await activate(notice.locator('a[href="proposal.html#school-meeting"]'), hasTouch);
  await expect(page).toHaveURL(/proposal\.html#school-meeting$/);
  await expect(page.locator('#school-meeting')).toBeInViewport();
  await expect(page.locator('#school-meeting')).toContainText(/29\s+September/i);
  await activate(page.locator('#school-meeting a[href="feedback.html?kind=meeting#feedback-form"]'), hasTouch);
  await expect(page).toHaveURL(/feedback\.html\?kind=meeting#feedback-form$/);
  await expect(page.locator('input[name="kind"][value="meeting"]')).toBeChecked();
  await expect(page.locator('#meeting-context')).toBeVisible();
  await expect(page.locator('#meeting-context')).toContainText('does not put it on a meeting agenda or send it to the council');
  await expect(page.locator('#allow-public')).not.toBeChecked();
});

test('FAQ: every answer is a readable native disclosure with a useful destination', async ({ page, hasTouch }) => {
  await page.goto('/faq.html');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('main details')).toHaveCount(questionIds.length);
  for (const [section, ids] of Object.entries(questions)) {
    for (const id of ids) {
      const answer = page.locator(`#${section} details#${id}`);
      const summary = answer.locator(':scope > summary');
      await expect(answer).not.toHaveAttribute('open', '');
      await expect(summary).toHaveAccessibleName(/\S/);
      await activate(summary, hasTouch);
      await expect(answer).toHaveAttribute('open', '');
      await expect(answer.locator('p').first()).toBeVisible();
      expect(await answer.locator('a[href]').count()).toBeGreaterThan(0);
      await activate(summary, hasTouch);
      await expect(answer).not.toHaveAttribute('open', '');
    }
  }
});

test('FAQ: native answers work with the keyboard without moving focus', async ({ page }) => {
  await page.goto('/faq.html');
  const answer = page.locator('#choose-school');
  const summary = answer.locator(':scope > summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(answer).toHaveAttribute('open', '');
  await expect(answer.locator('p').first()).toBeVisible();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Space');
  await expect(answer).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
});

test('FAQ: search finds and opens matching answers, handles no results and resets', async ({ page, hasTouch }) => {
  await page.goto('/faq.html');
  const query = page.getByRole('searchbox', { name: 'Find an answer', exact: true });
  await expect(page.locator('#faq-search')).toBeVisible();
  await expect(page.locator('#faq-empty')).toBeHidden();
  await query.fill('deficit');
  await expect(page.locator('#deficit-meaning')).toBeVisible();
  await expect(page.locator('#deficit-meaning')).toHaveAttribute('open', '');
  await expect(page.locator('#choose-school')).toBeHidden();
  expect(await page.locator('main details:visible').count()).toBeLessThan(questionIds.length);
  await expect(page.locator('#faq-results')).toContainText(/answer|result/i);
  await query.fill('zz-no-matching-answer-zz');
  await expect(page.locator('main details:visible')).toHaveCount(0);
  await expect(page.locator('#faq-empty')).toBeVisible();
  for (const section of Object.keys(questions)) await expect(page.locator('#' + section)).toBeHidden();
  await activate(page.getByRole('button', { name: 'Clear search', exact: true }), hasTouch);
  await expect(query).toHaveValue('');
  await expect(page.locator('#faq-empty')).toBeHidden();
  await expect(page.locator('main details:visible')).toHaveCount(questionIds.length);
  await expect(page.locator('main details[open]')).toHaveCount(0);
});

test('FAQ: a direct answer link opens the intended answer and brings it into view', async ({ page }) => {
  await page.goto('/faq.html#deficit-meaning');
  const answer = page.locator('#deficit-meaning');
  await expect(answer).toHaveAttribute('open', '');
  await expect(answer).toBeInViewport();
  await expect(answer.locator('p').first()).toBeVisible();
});

test('FAQ: answer permalinks survive closing an answer and browser history navigation', async ({ page, hasTouch }) => {
  await page.goto('/faq.html');
  const answer = page.locator('#deficit-meaning');
  const summary = answer.locator(':scope > summary');
  await activate(summary, hasTouch);
  const permalink = answer.getByRole('link', { name: /^Link to this answer:/ });
  await expect(permalink).toHaveAttribute('href', '#deficit-meaning');
  await activate(permalink, hasTouch);
  await expect(page).toHaveURL(/faq\.html#deficit-meaning$/);
  await expect(answer).toHaveAttribute('open', '');
  await activate(summary, hasTouch);
  await expect(answer).not.toHaveAttribute('open', '');
  await page.goBack();
  await expect(page).toHaveURL(/faq\.html$/);
  await page.goForward();
  await expect(page).toHaveURL(/faq\.html#deficit-meaning$/);
  await expect(answer).toHaveAttribute('open', '');
  await expect(answer).toBeInViewport();
});

test('FAQ: topic links restore answers hidden by a previous search', async ({ page, hasTouch }) => {
  await page.goto('/faq.html');
  await page.getByRole('searchbox', { name: 'Find an answer', exact: true }).fill('zz-no-matching-answer-zz');
  await expect(page.locator('#school-places')).toBeHidden();
  await activate(page.locator('.faq-topics a[href="#school-places"]'), hasTouch);
  await expect(page.locator('#faq-query')).toHaveValue('');
  await expect(page.locator('#school-places')).toBeVisible();
  await expect(page.locator('#school-places')).toBeInViewport();
  await expect(page.locator('main details:visible')).toHaveCount(questionIds.length);
  await expect(page.locator('#faq-empty')).toBeHidden();
});

test('Evidence: the earlier public record stays available behind its disclosure and direct link', async ({ page, hasTouch }) => {
  await page.goto('/evidence.html#timeline');
  const history = page.locator('#earlier-record');
  await expect(history).not.toHaveAttribute('open', '');
  await activate(history.locator(':scope > summary'), hasTouch);
  await expect(history).toHaveAttribute('open', '');
  await expect(history.locator('.timeline')).toBeVisible();
  await activate(history.locator('a[href="#source-inspection-2003"]'), hasTouch);
  await expect(page.locator('#source-inspection-2003')).toBeInViewport();
  await page.goto('/evidence.html#earlier-record');
  await expect(history).toHaveAttribute('open', '');
  await expect(history.locator('.timeline')).toBeVisible();
});

test('Proposal: the future timeline separates current participation from conditional later stages', async ({ page }) => {
  await page.goto('/proposal.html#timetable');
  const stages = page.locator('#future-timeline > li');
  expect(await stages.evaluateAll(items => items.map(item => item.dataset.stage))).toEqual([
    'consultation', 'meeting', 'proceed', 'notice', 'decision', 'implementation',
  ]);
  await expect(page.locator('#future-timeline')).toHaveJSProperty('tagName', 'OL');
  await expect(stages.nth(0)).toContainText(/16\s+October/i);
  await expect(stages.nth(1)).toHaveAttribute('id', 'school-meeting');
  await expect(stages.nth(1)).toContainText(/29\s+September/i);
  await expect(stages.nth(1)).toContainText(/3[.:]30\s*p\.?m\.?/i);
  await expect(stages.nth(0)).toContainText('21 September start is from the family letter');
  await expect(page.locator('#timetable .date-note')).toContainText('we have not located a public copy');
  await expect(page.locator('#timetable .timeline-provenance')).toContainText('planned and conditional');
  await expect(stages.nth(1).locator('a[href*="kew_riverside_consultation_leaflet.pdf#page=8"]')).toBeVisible();
  for (const name of ['proceed', 'notice', 'decision', 'implementation']) {
    await expect(page.locator(`#future-timeline [data-stage="${name}"]`)).toContainText(/if|could|would|propos|subject|indicative/i);
  }
  await expect(page.locator('#future-timeline [data-stage="implementation"]')).toContainText(/2027/);
  await expect(page.locator('#future-timeline [data-stage="implementation"] .stage-label')).toContainText('ONLY IF APPROVED');
  await expect(page.locator('#future-timeline [data-stage="decision"]')).toContainText('could still be rejected');
});

test('Parent plan: homepage invitation and meeting details both lead to preparation', async ({ page, hasTouch }) => {
  await page.clock.setFixedTime(new Date('2026-09-22T12:00:00Z'));
  await page.goto('/index.html');
  const invitation = page.locator('#meeting-invitation');
  // The short invitation delegates preparation details to the named plan.
  await expect(invitation.getByRole('link', { name: 'Parent action plan', exact: true })).toBeVisible();
  await activate(invitation.getByRole('link', { name: 'Parent action plan', exact: true }), hasTouch);
  await expect(page).toHaveURL(/proposal\.html#parent-plan$/);
  await expect(page.locator('#parent-plan-title')).toBeInViewport();
  await expect(page.locator('#parent-plan')).toContainText('Closure is proposed, not decided.');
  for (const [name, id] of [['Past PTA sessions', 'prep-sessions'], ['Letters', 'plan-share'], ['Past council meeting', 'plan-attend'], ['Your response', 'plan-respond'], ['More ways to help', 'plan-keep-going']]) {
    await activate(page.getByRole('navigation', { name: 'Choose a parent action' }).getByRole('link', { name, exact: true }), hasTouch);
    await expect(page).toHaveURL(new RegExp('#' + id + '$'));
    await expect(page.locator('#' + id)).toBeInViewport();
  }
  await page.goto('/proposal.html#school-meeting');
  await activate(page.locator('#school-meeting a[href="#parent-plan"]'), hasTouch);
  await expect(page.locator('#parent-plan-title')).toBeInViewport();
});

test('Parent plan: correct PTA dates, the video route for new families and official deadline stay distinct', async ({ page, hasTouch, baseURL }) => {
  await page.goto('/proposal.html#parent-plan');
  const prep = page.locator('#prep-sessions');
  await expect(prep).toContainText('school grounds');
  const sessions = prep.locator('.prep-session-dates > li');
  await expect(sessions).toHaveCount(3);
  for (const [index, date, time, room] of [
    [0, 'Friday 25 September', '9am', 'School Hall'],
    [1, 'Friday 25 September', '3.30pm', 'Rainbow Room'],
    [2, 'Monday 28 September', '9am', 'School Hall'],
  ]) {
    await expect(sessions.nth(index)).toContainText(date);
    await expect(sessions.nth(index)).toContainText(time);
    await expect(sessions.nth(index)).toContainText(room);
  }
  await expect(prep).not.toContainText('3.20pm');
  await expect(prep).toContainText('separate from the council meeting');
  await expect(page.locator('#plan-attend')).toContainText('Tuesday 29 September · 3.30pm');
  await expect(page.locator('#plan-respond')).toContainText('You can respond now if you are ready.');
  await expect(page.locator('#plan-respond')).toContainText('16 October');
  await expect(page.locator('#plan-respond')).toContainText('does not replace your own official response');
  // The video route sits with longer-term help, not beside the council response.
  await expect(page.locator('#plan-share a[href="videos.html#upload"]')).toHaveCount(0);
  await expect(page.locator('#plan-keep-going')).toContainText('To help new families discover the school, share your parent testimonial. Adults only.');
  await expect(page.locator('.parent-reassurance')).toContainText('Keep following any admissions or SEND (special educational needs and disabilities) instructions');
  for (const href of ['letters.html', 'videos.html#upload', 'feedback.html?kind=evidence#feedback-form', 'feedback.html?kind=meeting#feedback-form', 'options.html#options']) {
    await page.goto('/proposal.html#parent-plan');
    await activate(page.locator(`#parent-plan a[href="${href}"]`), hasTouch);
    await expectDestination(page, href, baseURL);
  }
  await page.goto('/proposal.html#plan-respond');
  const official = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';
  await page.route(official, route => route.fulfill({ contentType: 'text/html', body: '<h1>Intercepted official consultation</h1>' }));
  await activate(page.locator('#plan-respond').getByRole('link', { name: /Send your official response/ }), hasTouch);
  await expect(page).toHaveURL(official);
  await expect(page.getByRole('heading')).toHaveText('Intercepted official consultation');
});

test('Parent plan: additional actions are optional native details without an invented petition link', async ({ page, hasTouch }) => {
  await page.goto('/proposal.html#plan-keep-going');
  const more = page.locator('#more-parent-actions');
  await expect(more).not.toHaveAttribute('open', '');
  await activate(more.locator('summary'), hasTouch);
  await expect(more).toHaveAttribute('open', '');
  await expect(more.getByRole('heading', { level: 4 })).toHaveCount(4);
  await expect(more).toContainText('in their own words');
  await expect(more).toContainText('A verified link and its wording are not yet available here');
  await expect(more.getByRole('link', { name: /petition/i })).toHaveCount(0);
  await more.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(more).not.toHaveAttribute('open', '');
  await expect(more.locator('summary')).toBeFocused();
});

test('FAQ: action comes first while school-place answers remain searchable and directly linked', async ({ page, hasTouch }) => {
  await page.goto('/faq.html');
  expect(await page.locator('.faq-group').evaluateAll(groups => groups.map(group => group.id))).toEqual(['taking-part', 'decisions', 'money', 'school-places', 'learning']);
  expect(await page.locator('#school-places details').evaluateAll(answers => answers.map(answer => answer.id))).toEqual(['apply-during-consultation', 'school-choice', 'choose-school']);
  await expect(page.locator('#choose-school > summary')).toHaveText('If closure is approved, when would we need to arrange another school?');
  await page.getByRole('searchbox', { name: 'Find an answer', exact: true }).fill('choose another school');
  await expect(page.locator('#choose-school')).toBeVisible();
  await expect(page.locator('#choose-school')).toHaveAttribute('open', '');
  await expect(page.locator('#choose-school')).toContainText('Closure has not been decided.');
  await expect(page.locator('#choose-school')).toContainText('normal admissions');
  await page.goto('/faq.html#choose-school');
  await expect(page.locator('#choose-school')).toHaveAttribute('open', '');
  await expect(page.locator('#choose-school')).toBeInViewport();
  await activate(page.locator('#choose-school a[href="proposal.html#parent-plan"]'), hasTouch);
  await expect(page.locator('#parent-plan-title')).toBeInViewport();
  await page.goto('/index.html');
  const help = page.locator('#quick-answers details').filter({ hasText: 'What can we do together now?' });
  await activate(help.locator('summary'), hasTouch);
  await activate(help.locator('a[href="proposal.html#parent-plan"]'), hasTouch);
  await expect(page.locator('#parent-plan-title')).toBeInViewport();
});


test('Parent plan: a named homepage shortcut is visible before scrolling', async ({ page, hasTouch }) => {
  await page.setViewportSize({ width: hasTouch ? 320 : 1440, height: hasTouch ? 568 : 1000 });
  await page.goto('/index.html');
  const shortcut = page.getByRole('link', { name: 'Parent action plan', exact: true }).filter({ has: page.locator('strong') });
  await expect(shortcut).toBeInViewport({ ratio: 1 });
  await expect(shortcut).toHaveAttribute('href', 'proposal.html#parent-plan');
  await activate(shortcut, hasTouch);
  await expect(page).toHaveURL(/proposal\.html#parent-plan$/);
  await expect(page.locator('#parent-plan-title')).toBeInViewport();
});

test('Parent plan: the shared navigation names the plan at desktop and mobile sizes', async ({ page, hasTouch }) => {
  for (const width of [390, 1101, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/feedback.html');
    const navigation = width <= 1100 ? page.locator('.mobile-menu') : page.locator('.desktop-explore');
    if (width <= 1100) await activate(navigation.locator('summary'), hasTouch);
    const link = navigation.getByRole('link', { name: 'Parent action plan', exact: true });
    await expect(link).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const box = await link.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await activate(link, hasTouch);
    await expect(page).toHaveURL(/proposal\.html#parent-plan$/);
    await expect(page.locator('#parent-plan-title')).toBeInViewport();
  }
});

test('Action motion: the brief invitation keeps the link target still and usable', async ({ page, hasTouch }) => {
  // Exercise this invitation before the meeting; the calendar-boundary test covers expiry.
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/index.html');
  const shortcut = page.locator('.parent-plan-spotlight a');
  const arrow = shortcut.locator('span');
  const box = await shortcut.boundingBox();
  const motion = await arrow.evaluate(element => {
    const animation = element.getAnimations()[0];
    if (!animation) return null;
    const { delay, duration, iterations } = animation.effect.getTiming();
    animation.pause();
    animation.currentTime = delay + duration / 2;
    return { duration, iterations, transform: getComputedStyle(element).transform };
  });
  expect(motion).not.toBeNull();
  expect(motion.iterations).toBe(1);
  expect(motion.duration).toBeLessThan(2000);
  expect(motion.transform).not.toBe('none');
  expect(await shortcut.boundingBox()).toEqual(box);
  await expect(shortcut).toBeInViewport();
  await arrow.evaluate(element => element.getAnimations().forEach(animation => animation.finish()));
  await expect(arrow).toHaveCSS('transform', 'none');
  if (!hasTouch) {
    const button = page.locator('.meeting-links a[href="proposal.html#parent-plan"]');
    await button.scrollIntoViewIfNeeded();
    const restingBox = await button.boundingBox();
    await button.hover();
    await expect.poll(async () => (await button.boundingBox()).y).toBeLessThan(restingBox.y);
    await expect(button).toBeVisible();
  }
  await activate(shortcut, hasTouch);
  await expect(page).toHaveURL(/proposal\.html#parent-plan$/);
  await expect(page.locator('#parent-plan-title')).toBeInViewport();
});

test('Action motion: reduced-motion links stay still and support keyboard activation', async ({ page }) => {
  // Exercise this invitation before the meeting; the calendar-boundary test covers expiry.
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/index.html');
  for (const selector of ['.parent-plan-spotlight a', '.meeting-links a[href="proposal.html#parent-plan"]']) {
    const link = page.locator(selector);
    const arrow = link.locator('span');
    await link.focus();
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('transform', 'none');
    await expect(link).toHaveCSS('transition-duration', '0s');
    await expect(arrow).toHaveCSS('animation-name', 'none');
    await expect(arrow).toHaveCSS('transform', 'none');
    await expect(arrow).toHaveCSS('transition-duration', '0s');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/proposal\.html#parent-plan$/);
    await expect(page.locator('#parent-plan-title')).toBeInViewport();
    await page.goto('/index.html');
  }
});

test('Parent plan: flyer makers can download the permanent homepage and visit QR codes as PNG and SVG', async ({ page, hasTouch, request }) => {
  await page.goto('/proposal.html#plan-keep-going');
  const more = page.locator('#more-parent-actions');
  await expect(more.locator('summary')).toContainText('sharing');
  await activate(more.locator('summary'), hasTouch);
  // Pin each filename to its own paragraph and link name so the two QR purposes cannot be swapped.
  for (const [id, label, base, caveat, svgTitle] of [
    ['share-qr', 'Homepage', 'savekewriverside-home-qr', 'in your own name', 'QR code for the Kew Riverside Primary School website'],
    ['visit-qr', 'Visit', 'savekewriverside-visit-qr', 'agree its wording with them', 'QR code for Kew Riverside Primary School visit enquiries'],
  ]) {
    const share = more.locator('#' + id);
    await expect(share).toBeVisible();
    await expect(share).toContainText(caveat);
    await expect(share.getByRole('link')).toHaveCount(2);
    for (const [kind, ext, type, start] of [['PNG image', 'png', 'image/png', '\x89PNG'], ['SVG', 'svg', 'image/svg+xml', '<?xml']]) {
      const file = `${base}.${ext}`;
      const link = share.getByRole('link', { name: `${label} QR code, ${kind}`, exact: true });
      await expect(link).toHaveAttribute('href', 'qr/' + file);
      await expect(link).toHaveAttribute('download', file);
      const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
      expect(download.suggestedFilename()).toBe(file);
      expect(await download.failure()).toBeNull();
      const body = await fs.readFile(await download.path());
      expect(body.subarray(0, start.length).toString('latin1')).toBe(start);
      if (ext === 'svg') expect(body.toString('utf8')).toContain(`<title>${svgTitle}</title>`);
      const response = await request.get('/qr/' + file);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain(type);
    }
  }
});
