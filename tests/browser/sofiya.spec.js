const fs = require('node:fs/promises');
const { test, expect, expectScrollSettled } = require('./fixtures');

// Independently pinned to the reviewed, rounded DfE combined expected-standard
// figures. Neither the page nor a generated download supplies these expectations.
const combinedResults = [
  { year: 2023, kew: 75, england: 60, richmond: 74 },
  { year: 2024, kew: 67, england: 61, richmond: 76 },
  { year: 2025, kew: 73, england: 62, richmond: 78 },
];
const learningAnswers = ['school-results', 'latest-inspection', 'mixed-age-learning', 'mixed-age-research'];

async function activate(locator, hasTouch) {
  if (hasTouch) await locator.tap();
  else await locator.click();
}

test('Learning: contextual homepage and evidence entries reach the results and support Back', async ({ page, hasTouch }) => {
  for (const [path, entry] of [
    ['/evidence.html', page.getByRole('complementary', { name: 'How does Kew Riverside Primary School compare?' })],
    ['/index.html', page.locator('#visit-school')],
  ]) {
    await page.goto(path);
    const link = entry.locator('a[href="understand.html#learning-and-results"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAccessibleName(/learning|results/i);
    await activate(link, hasTouch);
    await expect(page).toHaveURL(/understand\.html#learning-and-results$/);
    await expect(page.locator('#learning-and-results')).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(path.replace('.', '\\.') + '$'));
    await expect(link).toBeVisible();
  }
});

test('Learning: the local jump retains previous comparison sections and visible context', async ({ page, hasTouch }) => {
  await page.goto('/understand.html');
  const expected = ['pupil-trends', 'forecast-checks', 'school-places', 'year-groups', 'budget', 'other-proposals', 'learning-and-results', 'methodology'];
  expect(await page.locator('main > section[id]').evaluateAll(sections => sections.map(section => section.id).filter(id => id !== 'top'))).toEqual(expected);
  await activate(page.locator('.visual-route a[href="#learning-and-results"]'), hasTouch);
  await expect(page.locator('#learning-and-results')).toBeInViewport();
  const section = page.locator('#learning-and-results');
  // These qualifications must be readable before opening optional depth.
  const visibleCopy = await section.innerText();
  expect(visibleCopy).toMatch(/reading,? writing and maths|reading, writing.*mathematics/i);
  expect(visibleCopy).toMatch(/expected standard/i);
  expect(visibleCopy).toMatch(/small.*cohort|cohort.*small/i);
  expect(visibleCopy).toMatch(/attainment.*progress|progress.*attainment/is);
  for (const text of ['2025', '73%', '62%', '78%', '15 in 2025', '68%', '22 pupils', 'provisional']) expect(visibleCopy).toContain(text);
  await expect(page.locator('svg#attainment-chart')).toBeHidden();
  await activate(page.locator('#attainment-detail > summary'), hasTouch);
  const detailedCopy = await section.innerText();
  for (const { year, kew, england, richmond } of combinedResults) {
    for (const text of [String(year), `${kew}%`, `${england}%`, `${richmond}%`]) expect(detailedCopy).toContain(text);
  }
  const chart = page.locator('svg#attainment-chart');
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAttribute('role', 'img');
  await expect(chart).toHaveAccessibleName(/\S/);
  expect((await chart.locator('text').allTextContents()).filter(text => /^\d+%$/.test(text))).toEqual(['75%', '67%', '73%']);
  const charts = section.locator('.attainment-figure svg');
  await expect(charts).toHaveCount(3);
  for (const [index, name] of ['Kew Riverside Primary School', 'Richmond', 'England'].entries()) {
    await expect(charts.nth(index)).toHaveAttribute('role', 'img');
    await expect(charts.nth(index)).toHaveAccessibleName(new RegExp(name));
  }
  await activate(page.locator('#inspection-summary > summary'), hasTouch);
  await expect(section.locator('#inspection-summary a[href="evidence.html#source-inspection-2026"]')).toBeVisible();
  await expect(section.locator('#inspection-summary')).toContainText('Needs attention: attendance and behaviour');
});

test('Learning: chart table links reveal closed data and recover through repeated links and history', async ({ page, hasTouch }) => {
  await page.goto('/understand.html#learning-and-results');
  await activate(page.locator('#attainment-detail > summary'), hasTouch);
  const details = page.locator('details#attainment-tables');
  const summary = details.locator(':scope > summary');
  const table = details.locator('table').first();
  const chartLink = page.locator('.attainment-figure a[href="#attainment-tables"]');
  await expect(chartLink).toHaveAccessibleName('Jump to results tables');
  await expect(details).not.toHaveAttribute('open', '');
  await expect(table).toBeHidden();
  await activate(chartLink, hasTouch);
  await expect(page).toHaveURL(/understand\.html#attainment-tables$/);
  await expect(details).toHaveAttribute('open', '');
  await expect(details).toBeInViewport();
  await expect(table).toBeVisible();

  await activate(summary, hasTouch);
  await expect(details).not.toHaveAttribute('open', '');
  // A repeated link does not emit hashchange, but must still reveal its data.
  await activate(chartLink, hasTouch);
  await expect(page).toHaveURL(/understand\.html#attainment-tables$/);
  await expect(details).toHaveAttribute('open', '');
  await expect(table).toBeVisible();
  await expect(details).toBeInViewport();

  await activate(summary, hasTouch);
  await expect(details).not.toHaveAttribute('open', '');
  await page.goBack();
  await expect(page).toHaveURL(/understand\.html#learning-and-results$/);
  await page.goForward();
  await expect(page).toHaveURL(/understand\.html#attainment-tables$/);
  await expect(details).toHaveAttribute('open', '');
  await expect(table).toBeVisible();
  await expect(details).toBeInViewport();

  // A new document load with a shared data fragment has the same result.
  await page.goto('/index.html');
  await page.goto('/understand.html#attainment-tables');
  await expect(details).toHaveAttribute('open', '');
  await expect(table).toBeVisible();
  await expect(details).toBeInViewport();
});

test('Learning: native data and method disclosures work by keyboard and download usable data', async ({ page, hasTouch }) => {
  await page.goto('/understand.html#learning-and-results');
  await activate(page.locator('#attainment-detail > summary'), hasTouch);
  for (const id of ['attainment-tables', 'attainment-method']) {
    const details = page.locator(`details#${id}`);
    const summary = details.locator(':scope > summary');
    await expect(details).not.toHaveAttribute('open', '');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    if (id === 'attainment-tables') {
      expect(await details.locator('table:visible').count()).toBeGreaterThan(0);
      const rows = await details.locator('tbody tr').allTextContents();
      for (const { year, kew, england, richmond } of combinedResults) {
        for (const [group, expected] of [['Kew Riverside Primary School', kew], ['England', england], ['Richmond', richmond]]) {
          expect(rows.some(row => (row.includes(String(year)) || row.includes(`${year - 1}/${String(year).slice(-2)}`)) && row.includes(group) && row.includes(`${expected}%`)), `${group} combined result for ${year}`).toBe(true);
        }
      }
    } else {
      await expect(details).toContainText(/missing values.*zero/i);
    }
    await page.keyboard.press('Space');
    await expect(details).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
  }
  for (const filename of ['attainment.csv', 'attainment-data.json']) {
    const link = page.locator(`#learning-and-results a[href="${filename}"][download]`);
    await expect(link).toHaveAccessibleName(/\S/);
    const [download] = await Promise.all([page.waitForEvent('download'), activate(link, hasTouch)]);
    expect(download.suggestedFilename()).toBe(filename);
    expect(await download.failure()).toBeNull();
    const contents = await fs.readFile(await download.path(), 'utf8');
    expect(contents).toMatch(/Kew Riverside Primary School/);
    expect(contents).toMatch(/England/);
    expect(contents).toMatch(/Richmond/);
    for (const { year } of combinedResults) expect(contents).toContain(`${year - 1}/${String(year).slice(-2)}`);
    if (filename.endsWith('.json')) {
      const data = JSON.parse(contents);
      expect(data.schemaVersion).toBe(1);
      for (const { year, kew, england, richmond } of combinedResults) {
        for (const [group, expectedPercent] of [['Kew Riverside Primary School', kew], ['England', england], ['Richmond upon Thames', richmond]]) {
          expect(data.records).toContainEqual(expect.objectContaining({
            group,
            academicYear: `${year - 1}/${String(year).slice(-2)}`,
            subject: 'Reading, writing and maths',
            expectedPercent,
          }));
        }
      }
      expect(data.records.some(record => record.expectedPercent === null || record.higherPercent === null)).toBe(true);
    } else {
      const rows = contents.trim().split(/\r?\n/);
      expect(rows.length).toBeGreaterThan(3);
      for (const { year, kew, england, richmond } of combinedResults) {
        for (const [group, expected] of [['Kew Riverside Primary School', kew], ['England', england], ['Richmond upon Thames', richmond]]) {
          expect(rows.some(row => row.includes(group) && row.includes(`${year - 1}/${String(year).slice(-2)}`) && row.includes('Reading, writing and maths') && row.includes('Expected standard') && new RegExp(`,\"?${expected}\"?,`).test(row)), `${group} CSV combined result for ${year}`).toBe(true);
        }
      }
    }
  }
});

test('Learning: narrow arrival protects action routes and the chart stays inside the page', async ({ page, hasTouch }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/index.html');
  const plan = page.getByRole('complementary', { name: 'Parent action plan', exact: true }).getByRole('link', { name: 'Parent action plan', exact: true });
  await expect(plan).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open', '');
  for (const href of ['letters.html', 'feedback.html']) {
    const link = page.locator(`header a[href="${href}"]:visible`);
    await expect(link).toBeInViewport({ ratio: 1 });
    await activate(link, hasTouch);
    await expect(page).toHaveURL(new RegExp(`${href.replace('.', '\\.')}$`));
    for (const consent of ['#allow-public', ...(href === 'letters.html' ? ['#allow-council', '#letter-consent'] : [])]) {
      await expect(page.locator(consent)).not.toBeChecked();
    }
    await page.goBack();
  }
  await activate(page.locator('#visit-school a[href="understand.html#learning-and-results"]'), hasTouch);
  await activate(page.locator('#attainment-detail > summary'), hasTouch);
  const chart = page.locator('#attainment-chart');
  await expect(chart).toBeVisible();
  const box = await chart.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(321);
  await activate(page.locator('#attainment-tables > summary'), hasTouch);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('Inspection: original-source counts, search and the resolved gap agree', async ({ page, hasTouch }) => {
  await page.goto('/evidence.html#records');
  await expect(page.locator('.source-card')).toHaveCount(61);
  for (const [status, count] of [['Reviewed', 57], ['Index only', 2], ['Not retrieved', 2]]) {
    await expect(page.locator(`.source-card[data-status="${status}"]`)).toHaveCount(count);
  }
  const inspection = page.locator('#source-inspection-2026');
  await page.getByLabel('Search source records and research reports').fill('Ofsted 2026');
  await page.locator('#record-refinements > summary').click();
  await page.getByLabel('Record type', { exact: true }).selectOption('Inspection');
  await page.getByLabel('Year', { exact: true }).selectOption('2026');
  await page.getByLabel('Coverage', { exact: true }).selectOption('Reviewed');
  await expect(inspection).toBeVisible();
  await expect(inspection).toHaveAttribute('data-status', 'Reviewed');
  await expect(inspection.locator('h3 a')).toHaveAttribute('href', 'https://www.kewriverside.richmond.sch.uk/attachments/download.asp?file=3619&type=pdf');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.source-card:visible')).toHaveCount(61);
  const gap = page.locator('#evidence-found');
  await expect(gap).toContainText(/resolved/i);
  await activate(gap.locator('summary'), hasTouch);
  await activate(gap.locator('a[href="#source-inspection-2026"]'), hasTouch);
  await expect(inspection).toBeInViewport();
  await page.getByLabel('Year', { exact: true }).selectOption('2003');
  await expect(inspection).toBeHidden();
  // Repeating the current hash must still recover a source hidden by filters.
  // The reset re-expands the list above the link and scroll anchoring keeps the link in place;
  // animated jumps then sometimes left Chromium there, so the jump must land at once.
  await activate(gap.locator('a[href="#source-inspection-2026"]'), hasTouch);
  await expectScrollSettled(page, 'Repeated source link');
  await expect(inspection).toBeVisible();
  await expect(inspection).toBeInViewport();
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('');
  await page.goto('/evidence.html?q=unfindable-inspection&type=Inspection&year=2003&status=Index%20only#source-inspection-2026');
  await expect(inspection).toBeVisible();
  await expect(inspection).toBeInViewport();
  await expect(page.getByLabel('Search source records and research reports')).toHaveValue('');
  await expect(page.getByLabel('Coverage', { exact: true })).toHaveValue('');
  await expect(page.locator('main')).not.toContainText(/full (?:2026 )?(?:inspection )?report (?:has )?not (?:been )?retrieved/i);
});

test('Learning FAQ: remembered terms and incoming answer links recover from search', async ({ page, hasTouch }) => {
  await page.goto('/faq.html');
  const query = page.getByRole('searchbox', { name: 'Find an answer', exact: true });
  for (const [term, id] of [
    ['SATs', 'school-results'],
    ['Ofsted', 'latest-inspection'],
    ['mixed-age', 'mixed-age-learning'],
    ['research', 'mixed-age-research'],
  ]) {
    await query.fill(term);
    await expect(page.locator('#' + id)).toBeVisible();
    await expect(page.locator('#' + id)).toHaveAttribute('open', '');
  }
  await query.fill('zz-no-learning-answer-zz');
  await expect(page.locator('#learning')).toBeHidden();
  await activate(page.locator('.faq-topics a[href="#learning"]'), hasTouch);
  await expect(query).toHaveValue('');
  await expect(page.locator('#learning')).toBeInViewport();
  await expect(page.locator('main details:visible')).toHaveCount(16);
  for (const id of learningAnswers) {
    await page.goto('/faq.html#school-places');
    const answer = page.locator('#' + id);
    await query.fill('zz-no-learning-answer-zz');
    await expect(answer).toBeHidden();
    // Emulate a newly received answer fragment while the page has active search.
    await page.evaluate(hash => { location.hash = hash; }, '#' + id);
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(query).toHaveValue('');
    await expect(answer).toBeVisible();
    await expect(answer).toHaveAttribute('open', '');
    await expect(answer).toBeInViewport();
    await activate(answer.locator(':scope > summary'), hasTouch);
    await expect(answer).not.toHaveAttribute('open', '');
    await page.goBack();
    await expect(page).toHaveURL(/#school-places$/);
    await page.goForward();
    await expect(answer).toHaveAttribute('open', '');
    await expect(answer).toBeInViewport();
  }
});

test('Recruitment: awareness channels retain direct school and normal-admissions routes', async ({ page, hasTouch }) => {
  await page.goto('/options.html#option-enrolment');
  const option = page.locator('#option-enrolment');
  await expect(option.locator('details.option-card > summary')).toHaveAccessibleName(/families.*school/i);
  await activate(option.locator('.option-evidence > summary'), hasTouch);
  await expect(option.locator('.option-evidence')).toHaveAttribute('open', '');
  for (const channel of ['nurseries', 'parent groups', 'community notices', 'word of mouth', 'social media']) {
    await expect(option).toContainText(new RegExp(channel, 'i'));
  }
  await page.goto('/index.html#visit-school');
  const visit = page.locator('#visit-school');
  await expect(visit).toContainText(/proposed, not decided/i);
  await expect(visit.locator('a[href="proposal.html"]')).toBeVisible();
  await expect(visit.locator('a[href="understand.html#learning-and-results"]')).toBeVisible();
  await expect(visit.locator('a[href^="https://www.richmond.gov.uk/"][href*="primary"]')).toBeVisible();
  const contact = visit.locator('a[href^="https://www.kewriverside.richmond.sch.uk/"]');
  await expect(contact).toHaveAccessibleName(/ask.*school.*visit/i);
  const destination = await contact.getAttribute('href');
  await page.route(destination, route => route.fulfill({ contentType: 'text/html', body: '<h1>Intercepted school contact</h1>' }));
  await activate(contact, hasTouch);
  await expect(page).toHaveURL(destination);
  await expect(page.getByRole('heading')).toHaveText('Intercepted school contact');
});

test('Contributions: letters lead to contextual evidence and optional video without adding permissions', async ({ page, hasTouch }) => {
  await page.goto('/index.html');
  await activate(page.locator('header a[href="letters.html"]:visible'), hasTouch);
  await expect(page.locator('#allow-public')).not.toBeChecked();
  await expect(page.locator('#allow-council')).not.toBeChecked();
  await activate(page.locator('main .form-route a[href="feedback.html?kind=evidence#feedback-form"]'), hasTouch);
  await expect(page).toHaveURL(/feedback\.html\?kind=evidence#feedback-form$/);
  await expect(page.locator('input[name="kind"][value="evidence"]')).toBeChecked();
  await expect(page.locator('#allow-public')).not.toBeChecked();
  await expect(page.locator('#message')).toHaveValue('');
  await page.goBack();
  await expect(page).toHaveURL(/letters\.html$/);
  await activate(page.locator('main .form-route a[href="videos.html#upload"]'), hasTouch);
  await expect(page).toHaveURL(/videos\.html#upload$/);
  await expect(page.locator('#recording-rule')).toContainText('Adults only. Keep children off camera.');
  await activate(page.locator('#upload-help > summary'), hasTouch);
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('New submissions require YouTube publication permission');
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText(/separate|permission/i);
  await expect(page.locator('main a[href="letters.html#letter-form"]').last()).toBeVisible();
});
