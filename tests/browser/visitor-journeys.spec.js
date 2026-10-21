const fs = require('node:fs/promises');
const { test, expect, expectDestination } = require('./fixtures');

// These journeys exercise the open consultation; deadline cases override this date.
test.use({ consultationDate: '2026-10-15T12:00:00Z' });

const questions = {
  'school-places': ['choose-school', 'school-choice', 'apply-during-consultation'],
  learning: ['school-results', 'latest-inspection', 'mixed-age-learning', 'mixed-age-research'],
  money: ['deficit-meaning', 'deficit-build-up', 'crowdfunding-target'],
  decisions: ['decided', 'next-meeting', 'respond-deadline'],
  'taking-part': ['useful-response', 'letters-official', 'share-evidence'],
};
const questionIds = Object.values(questions).flat();
// Since 13 October 2026 the homepage uses the shared Menu. Under the 13 October 2026
// slim-site decision it lists the five campaign pages and the Discover the school rows;
// the archived proposal, FAQ, options, evidence and research pages have no Menu entry.
const menuRoutes = ['index.html', 'dates.html', 'get-involved.html', 'updates.html', 'about.html', 'videos.html#watch-parent-voices', 'visit/index.html'];
// Every route except Home itself and the Open Day handoff (mobile.spec.js and desktop.spec.js).
const entryRoutes = ['dates.html', 'get-involved.html', 'updates.html', 'about.html', 'videos.html#watch-parent-voices'];
const official = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';
const petition = 'https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249';
// Fixed London dates either side of the published 16 October 2026 response deadline.
const consultationWeek = '2026-10-13T12:00:00Z';
const afterDeadline = '2026-10-17T12:00:00Z';

async function activate(locator, hasTouch) {
  if (hasTouch) await locator.tap();
  else await locator.click();
}

// Get involved replaced the Help shortcut (13 October 2026 slim-site decision).
test('Homepage: responsive copy keeps words separated on mobile and desktop', async ({ page }) => {
 for (const [at, copy] of [[consultationWeek, '1 September 2027; no decision yet. Supporters seek time to test costed recovery and sustainable alternatives.'], [afterDeadline, 'Richmond Council proposes closing the school from 1 September 2027. If it proceeds in November 2026, it plans a final decision in April 2027.']]) {
  for (const width of [390,1440]) {
   await page.clock.setFixedTime(new Date(at));
   await page.setViewportSize({width,height:1000});await page.goto('/index.html');
   const text=(await page.locator('.intro').innerText()).replace(/\s+/g,' ');
   expect(text).toContain(copy);
   await expect(page.locator('.home-plan')).toHaveAccessibleName('Get involved');
  }
 }
});

test('Prospective families retain the Open Day handoff and Options routes', async ({ page }) => {
 const openDay='https://docs.google.com/forms/d/e/1FAIpQLSfwTdpsQB5HOlbJxumjINzFjWiZZCshEHUIrkgXlUDCBBPGrw/viewform';
 await page.route(openDay,route=>route.fulfill({contentType:'text/html',body:'<h1>Fictional Open Day booking</h1>'}));
 await page.goto('/index.html#visit-school');await expect(page).toHaveURL(openDay);
 await expect(page.getByRole('heading')).toHaveText('Fictional Open Day booking');
 await page.goto('/options.html#option-enrolment');const option=page.locator('#option-enrolment');
 await expect(option.locator('.option-evidence')).toHaveCount(0);
 await expect(option.locator('a')).toHaveAttribute('href','visit/index.html');
 await option.locator('a').click();await expect(page).toHaveURL(openDay);
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
  await page.goto('/proposal.html#questions');
  await expect(page.locator(`#question-demand a[href="${guidance}#page=8"]`)).toBeVisible();
  await expect(page.locator(`#question-alternatives a[href="${guidance}#page=8"]`)).toBeVisible();
  await page.goto('/options.html#options');
  await expect(page.locator('.response-detail')).toHaveCount(0);
  await expect(page.locator('main a[href="questions.html#questions"]').first()).toBeVisible();
});

test('Options ranking links to the council’s published alternatives rather than site questions', async ({ page }) => {
  await page.goto('/options.html#options');
  await page.locator('.options-method > summary').click();
  await expect(page.locator('.ranking-method').getByRole('link', { name: /published reasons for not preferring/ })).toHaveAttribute(
    'href',
    'https://www.richmond.gov.uk/media/fxhbilws/kew_riverside_consultation_leaflet.pdf#page=6',
  );
});

test('Homepage: past meeting links remain usable without promoting an expired event', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#meeting-invitation')).toBeHidden();
  await expect(page.locator('.actions')).not.toContainText('PTA prep');
  await page.goto('/index.html#meeting-invitation');
  await expect(page).toHaveURL(/proposal\.html#school-meeting$/);
  await expect(page.locator('#school-meeting')).toBeInViewport();
  await expect(page.locator('#school-meeting')).toContainText('advertised meeting date has passed');
});

test.describe('Past meeting stays retired independently of a visitor’s calendar', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  for (const date of ['2026-09-22T12:00:00Z', '2026-09-28T12:00:00Z', '2026-09-29T12:00:00Z', '2026-09-30T12:00:00Z', '2026-10-08T12:00:00Z']) {
    test(date + ': archived source remains available without an invitation', async ({ page }) => {
      await page.clock.setFixedTime(new Date(date));
      await page.goto('/index.html');
      await expect(page.locator('#meeting-invitation')).toBeHidden();
      await page.goto('/proposal.html#school-meeting');
      await expect(page.locator('#school-meeting')).toBeInViewport();
      await expect(page.locator('#school-meeting')).toContainText(/29\s+September\s+2026/);
    });
  }
});

test('Homepage: clear Menu routes lead to the five campaign pages and Parent Voices', async ({ page, hasTouch, baseURL }) => {
 await page.goto('/index.html');
 expect(await page.locator('.mobile-menu a').evaluateAll(links=>links.map(link=>link.getAttribute('href')))).toEqual(menuRoutes);
 for (const href of entryRoutes) {
  await page.goto('/index.html');await activate(page.locator('.mobile-menu summary'),hasTouch);
  const link=page.locator(`.mobile-menu a[href="${href}"]`);await expect(link).toHaveAccessibleName(/\S/);
  await activate(link,hasTouch);await expectDestination(page,href,baseURL);
 }
});

test('Homepage: current response and historical meeting source lead to useful actions', async ({ page, hasTouch }) => {
  // The response invitation is for consultation week; home-landing.spec.js covers the later stages.
  await page.clock.setFixedTime(new Date(consultationWeek));
  await page.goto('/index.html');
  await expect(page.locator('#meeting-invitation')).toBeHidden();
  await expect(page.locator('#top')).toContainText(/16\s+Oct(?:ober)?/i);
  await expect(page.locator('#top')).toContainText(/propos/i);
  await expect(page.locator('#top a[href^="https://docs.google.com/forms/"]')).toHaveAttribute('href', 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform');
  await page.goto('/proposal.html#school-meeting');
  await expect(page.locator('#school-meeting')).toBeInViewport();
  await expect(page.locator('#school-meeting')).toContainText(/29\s+September/i);
  await activate(page.locator('#school-meeting a[href="feedback.html?kind=meeting#feedback-form"]'), hasTouch);
  await expect(page).toHaveURL(/feedback\.html\?kind=meeting#feedback-form$/);
  await expect(page.locator('input[name="kind"][value="meeting"]')).toBeChecked();
  await expect(page.locator('#meeting-context')).toContainText('does not put it on a meeting agenda or send it to the council');
  await expect(page.locator('#allow-public')).not.toBeChecked();
});

test('FAQ: every answer is a readable native disclosure with a useful destination', async ({ page, hasTouch }) => {
  await page.goto('/faq.html');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('main .faq-answer')).toHaveCount(questionIds.length);
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
  expect(await page.locator('main .faq-answer:visible').count()).toBeLessThan(questionIds.length);
  await expect(page.locator('#faq-results')).toContainText(/answer|result/i);
  await query.fill('zz-no-matching-answer-zz');
  await expect(page.locator('main .faq-answer:visible')).toHaveCount(0);
  await expect(page.locator('#faq-empty')).toBeVisible();
  for (const section of Object.keys(questions)) await expect(page.locator('#' + section)).toBeHidden();
  await activate(page.getByRole('button', { name: 'Clear search', exact: true }), hasTouch);
  await expect(query).toHaveValue('');
  await expect(page.locator('#faq-empty')).toBeHidden();
  await expect(page.locator('main .faq-answer:visible')).toHaveCount(questionIds.length);
  await expect(page.locator('main .faq-answer[open]')).toHaveCount(0);
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
  await expect(page.locator('main .faq-answer:visible')).toHaveCount(questionIds.length);
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

// 13 October 2026 slim-site decision: the homepage shortcut is Get involved, which replaced
// the archived Parent action plan as the live action page. The archived plan still works.
test('Get involved: homepage shortcut leads to current actions; archived meeting details still reach the plan', async ({ page, hasTouch }) => {
  await page.clock.setFixedTime(new Date(consultationWeek));
  await page.goto('/index.html');
  const invitation = page.locator('.home-plan');
  await expect(invitation).toHaveAccessibleName('Get involved');
  await activate(invitation, hasTouch);
  await expect(page).toHaveURL(/get-involved\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Get involved', exact: true })).toBeInViewport();
  await expect(page.locator('main')).toContainText('Closure is proposed, not decided.');
  expect(await page.locator('main > section').evaluateAll(sections => sections.map(section => section.id))).toEqual(['respond', 'petition', 'representatives', 'share-your-story', 'parent-video', 'spread-the-word', 'legal-fund', 'school-contributions', 'help']);
  await page.goto('/proposal.html#school-meeting');
  await activate(page.locator('#school-meeting a[href="#parent-plan"]'), hasTouch);
  await expect(page.locator('#parent-plan-title')).toBeInViewport();
});

// Get involved's own actions replace the archived plan's chooser (13 October 2026 slim-site
// decision). Each lands on its live destination; the official form and petition are intercepted.
test('Get involved: each action reaches its live destination and the official response stays distinct', async ({ page, hasTouch, baseURL }) => {
  await page.clock.setFixedTime(new Date(consultationWeek));
  for (const href of ['letters.html#letter-form', 'letters.html', 'videos.html#upload', 'feedback.html']) {
    await page.goto('/get-involved.html');
    const link = page.locator(`main a[href="${href}"]`);
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAccessibleName(/\S/);
    await link.scrollIntoViewIfNeeded();
    await activate(link, hasTouch);
    await expectDestination(page, href, baseURL);
  }
  await page.goto('/get-involved.html');
  await expect(page.locator('#respond')).toContainText('A letter, video or petition does not replace your own official response.');
  await expect(page.locator('#help a[href="mailto:savekrps@gmail.com"]')).toBeVisible();
  await page.route(official, route => route.fulfill({ contentType: 'text/html', body: '<h1>Intercepted official consultation</h1>' }));
  await page.route(petition, route => route.fulfill({ contentType: 'text/html', body: '<h1>Fictional petition destination</h1>' }));
  for (const [selector, url, heading] of [['#respond a[data-current-response]', official, 'Intercepted official consultation'], ['#petition a.primary', petition, 'Fictional petition destination']]) {
    await page.goto('/get-involved.html');
    const link = page.locator(selector);
    await expect(link).toHaveAttribute('href', url);
    await link.scrollIntoViewIfNeeded();
    await activate(link, hasTouch);
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('heading')).toHaveText(heading);
  }
});

test('Parent plan: correct PTA dates, the video route for new families and official deadline stay distinct', async ({ page, hasTouch, baseURL }) => {
  await page.goto('/proposal.html#parent-plan');
  const prep = page.locator('#prep-sessions');
  await expect(page.locator('#parent-plan #prep-sessions, #parent-plan #plan-attend, #parent-plan a[href="rally.html"]')).toHaveCount(0);
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
  for (const href of ['letters.html#letter-form', 'videos.html#upload', 'feedback.html?kind=evidence#feedback-form', 'feedback.html?kind=meeting#feedback-form', 'options.html#options']) {
    await page.goto('/proposal.html#parent-plan');
    await page.locator('#parent-plan-full > summary').click();
    const route=href==='letters.html#letter-form' ? '#plan-share' : '#parent-plan';
    await activate(page.locator(`${route} a[href="${href}"]`), hasTouch);
    await expectDestination(page, href, baseURL);
  }
  await page.goto('/proposal.html#plan-respond');
  const official = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';
  await page.route(official, route => route.fulfill({ contentType: 'text/html', body: '<h1>Intercepted official consultation</h1>' }));
  await activate(page.locator('#plan-respond').getByRole('link', { name: /Send your official response/ }), hasTouch);
  await expect(page).toHaveURL(official);
  await expect(page.getByRole('heading')).toHaveText('Intercepted official consultation');
});

test('Parent plan: petition is secondary, eligible people are named and the full details remain optional', async ({ page, hasTouch }) => {
  await page.goto('/proposal.html#plan-keep-going');
  const step = page.locator('#plan-keep-going');
  await expect(step).toContainText('Live, work or study in the London Borough of Richmond upon Thames?');
  await expect(step).toContainText('does not replace your own official consultation response');
  await expect(step.locator('a[href="https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249"]')).toHaveCount(3);
  await expect(step.locator('a[href="https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249"]').first()).toBeVisible();
  await expect(page.locator('#plan-respond .button.primary')).toHaveText(/Send your official response/);
  const more = page.locator('#more-parent-actions');
  await expect(more).not.toHaveAttribute('open', '');
  await activate(more.locator('summary'), hasTouch);
  await expect(more).toHaveAttribute('open', '');
  await expect(more.getByRole('heading', { level: 4 })).toHaveCount(4);
  await expect(more).toContainText('in their own words');
  await expect(more).toContainText('started by Ewa Sarnowska and hosted on Richmond Council’s website');
  await expect(more).toContainText('13 October 2026 to 13 January 2027');
  await expect(more.getByRole('link', { name: /Keep Kew Riverside Primary School open/ })).toHaveAttribute('href', 'https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249');
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
  // 13 October 2026 slim-site decision: the homepage action now leads to Get involved.
  await page.goto('/index.html');
  await activate(page.locator('.home-plan'), hasTouch);
  await expect(page).toHaveURL(/get-involved\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Get involved', exact: true })).toBeInViewport();
});


// Get involved replaced the Parent action plan shortcut (13 October 2026 slim-site decision).
// At 320 × 568 it starts on the first screen below the response while the consultation is
// open, and is fully on it beside the petition afterwards.
test('Get involved: the named homepage action is visible before scrolling', async ({ page, hasTouch }) => {
  await page.setViewportSize({ width: hasTouch ? 320 : 1440, height: hasTouch ? 568 : 1000 });
  for (const at of [consultationWeek, afterDeadline]) {
    await page.clock.setFixedTime(new Date(at));
    await page.goto('/index.html');
    const shortcut = page.locator('.home-plan');
    if (at === consultationWeek) {
      await expect(page.locator('#main-action')).toBeInViewport({ ratio: 1 });
      await expect(shortcut).toBeInViewport();
    } else {
      await expect(page.locator('#main-action')).toBeHidden();
      await expect(page.locator('#petition-action')).toBeInViewport({ ratio: 1 });
      await expect(shortcut).toBeInViewport({ ratio: 1 });
    }
    await expect(shortcut).toBeVisible();
    await expect(shortcut).toHaveAccessibleName('Get involved');
    await expect(shortcut).toHaveAttribute('href', 'get-involved.html');
    await activate(shortcut, hasTouch);
    await expect(page).toHaveURL(/get-involved\.html$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Get involved', exact: true })).toBeInViewport();
  }
});

// 13 October 2026 slim-site decision: Get involved replaced the Parent action plan in the
// shared navigation. It is the only wide-screen header link (the participation tiles were
// removed) and a Menu page.
test('Get involved: the shared navigation names it at desktop and mobile sizes', async ({ page, hasTouch }) => {
  for (const width of [390, 1101, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/feedback.html');
    await expect(page.locator('.participation-nav')).toHaveCount(0);
    expect(await page.locator('header .desktop-explore a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(['get-involved.html']);
    const navigation = width <= 1100 ? page.locator('.mobile-menu') : page.locator('.desktop-explore');
    if (width <= 1100) await activate(navigation.locator('summary'), hasTouch);
    const link = navigation.getByRole('link', { name: 'Get involved', exact: true });
    await expect(link).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const box = await link.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await activate(link, hasTouch);
    await expect(page).toHaveURL(/get-involved\.html$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Get involved', exact: true })).toBeInViewport();
  }
});

// The Get involved action has no arrow (13 October 2026 slim-site decision); neither it nor
// anything inside it may animate or move.
test('Action layout: the large Get involved target stays still and usable', async ({ page, hasTouch }) => {
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/index.html');
 const link=page.locator('.home-plan');await link.scrollIntoViewIfNeeded();const before=await link.boundingBox();
 expect(await link.evaluate(el=>[el,...el.querySelectorAll('*')].map(node=>getComputedStyle(node).animationName).filter(name=>name!=='none'))).toEqual([]);
 expect(await link.boundingBox()).toEqual(before);
 await activate(link,hasTouch);await expect(page).toHaveURL(/get-involved\.html$/);await expect(page.getByRole('heading',{level:1,name:'Get involved',exact:true})).toBeInViewport();
});

test('Action motion: reduced-motion links stay still and support keyboard activation', async ({ page }) => {
  await page.clock.setFixedTime(new Date(consultationWeek));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/index.html');
  for (const selector of ['.home-plan']) {
    const link = page.locator(selector);
    await link.focus();
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('transform', 'none');
    await expect(link).toHaveCSS('transition-duration', '0s');
    await expect(link).toHaveCSS('animation-name', 'none');
    // The former arrow went with the 13 October 2026 slim-site decision; nothing inside may move.
    expect(await link.evaluate(el => [...el.querySelectorAll('*')].map(node => getComputedStyle(node)).filter(style => style.animationName !== 'none' || style.transform !== 'none' || style.transitionDuration !== '0s').length)).toBe(0);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/get-involved\.html$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Get involved', exact: true })).toBeInViewport();
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

// J8/J9: Get involved now carries both flyer QR codes (13 October 2026 slim-site decision);
// the archived plan's copies above keep working for old links.
test('Get involved: flyer makers can download the permanent homepage and visit QR codes as PNG and SVG', async ({ page, hasTouch, request }) => {
  await page.goto('/index.html');
  await activate(page.locator('.home-plan'), hasTouch);
  await expect(page).toHaveURL(/get-involved\.html$/);
  await expect(page.locator('#spread-the-word #share-qr')).toBeVisible();
  await expect(page.locator('#school-contributions #visit-qr')).toBeVisible();
  await expect(page.locator('#spread-the-word #visit-qr')).toHaveCount(0);
  // Pin each filename to its own card and link name so the two QR purposes cannot be swapped.
  for (const [id, label, base, caveat, svgTitle] of [
    ['share-qr', 'Homepage', 'savekewriverside-home-qr', 'in your own name', 'QR code for the Kew Riverside Primary School website'],
    ['visit-qr', 'Visit', 'savekewriverside-visit-qr', 'Keep closure campaigning off Open Day flyers', 'QR code for Kew Riverside Primary School visit enquiries'],
  ]) {
    const share = page.locator('#' + id);
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
