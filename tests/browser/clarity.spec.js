const { test, expect, expectStillArrival } = require('./fixtures');
async function activate(locator, hasTouch) { if (hasTouch) await locator.tap(); else await locator.click(); }
const officialResponse = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';
const optionIds = ['option-recovery-plan', 'option-crowdfunding', 'option-demand', 'option-5', 'option-6', 'option-8'];
const fundingQuestions = ['funding-needed', 'council-assessment', 'sustainability', 'recipient', 'outreach', 'examples', 'appeal-terms', 'expertise'];

// Supporting research owns assessments; participation lives on Get involved.
test('Options: the research arrival exposes requirements and optional assessments', async ({ page, hasTouch }) => {
  await page.goto('/options.html#options');
  await expectStillArrival(page, '#options');
  await expect(page.locator('#options h1')).toBeInViewport();
  await expect(page.locator('.options-response, .options-prep')).toHaveCount(0);
  await expect(page.locator('.options-insight')).toBeVisible();
  await expect(page.locator('.options-insight')).toContainText(/budget|costed/i);
  expect(await page.locator('#options .action-card').evaluateAll(cards => cards.map(card => card.id))).toEqual(optionIds);
  await expect(page.locator('.action-card > details.option-card[open]')).toHaveCount(0);
  const questions=page.locator('main a[href="questions.html#questions"]').first();
  await activate(questions, hasTouch);
  await expect(page.getByRole('heading',{level:1})).toHaveText('Six questions worth asking');
  await expect(page.locator('#questions .question-list > article')).toHaveCount(6);
  await page.goto('/options.html#option-7');
  const recovery=page.locator('#option-7 a[href="get-involved.html#respond"]');
  await expect(recovery).toBeVisible();
  await activate(recovery, hasTouch);
  await expect(page).toHaveURL(/get-involved\.html#respond$/);
  await expect(page.locator('#respond')).toBeInViewport();
});

test('Options: a phone arrival exposes the title and assessment with a short reading layer', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/options.html');
  await expect(page.locator('#options h1')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.options-insight')).toBeVisible();
  await expect(page.locator('.options-response-button')).toHaveCount(0);
  const visibleWords = await page.locator('main').evaluate(main => {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const text = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      let visible = true;
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (parent.matches('script,style,template,noscript,[hidden]')) { visible = false; break; }
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') { visible = false; break; }
        // Closed details can still report descendant rectangles: only their own summary is exposed.
        if (parent.tagName === 'DETAILS' && !parent.open && !parent.querySelector(':scope > summary')?.contains(node)) { visible = false; break; }
        if (parent === main) break;
      }
      if (visible) text.push(node.textContent);
    }
    return text.join(' ').trim().split(/\s+/).length;
  });
  expect(visibleWords, 'The initial reading layer stays within the agreed 450-word budget').toBeLessThanOrEqual(450);
});

test('Options: every optional assessment exposes its limits before deeper evidence', async ({ page, hasTouch }) => {
  await page.goto('/options.html');
  for (const id of optionIds) {
    const card = page.locator('#' + id);
    const detail = card.locator(':scope > details.option-card');
    const summary = detail.locator(':scope > summary');
    await expect(summary).toHaveAccessibleName(/\S/);
    await activate(summary, hasTouch);
    await expect(detail).toHaveAttribute('open', '');
    await expect(card.locator('.option-first')).toBeVisible();
    await expect(card.locator('.option-limit')).toBeVisible();
    const evidence = card.locator('.option-evidence');
    await expect(evidence).not.toHaveAttribute('open', '');
    await activate(evidence.locator(':scope > summary'), hasTouch);
    await expect(evidence).toHaveAttribute('open', '');
    await expect(evidence.locator('a').first()).toBeVisible();
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(detail).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    await page.keyboard.press('Space');
    await expect(detail).toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    await activate(summary, hasTouch);
  }
  await expect(page.locator('.options-school-enquiry')).toHaveCount(0);
});

test('Options: old option and nested question links reveal the requested detail', async ({ page }) => {
  for (const id of optionIds) {
    await page.goto('/options.html#' + id);
    await expect(page.locator('#' + id)).toBeInViewport();
    await expect(page.locator('#' + id + ' > details.option-card')).toHaveAttribute('open', '');
    await expect(page.locator('#' + id + ' .option-first')).toBeVisible();
  }
  for (const question of fundingQuestions) {
    const id = 'crowdfunding-' + question;
    await page.goto('/options.html#' + id);
    await expect(page.locator('#option-crowdfunding > details.option-card')).toHaveAttribute('open', '');
    await expect(page.locator('#' + id + ' > details.question-detail')).toHaveAttribute('open', '');
    await expect(page.locator('#' + id)).toBeInViewport();
    await expect(page.locator(`#${id} a[href="feedback.html?kind=crowdfunding&question=${question}#feedback-form"]`)).toBeVisible();
  }
  await expectStillArrival(page, '#crowdfunding-expertise');
});

test('Options: optional funding questions keep private context and recover through Back', async ({ page, hasTouch }) => {
  await page.goto('/options.html#option-crowdfunding');
  const questions = page.locator('.funding-questions');
  await expect(questions.locator('li[id]')).toHaveCount(8);
  await expect(questions.locator('details.question-detail[open]')).toHaveCount(0);
  const status = page.locator('#option-crowdfunding .option-first .funding-status');
  await expect(status).toBeVisible();
  await expect(status).toContainText('No donations or pledges');
  await expect(status).toContainText(/no recipient.*agreed/);
  const recipient = page.locator('#crowdfunding-recipient > details.question-detail');
  await activate(recipient.locator(':scope > summary'), hasTouch);
  await expect(recipient).toHaveAttribute('open', '');
  await recipient.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(recipient).not.toHaveAttribute('open', '');
  await expect(recipient.locator(':scope > summary')).toBeFocused();
  await page.goto('/options.html#crowdfunding-recipient');
  await expectStillArrival(page, '#crowdfunding-recipient');
  await activate(page.locator('#crowdfunding-recipient a'), hasTouch);
  await expect(page).toHaveURL(/feedback\.html\?kind=crowdfunding&question=recipient#feedback-form$/);
  await expect(page.locator('input[name="kind"][value="crowdfunding"]')).toBeChecked();
  await expect(page.locator('#funding-subject')).toContainText('receive and manage');
  await expect(page.locator('#funding-context')).toContainText('stays private');
  await page.goBack();
  await expect(page.locator('#crowdfunding-recipient')).toBeInViewport();
  await expect(recipient).toHaveAttribute('open', '');
  await expect(page.locator('#option-crowdfunding > details.option-card')).toHaveAttribute('open', '');
});

test('Options: repeating a real cross-reference reopens its row and Back returns to funding', async ({ page, hasTouch }) => {
  await page.goto('/options.html#option-crowdfunding');
  const funding = page.locator('#option-crowdfunding > details.option-card');
  await activate(funding.locator('.option-evidence > summary'), hasTouch);
  const planLink = funding.locator('a[href="#option-recovery-plan"]').first();
  await activate(planLink, hasTouch);
  const recovery = page.locator('#option-recovery-plan > details.option-card');
  await expect(recovery).toHaveAttribute('open', '');
  await activate(recovery.locator(':scope > summary'), hasTouch);
  await expect(recovery).not.toHaveAttribute('open', '');
  await activate(planLink, hasTouch);
  await expect(page).toHaveURL(/#option-recovery-plan$/);
  await expect(recovery).toHaveAttribute('open', '');
  await expect(recovery.locator(':scope > summary')).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/#option-crowdfunding$/);
  await expect(funding).toHaveAttribute('open', '');
  await expect(page.locator('#option-crowdfunding')).toBeInViewport();
});

test('Options: a failed enhancement leaves all optional rows and funding questions available', async ({ page }) => {
  await page.route('**/options.js*', route => route.fulfill({ status: 503, contentType: 'application/javascript', headers: { 'x-test-fixture': 'intentional-error' }, body: '' }));
  await page.goto('/options.html#crowdfunding-recipient');
  for (const row of await page.locator('.action-card > details.option-card').all()) {
    if (!(await row.evaluate(el => el.open))) await row.locator(':scope > summary').click();
    await expect(row.locator('.option-limit')).toBeVisible();
  }
  await expect(page.locator('.funding-questions details.question-detail[open]')).toHaveCount(8);
  await expect(page.locator('#crowdfunding-recipient')).toBeVisible();
  await expect(page.locator('#crowdfunding-recipient a')).toBeVisible();
  await expect(page.locator('.options-response-button')).toHaveCount(0);
  await expect(page.locator('.options-school-enquiry')).toHaveCount(0);
});

test('Proposal: immediate actions stay exposed and full stage dates open on demand', async ({ page }) => {
  await page.goto('/proposal.html');
  await expect(page.locator('.proposal-actions')).toContainText('You can respond now');
  await expect(page.locator('.proposal-actions a')).toBeVisible();
  await expect(page.locator('.parent-plan-lead')).toContainText('optional');
  await expect(page.locator('#parent-plan > .simple-note a[href="faq.html#school-places"]')).toBeVisible();
  await expect(page.locator('#proposal-timetable-details')).not.toHaveAttribute('open','');
  await page.locator('#proposal-timetable-details > summary').click();
  for (const stage of await page.locator('#future-timeline > li').all()) {
    await expect(stage.locator(':scope > h3')).toBeVisible();
    await expect(stage.locator(':scope > .stage-label')).toBeVisible();
    expect(await stage.evaluate(el => el.closest('details').open)).toBe(true);
  }
  for (const id of ['parent-plan', 'school-meeting', 'question-budget', 'who-decides', 'decision-record']) {
    await page.goto('/proposal.html#' + id);
    await expect(page.locator('#' + id)).toBeInViewport();
  }
});

test('Proposal: fuller roles and decision records open with keyboard and touch', async ({ page, hasTouch }) => {
  await page.goto('/proposal.html#who-decides');
  for (const id of ['roles-detail', 'decision-record-detail']) {
    if(id==='decision-record-detail') await page.goto('/proposal.html#decision-record');
    const detail = page.locator('#' + id);
    await expect(detail).not.toHaveAttribute('open', '');
    await activate(detail.locator(':scope > summary'), hasTouch);
    await expect(detail).toHaveAttribute('open', '');
    await expect(detail.locator('a').first()).toBeVisible();
    await detail.locator(':scope > summary').focus();
    await page.keyboard.press('Enter');
    await expect(detail).not.toHaveAttribute('open', '');
    await expect(detail.locator(':scope > summary')).toBeFocused();
  }
});

test('Proposal: optional research opens as a document while Lessons and existing downloads remain available', async ({ page, hasTouch }) => {
  await page.goto('/proposal.html#other-schools');
  const research = page.locator('#other-schools');
  const pdf = research.locator('a[href="lessons-report.pdf"]');
  await expect(pdf).toHaveAccessibleName(/Optional:.*PDF, 44 pages/);
  await expect(pdf).not.toHaveAttribute('download');
  await expect(research).toContainText('You don’t need to read this to respond.');
  await activate(research.locator('a[href="lessons.html"]'), hasTouch);
  await expect(page).toHaveURL(/lessons\.html$/);
  await expect(page.locator('main')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/proposal\.html#other-schools$/);
  await expect(research).toBeInViewport();
  // A local HTML stand-in verifies normal document navigation/Back without
  // assuming the visitor's browser has an inline PDF viewer configured.
  await page.route('**/lessons-report.pdf', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Research document test</title><h1>Research document test</h1>' }));
  await activate(pdf, hasTouch);
  await expect(page).toHaveURL(/lessons-report\.pdf$/);
  await expect(page.getByRole('heading', { name: 'Research document test' })).toBeVisible();
  await page.goBack();
  await expect(research).toBeInViewport();
  // The direct download moved from the homepage Menu to Evidence (13 October 2026).
  await page.goto('/evidence.html#source-lessons-report');
  await expect(page.locator('#source-lessons-report a[href="lessons-report.pdf"]').first()).toHaveAttribute('download', 'lessons-report.pdf');
});

test('Clarity pages: enlarged main text reflows at a narrow width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  // The slim site's new pages (13 October 2026) join the archived clarity pages.
  for (const url of ['/dates.html#timetable', '/get-involved.html', '/updates.html', '/options.html#options', '/proposal.html#timetable', '/lessons.html#key-lessons']) {
    await page.goto(url);
    await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('main h1,main h2,main h3,main h4,main p,main summary,main a,main span,main dt,main dd')];
      const sizes = nodes.map(el => parseFloat(getComputedStyle(el).fontSize));
      nodes.forEach((el, i) => el.style.fontSize = `${sizes[i] * 2}px`);
    });
    // Compare with the 320px viewport: mobile emulation widens innerWidth to fit overflowing content.
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth), `${url} reflows without sideways scrolling`).toBeLessThanOrEqual(321);
    await expect(page.locator('main h2').first()).toBeVisible();
  }
});
