const { test, expect, expectStillArrival } = require('./fixtures');
const { readFileSync } = require('node:fs');
const data = JSON.parse(readFileSync(require('node:path').join(__dirname, '../../lessons-data.json'), 'utf8'));
async function activate(locator, hasTouch) { if (hasTouch) await locator.tap(); else await locator.click(); }

test('Research: proposal offers a compact route to the optional catalogue and report', async ({ page, hasTouch }) => {
  await page.goto('/proposal.html#other-schools');
  const section = page.locator('#other-schools');
  await expect(section).toContainText('12 reprieves');
  await expect(section.locator('img')).toHaveCount(0);
  await activate(section.getByRole('link', { name: 'Explore lessons from other schools' }), hasTouch);
  await expect(page).toHaveURL(/lessons.html$/);
  expect((await page.locator('h1').innerText()).replace(/\s+/g,' ').trim()).toBe('What can other schools teach us?');
  await expect(page.locator('.lesson-exhibit')).toHaveCount(8);
  await expect(page.locator('.lesson-exhibit[open]')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download full report (PDF)', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('lessons-report.pdf');
});

test('Research: paired findings and their limits precede the optional research index', async ({ page }) => {
  await page.goto('/lessons.html#key-lessons');
  const findings = page.locator('.lesson-takeaways article');
  await expect(findings).toHaveCount(3);
  for (const finding of await findings.all()) {
    await expect(finding.getByText('Outcome', { exact: true })).toBeVisible();
    await expect(finding.getByText('What the record supports', { exact: true })).toBeVisible();
    await expect(finding.locator('.lesson-caveat')).toBeVisible();
    await expect(finding.locator('.lesson-implication')).toContainText('editorial interpretation');
    await expect(finding.locator('details')).toHaveCount(0);
  }
  await expect(page.locator('#lesson-financial-plan')).toContainText('largely one-off support');
  await expect(page.locator('#lesson-financial-plan .lesson-caveat')).toContainText('recurring deficits');
  await expect(page.locator('#lesson-decision-and-transition')).toContainText('extra term for transition');
  await expect(page.locator('#lesson-decision-and-transition .lesson-caveat')).toContainText('not an automatic right of appeal');
  await expect(page.locator('#lesson-petition-evidence')).toContainText('do not measure their effect');
  await expect(page.locator('.lesson-next')).toContainText('does not reach the council');
  await expect(page.locator('.lesson-next a[href="proposal.html#take-part"]')).toBeVisible();
  expect(await page.locator('#key-lessons').evaluate(el => Boolean(el.compareDocumentPosition(document.querySelector('[aria-label="Research sections"]')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  const boxes = await findings.evaluateAll(nodes => nodes.map(node => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom })));
  expect(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom);
  expect(boxes[2].top).toBeGreaterThanOrEqual(boxes[1].bottom);
  await page.getByRole('link', { name: 'Browse all 16 schools', exact: true }).click();
  await expect(page).toHaveURL(/#catalogue$/);
  await expect(page.locator('#catalogue')).toBeInViewport();
});

test('Research: each paired school opens its case directly and Back returns to the findings', async ({ page, hasTouch }) => {
  await page.goto('/lessons.html#key-lessons');
  for (const id of ['fletching', 'broad-oak', 'st-john', 'st-bartholomew', 'godshill', 'brading', 'oakfield', 'wroxall', 'arreton', 'cowes']) {
    await activate(page.locator(`#key-lessons a[href="#case-${id}"]`), hasTouch);
    await expect(page).toHaveURL(new RegExp(`#case-${id}$`));
    await expect(page.locator(`#case-${id}`)).toHaveAttribute('open', '');
    await expect(page.locator(`#case-${id} > summary`)).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(/#key-lessons$/);
    await expect(page.locator('#key-lessons')).toBeInViewport();
  }
});

test('Research: a repeated finding link restores a filtered case without hijacking modified clicks', async ({ page, hasTouch }) => {
  await page.goto('/lessons.html#key-lessons');
  const link = page.locator('#key-lessons a[href="#case-fletching"]');
  const entry = page.locator('#case-fletching');
  await activate(link, hasTouch);
  await activate(entry.locator(':scope > summary'), hasTouch);
  await page.locator('#lesson-outcome').selectOption('closure');
  await expect(entry).toBeHidden();
  // Prevent the native new-tab action only after the document's delegated handler runs.
  await link.evaluate(node => {
    window.addEventListener('click', event => event.preventDefault(), { once: true });
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true, button: 0 }));
  });
  await expect(entry).toBeHidden();
  await expect(entry).not.toHaveAttribute('open', '');
  await expect(page.locator('#lesson-outcome')).toHaveValue('closure');
  await activate(link, hasTouch);
  await expect(entry).toBeVisible();
  await expect(entry).toHaveAttribute('open', '');
  await expect(entry.locator(':scope > summary')).toBeInViewport();
  await expect(page.locator('#lesson-outcome')).toHaveValue('all');
});

test('Research: findings remain readable with enlarged text on a narrow phone', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/lessons.html');
    await page.evaluate(() => {
      const text = [...document.querySelectorAll('.lesson-landing-hero :is(h1,p,a,strong), #key-lessons :is(h2,h3,p,a,span,strong)')];
      const sizes = text.map(node => parseFloat(getComputedStyle(node).fontSize) * 2);
      text.forEach((node, index) => { node.style.fontSize = `${sizes[index]}px`; });
    });
    const overflow = await page.locator('.lesson-landing-hero, .lesson-landing-hero *, #key-lessons, #key-lessons *').evaluateAll(nodes => nodes.filter(node => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
    }).map(node => node.tagName + (node.className ? '.' + node.className : '')));
    expect(overflow, `Findings reflow at ${width}px with 200% text`).toEqual([]);
    await expect(page.locator('#lesson-financial-plan .lesson-caveat')).toBeVisible();
    await expect(page.locator('#lesson-decision-and-transition .lesson-caveat')).toBeVisible();
    await expect(page.locator('#lesson-petition-evidence .lesson-caveat')).toBeVisible();
  }
});

test.describe('Research without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('paired findings link to native cases and preserve source access', async ({ page, hasTouch }) => {
    await page.goto('/lessons.html#key-lessons');
    await expect(page.locator('#lesson-financial-plan .lesson-caveat')).toBeVisible();
    await expect(page.locator('#lesson-decision-and-transition .lesson-caveat')).toBeVisible();
    await expect(page.locator('#lesson-petition-evidence .lesson-caveat')).toBeVisible();
    await activate(page.locator('#key-lessons a[href="#case-broad-oak"]'), hasTouch);
    await expect(page).toHaveURL(/#case-broad-oak$/);
    const entry = page.locator('#case-broad-oak');
    await expect(entry.locator(':scope > summary')).toBeInViewport();
    if (await entry.getAttribute('open') === null) await activate(entry.locator(':scope > summary'), hasTouch);
    await expect(entry.locator('.lesson-case-body')).toBeVisible();
    await activate(entry.locator('a[href="lessons-sources.html#S24"]').last(), hasTouch);
    await expect(page.locator('#S24')).toBeInViewport();
  });
});

test('Research: all eight graphics expand with readable data, sources and working downloads', async ({ page, hasTouch, request }) => {
  await page.goto('/lessons.html#visual-guide');
  for (const e of data.exhibits) {
    const exhibit = page.locator(`#exhibit-${e.number}`);
    await activate(exhibit.locator(':scope > summary'), hasTouch);
    await expect(exhibit).toHaveAttribute('open', '');
    const img = exhibit.locator('img');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    const notes = exhibit.locator('.lesson-data');
    await activate(notes.locator('summary'), hasTouch);
    await expect(notes).toHaveAttribute('open', '');
    await expect(notes).toContainText(/\S/);
    const res = await request.get(`/lessons-${e.file}.png`);
    expect(res.ok()).toBe(true); expect(res.headers()['content-type']).toContain('image/png');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    for (const region of await notes.getByRole('region').all()) {
      await expect(region).toHaveAttribute('tabindex', '0');
      const dimensions = await region.evaluate(el => ({ width: el.clientWidth, full: el.scrollWidth }));
      if (dimensions.full > dimensions.width) {
        await region.evaluate(el => { el.scrollLeft = 100; });
        expect(await region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      }
    }
    await activate(exhibit.locator(':scope > summary'), hasTouch);
  }
});

// Main run 35781407831: a long smooth jump moved #exhibit-1 beneath an immediate click in desktop WebKit.
test('Research: shared graphic, case and source links land still before a disclosure is opened', async ({ page, hasTouch }) => {
  for (const [url, selector] of [['/lessons.html#visual-guide', '#visual-guide'], ['/lessons.html#case-hazlewood', '#case-hazlewood'], ['/lessons-sources.html#X04', '#X04']]) {
    await page.goto(url);
    await expectStillArrival(page, selector);
  }
  await page.goto('/lessons.html#visual-guide');
  const exhibit = page.locator('#exhibit-1');
  await activate(exhibit.locator(':scope > summary'), hasTouch);
  await expect(exhibit).toHaveAttribute('open', '');
});

test('Research: search and outcome filters combine, show no results and clear accessibly', async ({ page }) => {
  await page.goto('/lessons.html#catalogue');
  await expect(page.locator('.lesson-case:not([hidden])')).toHaveCount(16);
  await page.locator('#lesson-search').fill('Lambeth');
  await expect(page.locator('.lesson-case:not([hidden])')).toHaveCount(3);
  await page.locator('#lesson-outcome').selectOption('closure');
  await expect(page.locator('#lesson-empty')).toBeVisible();
  await expect(page.locator('#lesson-count')).toHaveText('0 schools shown');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('#lesson-search')).toBeFocused();
  await expect(page.locator('.lesson-case:not([hidden])')).toHaveCount(16);
  await page.locator('#lesson-outcome').selectOption('closure');
  await expect(page.locator('.lesson-case:not([hidden])')).toHaveCount(4);
});

test('Research: direct case and evidence links reveal disclosures and restore filtered cases', async ({ page }) => {
  await page.goto('/lessons.html#case-hazlewood');
  await expect(page.locator('#case-hazlewood')).toHaveAttribute('open','');
  await expect(page.locator('#case-hazlewood')).toContainText(/renewed/i);
  await page.locator('#lesson-outcome').selectOption('closure');
  await page.evaluate(() => { location.hash = '#case-pooles'; });
  await expect(page.locator('#case-pooles')).toHaveAttribute('open','');
  await expect(page.locator('#case-pooles')).toBeVisible();
  await expect(page.locator('#lesson-outcome')).toHaveValue('all');
  await page.goto('/lessons-sources.html#X04');
  await expect(page.locator('#X04')).toHaveAttribute('open','');
  await expect(page.locator('#X04')).toBeInViewport();
  await page.locator('#X04 a[href="lessons-sources.html#S01"]').click();
  await expect(page.locator('#S01')).toBeInViewport();
});

test('Research: keyboard disclosures and full citation register remain accessible', async ({ page }) => {
  await page.goto('/lessons.html');
  const summary = page.locator('#exhibit-4 > summary');
  await summary.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#exhibit-4')).toHaveAttribute('open','');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#exhibit-4')).not.toHaveAttribute('open','');
  await page.goto('/lessons-sources.html');
  expect((await page.locator('h1').innerText()).replace(/\s+/g,' ').trim()).toBe('Follow every claim back to its source.');
  await expect(page.locator('.lesson-source')).toHaveCount(45);
  await expect(page.locator('.lesson-claim')).toHaveCount(49);
  for (const s of data.sources) await expect(page.locator(`#${s.id} .lesson-full-url`)).toHaveAttribute('href',s.url);
});
