const fs = require('node:fs/promises');
const { test, expect } = require('./fixtures');

const unansweredQuestionIds = [
  'gap-budget', 'gap-pupil-impacts', 'gap-selection', 'gap-closure-costs',
  'gap-alternatives', 'gap-recruitment', 'gap-forecasts', 'gap-answers',
];

async function openQuestionFromSections(page, id, hasTouch) {
  const sections = page.locator('.page-sections');
  if (hasTouch) await sections.locator(':scope > summary').tap();
  else await sections.locator(':scope > summary').click();
  const link = sections.locator(`a[data-section-id="${id}"]`);
  // Scroll the popup alone so activating a sticky control cannot move the
  // document away from the reading position that this journey is testing.
  await link.evaluate(node => {
    const panel = node.closest('.section-panel');
    const item = node.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
    if (item.top < bounds.top) panel.scrollTop -= bounds.top - item.top;
    else if (item.bottom > bounds.bottom) panel.scrollTop += item.bottom - bounds.bottom;
  });
  const bounds = await link.boundingBox();
  if (hasTouch) await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  else await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}

async function refine(page, label, value) {
  const filters = page.locator('#record-refinements');
  if (!await filters.evaluate(node => node.open)) await filters.locator('summary').click();
  await page.getByLabel(label, { exact: true }).selectOption(value);
}


test('Report discovery: homepage links reach the web research and download the 44-page report', async ({ page, hasTouch }) => {
  await page.goto('/index.html');
  const shortcut = page.locator('#research-shortcut');
  await expect(shortcut).toContainText('44-page PDF');
  const web = shortcut.locator('a[href="lessons.html"]');
  if (hasTouch) await web.tap(); else await web.click();
  await expect(page).toHaveURL(/lessons\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What can other schools teach us?');
  await page.goBack();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    shortcut.locator('a[href="lessons-report.pdf"]').click(),
  ]);
  expect(download.suggestedFilename()).toBe('lessons-report.pdf');
  expect(await download.failure()).toBeNull();
  const contents = await fs.readFile(await download.path());
  expect(contents.subarray(0, 5).toString()).toBe('%PDF-');
});

test('Report discovery: remembered terms find the research and preserve its provenance', async ({ page }) => {
  await page.goto('/evidence.html#records');
  const report = page.locator('#source-lessons-report');
  for (const query of ['other schools', '12 schools', 'closure reversals', 'saved schools', 'report', '44-page PDF', '44 page PDF']) {
    await page.getByLabel('Search source records and research reports').fill(query);
    await expect(report).toBeVisible();
    await expect(page.locator('#research-count')).toHaveText('1 of 1 site research reports');
    await expect(page.locator('#no-results')).toBeHidden();
    await expect(report.locator('a[href="lessons.html"]')).toBeVisible();
    await expect(report.locator('a[href="lessons-report.pdf"]')).toBeVisible();
  }
  await expect(report).toContainText(/site research/i);
  await expect(report).toContainText(/synthesis/i);
  await expect(report).toContainText(/12 selected school reprieves/i);
  await expect(report).toContainText(/four closure comparisons/i);
  await expect(report).toContainText(/not an official record or a representative dataset/i);
  await expect(report).not.toHaveClass(/\bsource-card\b/);
  await expect(page.locator('.source-card')).toHaveCount(61);
  await page.reload();
  await expect(page.getByLabel('Search source records and research reports')).toHaveValue('44 page PDF');
  await expect(report).toBeVisible();
});

test('Report discovery: research filters, separate counts, empty state and reset agree', async ({ page }) => {
  await page.goto('/evidence.html#records');
  const report = page.locator('#source-lessons-report');
  await expect(page.locator('#result-count')).toHaveText('61 of 61 records');
  await expect(page.locator('#research-count')).toHaveText('1 of 1 site research reports');
  await refine(page, 'Record type', 'Site research');
  await expect(report).toBeVisible();
  await expect(page.locator('.source-card:visible')).toHaveCount(0);
  await expect(page.locator('#result-count')).toHaveText('0 of 61 records');
  await expect(page.locator('#no-results')).toBeHidden();
  await refine(page, 'Coverage', 'Synthesis');
  await expect(report).toBeVisible();
  await refine(page, 'Year', '2003');
  await expect(report).toBeHidden();
  await expect(page.locator('#research-count')).toHaveText('0 of 1 site research reports');
  await expect(page.locator('#no-results')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(report).toBeVisible();
  await expect(page.locator('.source-card:visible')).toHaveCount(61);
  await expect(page.locator('#result-count')).toHaveText('61 of 61 records');
  await expect(page.locator('#research-count')).toHaveText('1 of 1 site research reports');
  await expect(page.locator('#no-results')).toBeHidden();
  await expect(page.getByLabel('Search source records and research reports')).toBeFocused();
});

test('Report discovery: direct and repeated report anchors recover incompatible filters', async ({ page, hasTouch }) => {
  await page.goto('/evidence.html?q=impossible-report-search&type=Inspection&year=2003&status=Reviewed#source-lessons-report');
  const report = page.locator('#source-lessons-report');
  await expect(report).toBeVisible();
  await expect(report).toBeInViewport();
  await expect(page.getByLabel('Search source records and research reports')).toHaveValue('');
  await expect(page.getByLabel('Record type', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Year', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Coverage', { exact: true })).toHaveValue('');
  await refine(page, 'Record type', 'Inspection');
  await expect(report).toBeHidden();
  await expect(page).toHaveURL(/#source-lessons-report$/);
  const shortcut = page.locator('#research-shortcut[href="#source-lessons-report"]');
  if (hasTouch) await shortcut.tap(); else await shortcut.click();
  await expect(report).toBeVisible();
  await expect(report).toBeInViewport();
  await expect(page.getByLabel('Record type', { exact: true })).toHaveValue('');
});

test('Source search, combined filters, empty state and clear remain usable', async ({ page }) => {
  await page.goto('/evidence.html#records');
  const total = await page.locator('.source-card').count();
  await expect(page.locator('#result-count')).toHaveText(`${total} of ${total} records`);
  await page.getByLabel('Search source records and research reports').fill('Ofsted');
  expect(await page.locator('.source-card:visible').count()).toBeGreaterThan(0);
  expect(await page.locator('.source-card:visible').count()).toBeLessThan(total);
  await refine(page, 'Record type', 'Inspection');
  await refine(page, 'Year', '2003');
  await expect(page.locator('.source-card:visible')).toHaveCount(1);
  await expect(page.locator('.source-card:visible h3')).toContainText('First Ofsted inspection');
  await expect(page).toHaveURL(/q=Ofsted/);
  await page.reload();
  await expect(page.getByLabel('Search source records and research reports')).toHaveValue('Ofsted');
  await expect(page.locator('.source-card:visible')).toHaveCount(1);
  await page.getByLabel('Search source records and research reports').fill('no-record-can-match-this-test-phrase');
  await expect(page.locator('#no-results')).toBeVisible();
  await expect(page.locator('.source-card:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.source-card:visible')).toHaveCount(total);
  await expect(page.locator('#no-results')).toBeHidden();
  await expect(page.getByLabel('Search source records and research reports')).toBeFocused();
});

test('Direct evidence references remain visible when URL filters exclude them', async ({ page }) => {
  await page.goto('/evidence.html?q=no-record-can-match-this-test-phrase#source-inspection-2003');
  await expect(page.locator('#source-inspection-2003')).toBeVisible();
  await expect(page.locator('#source-inspection-2003')).toBeInViewport();
  await expect(page.getByLabel('Search source records and research reports')).toHaveValue('');
});

test('New source terms find the appropriate reviewed records without counting explanation links', async ({ page }) => {
  await page.goto('/evidence.html#records');
  const search = page.getByLabel('Search source records and research reports');
  await expect(search).toHaveAttribute('aria-describedby', 'record-search-help');
  await expect(page.locator('#record-search-help')).toContainText(/not the full text of linked documents or every website answer/i);
  for (const [term, record] of [
    ['reserves', 'source-school-balances-mar-2026'],
    ['amalgamation', 'source-prescribed-alterations-2025'],
    ['equality', 'source-school-organisation-eina-2026'],
    ['PFI', 'source-kew-finance-expenditure-history'],
  ]) {
    await search.fill(term);
    await expect(page.locator(`#${record}`)).toBeVisible();
    await expect(page.locator('#no-results')).toBeHidden();
    await expect(page.locator('.evidence-answer-links a')).toHaveCount(4);
    await expect(page.locator('.evidence-answer-links a').first()).toBeVisible();
  }
  await search.fill('nothing-in-this-source-register');
  await expect(page.locator('#no-results')).toBeVisible();
  await expect(page.locator('.evidence-answer-links a').first()).toBeVisible();
  await page.locator('#no-results a[href="evidence.html#records"]').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('#result-count')).toHaveText('61 of 61 records');
  await expect(page.locator('#no-results')).toBeHidden();
});

test('Evidence arrival leads with current Kew findings and retains historical cases', async ({ page, hasTouch }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/evidence.html#records');
  const findings = page.locator('#london-findings');
  await expect(page.locator('#kew-findings-title')).toBeInViewport();
  const historical = page.locator('#kew-findings a[href="#london-findings"]');
  if (hasTouch) await historical.tap(); else await historical.click();
  await expect(findings.getByRole('heading', {name:'Four London schools kept teaching.'})).toBeInViewport();
  await expect(findings.locator('.finding-outcomes')).toBeInViewport();
  await expect(findings).toContainText('Two adjudications in 2025');
  await expect(findings).toContainText('continued as an academy');
  await expect(findings).toContainText('not a London-wide total or a success rate');
  await expect(findings).toContainText('does not yet include a verified Richmond example');
  await expect(findings.locator('.finding-stories article')).toHaveCount(3);
  await expect(findings.locator('details')).toHaveCount(0);
  const escape = findings.locator('a[href="#source-search"]');
  if (hasTouch) await escape.tap(); else await escape.click();
  await expect(page.getByLabel('Search source records and research reports')).toBeInViewport();
  await page.goBack();
  await expect(page.locator('#london-findings-title')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('Unanswered questions overview presents eight priorities without opening one or mixing in resolved evidence', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/evidence.html#gaps');
  const questions = page.locator('#gaps .gaps-grid > article');
  expect(await questions.evaluateAll(nodes => nodes.map(node => node.id))).toEqual(unansweredQuestionIds);
  await expect(page.locator('#gaps .gap-detail[open]')).toHaveCount(0);
  await expect(page.locator('#gap-budget summary')).toBeInViewport({ ratio: 1 });
  for (const question of await questions.all()) {
    await expect(question.locator('summary h3')).toBeVisible();
    await expect(question.locator('summary .gap-state')).toBeVisible();
    await expect(question.locator('summary .gap-state')).not.toHaveText('Evidence found');
  }
  const sectionIds = await page.locator('.section-links a[data-section-id]').evaluateAll(links => links.map(link => link.dataset.sectionId));
  const questionSections = [...unansweredQuestionIds, 'evidence-found', 'gap-records'];
  expect(sectionIds.filter(id => questionSections.includes(id))).toEqual(questionSections);
  await expect(page.locator('#gaps .gaps-grid #evidence-found')).toHaveCount(0);
  const resolved = page.locator('#evidence-found');
  await expect(resolved.getByRole('heading', { name: 'The complete 2026 inspection report' })).toBeVisible();
  await expect(resolved.locator('.gap-state')).toHaveText('Evidence found');
  await expect(resolved.locator('a[href="#source-inspection-2026"]')).toHaveCount(1);
  await expect(page.locator('#gaps .gaps-grid #gap-records')).toHaveCount(0);
});

for (const id of unansweredQuestionIds) {
  test(`Unanswered questions: incoming ${id} reveals only its answer and distinguishes evidence from missing answers`, async ({ page }) => {
    await page.goto('/evidence.html#' + id);
    const question = page.locator('#' + id);
    await expect(question.locator('.gap-detail')).toHaveAttribute('open', '');
    await expect(page.locator('#gaps .gap-detail[open]')).toHaveCount(1);
    await expect(question.locator('summary')).toBeInViewport();
    const known = question.locator('.gap-detail > p').filter({ has: page.locator('strong', { hasText: /^Known:$/ }) });
    const missing = question.locator('.gap-detail > p').filter({ has: page.locator('strong', { hasText: /^Still unanswered:$/ }) });
    await expect(known).toBeVisible();
    await expect(missing).toBeVisible();
    expect(await known.locator('a[href]').count(), `${id} links its known position to evidence`).toBeGreaterThan(0);
  });
}

for (const id of ['gap-selection', 'gap-recruitment', 'gap-answers']) {
  test(`Unanswered questions: ${id} supports section navigation, repeated activation and Back`, async ({ page, hasTouch }) => {
    await page.goto('/evidence.html#gaps');
    await openQuestionFromSections(page, id, hasTouch);
    const detail = page.locator('#' + id + ' > .gap-detail');
    await expect(page).toHaveURL(new RegExp('#' + id + '$'));
    await expect(detail).toHaveAttribute('open', '');
    await expect(page.locator('#gaps .gap-detail[open]')).toHaveCount(1);
    await expect(detail.locator('summary')).toBeInViewport();
    // Use the native disclosure control, including keyboard operation on desktop.
    if (hasTouch) await detail.locator('summary').tap();
    else { await detail.locator('summary').focus(); await page.keyboard.press('Enter'); }
    await expect(detail).not.toHaveAttribute('open', '');
    await openQuestionFromSections(page, id, hasTouch);
    await expect(detail).toHaveAttribute('open', '');
    await expect(detail.locator('summary')).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(/evidence\.html#gaps$/);
    await expect(page.locator('#gaps h2')).toBeInViewport();
  });
}

test('Evidence gaps show dated requests without treating dispatch as disclosure', async ({ page }) => {
  await page.goto('/evidence.html#gap-budget');
  await expect(page.locator('#gaps .gaps-note')).toContainText('Request dates record dispatch, not disclosure or agreement');
  for (const [id, subject] of [
    ['gap-budget', /budget.*forecast/i],
    ['gap-alternatives', /options appraisal/i],
    ['gap-closure-costs', /cost comparison/i],
    ['gap-forecasts', /forecast versions/i],
    ['gap-pupil-impacts', /equality assessment/i],
  ]) {
    const note = page.locator(`#${id} .request-status`);
    await expect(note).toContainText('Requested 23 September 2026');
    await expect(note).toContainText(subject);
    await expect(note).not.toContainText(/FS-Case|Stoneman|@/i);
  }
});

test('New source anchors recover from incompatible saved filters and repeat visits', async ({ page }) => {
  const source = page.locator('#source-school-balances-mar-2026');
  await page.goto('/evidence.html?q=impossible-source-query&type=Inspection#source-school-balances-mar-2026');
  await expect(source).toBeVisible();
  await expect(source).toBeInViewport();
  await expect(page.getByLabel('Search source records and research reports')).toHaveValue('');
  await refine(page, 'Record type', 'Inspection');
  await expect(source).toBeHidden();
  await page.locator('#gap-budget summary').click();
  await page.locator('#gap-budget a[href="#source-school-balances-mar-2026"]').click();
  await expect(source).toBeVisible();
  await expect(source).toBeInViewport();
  await expect(page.getByLabel('Record type', { exact: true })).toHaveValue('');
});

test('Each source filter independently updates visible records', async ({ page }) => {
  for (const [label, value] of [['Topic', 'Funding & buildings'], ['Coverage', 'Index only'], ['Record type', 'Official dataset']]) {
    await page.goto('/evidence.html#records');
    const total = await page.locator('.source-card').count();
    await refine(page, label, value);
    expect(await page.locator('.source-card:visible').count()).toBeGreaterThan(0);
    expect(await page.locator('.source-card:visible').count()).toBeLessThan(total);
    await expect(page.locator('.source-card:visible').first()).toContainText(value);
  }
});

test('Checklist downloads as PDF and source index as CSV', async ({ page }) => {
  for (const [entry, name, filename, signature] of [
    ['/options.html#options', 'Printable question checklist (PDF)', 'kew-riverside-response-checklist.pdf', '%PDF-'],
    ['/evidence.html#records', 'Download the source index (CSV)', 'kew-riverside-source-index.csv', '"Title","Publisher"'],
  ]) {
    await page.goto(entry);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: new RegExp(name.replace(/[()]/g, '\\$&')) }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(filename);
    expect(await download.failure()).toBeNull();
    const contents = await fs.readFile(await download.path(), 'utf8');
    expect(contents.replace(/^\uFEFF/, '').startsWith(signature)).toBe(true);
  }
});

test('Charts and option details provide usable nonvisual alternatives', async ({ page }) => {
  await page.goto('/evidence.html#evidence');
  await page.locator('#borough-context > summary').click();
  const tables = page.locator('details.data-table');
  expect(await tables.count()).toBeGreaterThan(0);
  for (const details of await tables.all()) {
    await details.locator('summary').click();
    await expect(details.locator('table')).toBeVisible();
    expect(await details.locator('tbody tr').count()).toBeGreaterThan(0);
  }
  await page.goto('/options.html#option-enrolment');
  const campaign = page.locator('#option-enrolment');
  await expect(campaign.locator('.option-first')).toBeVisible();
  await expect(campaign.locator('.option-first .option-step')).toContainText('Suggest one local group or place');
  await campaign.locator('.option-evidence > summary').click();
  await expect(campaign.getByRole('heading', { name: 'What a full assessment needs' })).toBeVisible();
  await campaign.getByRole('link', { name: /Offer campaign help/ }).click();
  await expect(page).toHaveURL(/about.html#contact$/);
  await expect(page.locator('#contact')).toBeInViewport();
});

test('Evidence starts with explanations and optional detail, then opens the complete library by keyboard or touch', async ({ page, hasTouch }) => {
  await page.goto('/evidence.html');
  await expect(page.locator('.gap-detail[open]')).toHaveCount(0);
  const library = page.locator('#source-library');
  await expect(library).not.toHaveAttribute('open', '');
  await expect(page.locator('#record-refinements')).not.toHaveAttribute('open', '');
  await expect(page.locator('#council-figures')).not.toHaveAttribute('open', '');
  await expect(page.locator('.evidence-answer-links a')).toHaveCount(4);
  await expect(page.locator('#source-lessons-report a[href="lessons.html"]')).toBeVisible();
  const summary = library.locator(':scope > summary');
  if (hasTouch) await summary.tap();
  else { await summary.focus(); await page.keyboard.press('Enter'); }
  await expect(page.locator('#source-grid .source-card:visible')).toHaveCount(61);
  await expect(page.locator('.school-roll-chart .source-card')).toHaveCount(0);
  if (hasTouch) await summary.tap(); else await page.keyboard.press('Space');
  await expect(library).not.toHaveAttribute('open', '');
  await page.getByLabel('Search source records and research reports').fill('inspection');
  await expect(library).toHaveAttribute('open', '');
  await expect(page.locator('#source-inspection-2026')).toBeVisible();
  await expect(page.locator('#library-label')).toContainText('matching original records');
  for (const card of await page.locator('.source-card:visible').all()) {
    expect(await card.evaluate(node => Boolean(node.closest('#source-grid')))).toBe(true);
  }
});

test('Evidence source and gap links recover from closed detail and browser history', async ({ page }) => {
  await page.goto('/evidence.html#gap-budget');
  const gap = page.locator('#gap-budget .gap-detail');
  await expect(gap).toHaveAttribute('open', '');
  await gap.locator('a[href="#source-school-balances-mar-2026"]').click();
  await expect(page.locator('#source-school-balances-mar-2026')).toBeInViewport();
  await page.goBack();
  await expect(page.locator('#gap-budget')).toBeInViewport();
  await page.locator('#source-library > summary').click();
  await gap.locator('a[href="#source-school-balances-mar-2026"]').click();
  await expect(page.locator('#source-library')).toHaveAttribute('open', '');
  await expect(page.locator('#source-school-balances-mar-2026')).toBeInViewport();
});

test('Evidence repeated council-figures links reopen the chart and separate report links keep originals optional', async ({ page }) => {
  await page.goto('/evidence.html#evidence');
  await expect(page.locator('#council-figures')).toHaveAttribute('open', '');
  await page.locator('#council-figures > summary').click();
  await page.locator('.evidence-more a[href="#evidence"]').click();
  await expect(page.locator('#council-figures')).toHaveAttribute('open', '');
  await page.goto('/evidence.html#source-lessons-report');
  await expect(page.locator('#source-lessons-report')).toBeInViewport();
  await expect(page.locator('#source-library')).not.toHaveAttribute('open', '');
  const resolved = page.locator('.gap-detail').filter({has:page.getByRole('heading', {name:'The complete 2026 inspection report'})});
  await expect(resolved.locator('.gap-state')).toBeVisible();
  await expect(resolved.locator('.gap-state')).toHaveText('Evidence found');
});

test('Opening a source in another tab leaves the current reading position and library unchanged', async ({ page }) => {
  await page.goto('/evidence.html#gap-budget');
  const link = page.locator('#gap-budget a[href="#source-school-balances-mar-2026"]');
  // Prevent only the browser's new-tab default; still exercise the real modified click handlers.
  await link.evaluate(node => node.addEventListener('click', event => event.preventDefault(), { once: true }));
  await link.click({modifiers:['ControlOrMeta']});
  await expect(page.locator('#source-library')).not.toHaveAttribute('open', '');
  await expect(page.locator('#gap-budget')).toBeInViewport();
});


test('London findings lead directly to the named case with sources, and Back returns to the insight', async ({ page, hasTouch }) => {
  await page.goto('/evidence.html#records');
  for (const [finding, target] of [['finding-st-john','case-st-john'], ['finding-linked-schools','case-fenstanton'], ['finding-pooles','case-pooles']]) {
    const link = page.locator(`#${finding} a[href="lessons.html#${target}"]`);
    if (hasTouch) await link.tap(); else await link.click();
    await expect(page.locator('#' + target)).toHaveAttribute('open', '');
    await expect(page.locator('#' + target)).toBeInViewport();
    await expect(page.locator(`#${target} .source-note a`).first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/evidence\.html#records$/);
    await expect(link).toBeVisible();
  }
});

test('Saved Evidence searches canonicalize the search anchor while retaining filters and Back', async ({ page }) => {
  for (const hash of ['', '#records']) {
    // Start a new document: adding a hash to this same URL is an in-page jump.
    await page.goto('/index.html');
    await page.goto('/evidence.html?q=Ofsted&type=Inspection&year=2003' + hash);
    const search = page.getByLabel('Search source records and research reports');
    await expect(search).toHaveValue('Ofsted');
    await expect(search).toBeInViewport();
    await expect(page.locator('.source-card:visible')).toHaveCount(1);
    await expect(page.locator('.source-card:visible h3')).toContainText('First Ofsted inspection');
    await expect(page).toHaveURL(/evidence\.html\?q=Ofsted&type=Inspection&year=2003#source-search$/);
    await page.locator('#evidence-navigation a[href="#records"]').click();
    await expect(page.locator('#kew-findings-title')).toBeInViewport();
    await expect(search).toHaveValue('Ofsted');
    await page.goBack();
    await expect(search).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(/index\.html$/);
  }
});


test('Non-search query parameters and invalid filters keep the findings entry', async ({ page }) => {
  await page.goto('/evidence.html?preview=insights&topic=not-a-topic#records');
  await expect(page.locator('#kew-findings-title')).toBeInViewport();
  await expect(page).toHaveURL(/\?preview=insights&topic=not-a-topic#records$/);
  await expect(page.locator('#topic-filter')).toHaveValue('');
  await expect(page.locator('#source-library')).not.toHaveAttribute('open', '');
});
