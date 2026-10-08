const { test, expect, pages, expectStillArrival, expectScrollSettled } = require('./fixtures');

test('Orientation: delayed final styles settle before the initial Options fragment jump', async ({ page }) => {
  await page.goto('/proposal.html#plan-keep-going');
  await page.route('**/orientation.css?*', async route => {
    const response = await route.fetch();
    // A slow final stylesheet must not leave the initial jump using old offsets.
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.fulfill({ response });
  });
  await page.addInitScript(() => {
    window.initialFragmentOffsets = [];
    const scrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      if (this.id === 'options') {
        const root = document.documentElement;
        window.initialFragmentOffsets.push({
          ready: root.classList.contains('has-orientation'),
          padding: parseFloat(getComputedStyle(root).scrollPaddingTop),
          margin: parseFloat(getComputedStyle(this).scrollMarginTop),
          height: document.querySelector('.site-orientation').getBoundingClientRect().height,
        });
      }
      return scrollIntoView.apply(this, args);
    };
  });
  await page.locator('#plan-keep-going a[href="options.html#options"]').click();
  await page.waitForURL('**/options.html#options', { waitUntil: 'load' });
  await expectStillArrival(page, '#options');
  const jumps = await page.evaluate(() => window.initialFragmentOffsets);
  expect(jumps.length).toBeGreaterThan(0);
  for (const jump of jumps) {
    expect(jump.ready).toBe(true);
    expect(jump.margin).toBe(12);
    expect(jump.padding).toBeCloseTo(jump.height + 12, 1);
  }
});

async function activate(locator, hasTouch) {
  if (await locator.evaluate(node => document.documentElement.classList.contains('has-orientation') && Boolean(node.closest('.site-orientation')))) {
    // Locator auto-scroll can scroll the whole document to a sticky ancestor.
    // A visitor instead taps the visible control, scrolling only its menu panel.
    await locator.evaluate(node => {
      const panel = node.closest('.section-panel, .mobile-menu nav');
      if (!panel) return;
      const item = node.getBoundingClientRect(), viewport = panel.getBoundingClientRect();
      if (item.top < viewport.top) panel.scrollTop -= viewport.top - item.top;
      else if (item.bottom > viewport.bottom) panel.scrollTop += item.bottom - viewport.bottom;
    });
    const bounds = await locator.boundingBox();
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    if (hasTouch) await locator.page().touchscreen.tap(point.x, point.y);
    else await locator.page().mouse.click(point.x, point.y);
  } else if (hasTouch) await locator.tap();
  else await locator.click();
}
const mainPages = [
  ['index.html', 'Home'], ['about.html', 'About'], ['proposal.html', 'Proposal & dates'],
  ['faq.html', 'FAQ'], ['understand.html', 'Numbers & results'], ['options.html', 'Ways to keep Kew open'],
  ['lessons.html', 'Lessons'], ['evidence.html', 'Evidence'],
];
// The curated Menu (27 September 2026): three labelled groups, official response
// first. Pages outside it stay in every footer (footerLinks).
const menuGroups = [
  ['Take part', [['Respond to the council', 'proposal.html#take-part'], ['Parent action plan', 'proposal.html#parent-plan'], ['Community letters', 'letters.html'], ['Share a video', 'videos.html#upload'], ['Share ideas', 'feedback.html']]],
  ['Understand the proposal', [['Proposal & dates', 'proposal.html'], ['FAQ', 'faq.html'], ['Numbers & results', 'understand.html'], ['Ways to keep Kew open', 'options.html'], ['Evidence', 'evidence.html#records'], ['Unanswered questions', 'evidence.html#gaps']]],
  ['This website', [['Home', 'index.html'], ['About & contact', 'about.html']]],
];
const menuNames = menuGroups.flatMap(([, links]) => links.map(([label]) => label));
const footerLinks = ['about.html', 'proposal.html', 'faq.html', 'evidence.html#records', 'letters.html', 'feedback.html', 'videos.html#upload', 'lessons.html', 'supporters.html', 'corrections.html', 'lessons-sources.html', 'privacy.html', 'privacy.html#analytics'];

async function activeSection(page) {
  return page.locator('.section-links a[aria-current="location"]').evaluateAll(links => links.length === 1 ? links[0].dataset.sectionId : null);
}
async function expectUncovered(page, target) {
  await expect(target).toBeInViewport();
  const boxes = await Promise.all([page.locator('.site-orientation').boundingBox(), target.boundingBox()]);
  expect(boxes[1].y, 'The destination clears the persistent orientation region').toBeGreaterThanOrEqual(boxes[0].y + boxes[0].height - 1);
}

test('Orientation: Back preserves a later reading position and a subsequent departure from the top', async ({ page, hasTouch }) => {
  // Keep native fragment reapplication separate from reading-position recovery.
  // The shared QR regression independently covers the incoming #upload route.
  await page.goto('/videos.html');
  await page.locator('#upload-help summary').click();
  const originalURL = page.url();
  await page.evaluate(() => history.replaceState({ ...history.state, existingVisitorState: 'keep' }, ''));
  const link = page.locator('#legacy-google-upload-link');
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeInViewport();
  const departureY = await page.evaluate(() => scrollY);
  expect(departureY).toBeGreaterThan(1000);
  const destination = await link.getAttribute('href');
  await page.route(destination, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Fictional video channel</h1>' }));
  await activate(link, hasTouch);
  await page.waitForURL(destination, { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: 'Fictional video channel' })).toBeVisible();
  const historyLength = await page.evaluate(() => history.length);
  await page.goBack();
  await page.waitForURL(originalURL, { waitUntil: 'load' });
  await expect(page.locator('.page-name')).toHaveText('Share a video');
  await expect(page.locator('#upload-help')).toHaveAttribute('open', '');
  await expect.poll(() => page.evaluate(y => Math.abs(scrollY - y), departureY)).toBeLessThanOrEqual(2);
  await expectScrollSettled(page, 'Back to the later video section');
  await expect(link).toBeInViewport({ ratio: 0.5 });
  expect(await page.evaluate(() => history.state.existingVisitorState)).toBe('keep');
  await expect.poll(() => page.evaluate(() => history.state.kewReadingPosition)).toBeUndefined();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);

  // A real departure from the top must supersede the earlier reading position.
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await activate(page.locator('.brand'), hasTouch);
  await page.waitForURL('**/index.html', { waitUntil: 'load' });
  await expect(page.locator('#find-your-way')).toBeVisible();
  await page.goBack();
  await page.waitForURL(originalURL, { waitUntil: 'load' });
  await expect(page.locator('.page-name')).toHaveText('Share a video');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(await page.evaluate(() => history.state.existingVisitorState)).toBe('keep');
  expect(await page.evaluate(() => history.state.kewReadingPosition)).toBeUndefined();
  await expectScrollSettled(page, 'Back after departing from the top');
});

test('Orientation: reloaded Back restores reading after a late native fragment jump', async ({ page }) => {
  await page.goto('/proposal.html#parent-plan');
  const write = page.locator('#plan-share a[href="letters.html#letter-form"]');
  await write.scrollIntoViewIfNeeded();
  const departureY = await page.evaluate(() => scrollY);
  await page.evaluate(async y => {
    history.replaceState({ ...history.state, existingVisitorState: 'keep', kewReadingPosition: { url: location.href, x: 0, y } }, '');
    const getEntries = performance.getEntriesByType;
    performance.getEntriesByType = type => type === 'navigation' ? [{ type: 'back_forward' }] : getEntries.call(performance, type);
    try {
      // Hosted WebKit first returns to the departure, then reapplies the original
      // fragment after pageshow's first frame. Replay that observed ordering.
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
      await new Promise(resolve => requestAnimationFrame(() => {
        document.getElementById('parent-plan').scrollIntoView({ block: 'start', behavior: 'instant' });
        resolve();
      }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    } finally { performance.getEntriesByType = getEntries; }
  }, departureY);
  await expect(write).toBeInViewport();
  expect(Math.abs(await page.evaluate(() => scrollY) - departureY)).toBeLessThan(5);
  expect(await page.evaluate(() => history.state.existingVisitorState)).toBe('keep');
  expect(await page.evaluate(() => history.state.kewReadingPosition)).toBeUndefined();
  await expectScrollSettled(page, 'Back after a late native fragment jump');
});

test('Orientation: pending Back recovery yields to a new destination, manual recovery or user input', async ({ page }) => {
  await page.goto('/videos.html');
  await page.locator('#upload-help summary').click();
  for (const phase of ['immediate', 'after-first-frame']) for (const change of ['destination', 'cleared-state', 'manual', 'pointer', 'keyboard', 'click', 'input', 'change', 'wheel', 'native-restored']) {
    const result = await page.evaluate(async ({ change, phase }) => {
      history.scrollRestoration = 'auto';
      history.replaceState(history.state, '', '/videos.html');
      history.replaceState({ kewReadingPosition: { url: location.href, x: 0, y: 900 } }, '');
      scrollTo({ top: 0, behavior: 'instant' });
      document.activeElement.blur();
      const historyLength = history.length;
      // Reproduce the narrow pageshow-to-frame window without contacting a provider.
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      const changeReturn = () => {
        if (change === 'destination') history.replaceState(history.state, '', '#process-title');
        if (change === 'cleared-state') history.replaceState(null, '');
        if (change === 'manual') history.scrollRestoration = 'manual';
        if (change === 'pointer') document.dispatchEvent(new PointerEvent('pointerdown'));
        if (change === 'keyboard') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
        if (['click', 'input', 'change'].includes(change)) document.body.dispatchEvent(new Event(change, { bubbles: true }));
        if (change === 'wheel') window.dispatchEvent(new WheelEvent('wheel'));
        if (change === 'native-restored') scrollTo({ top: 450, behavior: 'instant' });
      };
      if (phase === 'after-first-frame') await new Promise(resolve => requestAnimationFrame(() => { changeReturn(); resolve(); }));
      else changeReturn();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { y: scrollY, sameHistory: history.length === historyLength, focused: document.activeElement.tagName, saved: Boolean(history.state?.kewReadingPosition) };
    }, { change, phase });
    expect(result, `${phase}: ${change}`).toEqual({ y: change === 'native-restored' ? 450 : 0, sameHistory: true, focused: 'BODY', saved: false });
  }
});

test('Orientation: each main page has a stable identity and the complete menu in the same order', async ({ page, hasTouch }) => {
  for (const [file, name] of mainPages) {
    await page.goto('/' + file);
    await expect(page.locator('.site-orientation .page-name')).toHaveText(name);
    await expect(page.locator('.mobile-menu')).toHaveCount(1);
    const menu = page.locator('.mobile-menu');
    await activate(menu.locator(':scope > summary'), hasTouch);
    const names = await menu.locator('a').allTextContents();
    expect(names.map(text => text.trim())).toEqual(menuNames);
    // A page outside the curated Menu is still one tap away in its footer.
    const label = name === 'About' ? 'About & contact' : name;
    if (menuNames.includes(label)) await expect(menu.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
    else await expect(page.locator('footer').getByRole('link', { name, exact: true })).toHaveCount(1);
    const questions = menu.getByRole('link', { name: 'Unanswered questions', exact: true });
    await expect(questions).toBeVisible();
    await expect(questions).toHaveAttribute('href', 'evidence.html#gaps');
    await expect(questions).not.toHaveAttribute('aria-current', 'page');
    for (const [label, href] of [['Community letters', 'letters.html'], ['Share ideas', 'feedback.html']]) {
      await expect(menu.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
    }
  }
});

test('Orientation: Unanswered questions opens its named section and repeated menu visits return there', async ({ page, hasTouch }) => {
  await page.goto('/index.html');
  const menu = page.locator('.mobile-menu');
  const questions = menu.getByRole('link', { name: 'Unanswered questions', exact: true });
  await activate(menu.locator(':scope > summary'), hasTouch);
  await activate(questions, hasTouch);
  await expect(page).toHaveURL(/evidence\.html#gaps$/);
  const heading = page.locator('#gaps h2');
  await expect(heading).toHaveText('Unanswered questions');
  await expectUncovered(page, heading);
  await expect(page.locator('.page-name')).toHaveText('Evidence');
  await expect(page.locator('.section-links a[data-section-id="gaps"]')).toHaveText('Unanswered questions');
  await expect(menu).not.toHaveAttribute('open', '');

  // Reading farther down leaves the hash unchanged; the same menu link must
  // still return to the questions instead of doing nothing on a repeated hash.
  await page.locator('#method').evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await expect(heading).not.toBeInViewport();
  await expect(page).toHaveURL(/evidence\.html#gaps$/);
  await activate(menu.locator(':scope > summary'), hasTouch);
  await activate(questions, hasTouch);
  await expectUncovered(page, heading);
  await expectScrollSettled(page, 'Repeated Unanswered questions menu arrival');
  await expect(menu).not.toHaveAttribute('open', '');
});

test('Orientation: keyboard users reach Unanswered questions directly after Evidence', async ({ page, browserName }) => {
  await page.goto('/index.html');
  const menu = page.locator('.mobile-menu');
  const next = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await menu.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i <= menuNames.indexOf('Evidence'); i++) await page.keyboard.press(next);
  await expect(menu.getByRole('link', { name: 'Evidence', exact: true })).toBeFocused();
  await page.keyboard.press(next);
  await expect(menu.getByRole('link', { name: 'Unanswered questions', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/evidence\.html#gaps$/);
  await expectUncovered(page, page.getByRole('heading', { name: 'Unanswered questions', exact: true }));
  await expect(menu).not.toHaveAttribute('open', '');
});

test('Orientation: the complete menu works on desktop and retains a return to the current section', async ({ page, hasTouch }) => {
  await page.goto('/evidence.html#method');
  const menu = page.locator('.mobile-menu');
  await activate(menu.locator(':scope > summary'), hasTouch);
  await activate(menu.getByRole('link', { name: 'About & contact', exact: true }), hasTouch);
  await expect(page).toHaveURL(/about\.html$/);
  await expect(page.locator('.page-name')).toHaveText('About');
  await page.goBack();
  await expect(page).toHaveURL(/evidence\.html#method$/);
  await expect(page.locator('#method')).toBeInViewport();
  await activate(menu.locator(':scope > summary'), hasTouch);
  await activate(menu.getByRole('link', { name: 'Ways to keep Kew open', exact: true }), hasTouch);
  await expect(page).toHaveURL(/options\.html$/);
  await expect(page.locator('.page-name')).toHaveText('Ways to keep Kew open');
});

test('Orientation: passive reading updates location without changing URL, history or keyboard focus', async ({ page }) => {
  await page.goto('/evidence.html');
  const summary = page.locator('.mobile-menu > summary');
  await summary.focus();
  const initial = await page.evaluate(() => ({ url: location.href, history: history.length }));
  for (const id of ['source-search', 'earlier-record', 'method']) {
    await page.locator('#' + id).evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect.poll(() => activeSection(page)).toBe(id);
    await expect(page.locator('.section-trail')).toContainText(await page.locator(`.section-links a[data-section-id="${id}"]`).textContent());
    await expect(page.locator('.page-name')).toHaveText('Evidence');
    await expect(page.locator('.site-orientation')).toBeInViewport({ ratio: 1 });
    await expect(summary).toBeFocused();
    expect(await page.evaluate(() => ({ url: location.href, history: history.length }))).toEqual(initial);
    const region = await page.locator('.site-orientation').boundingBox();
    expect(region.y).toBeGreaterThanOrEqual(-1);
    expect(region.y + region.height).toBeLessThan(await page.evaluate(() => innerHeight));
  }
});

test('Orientation: on-page links reveal nested content, repeat safely and keep Back useful', async ({ page, hasTouch }) => {
  await page.goto('/options.html#options');
  const sections = page.locator('.page-sections');
  await activate(sections.locator(':scope > summary'), hasTouch);
  await activate(sections.locator('a[data-section-id="option-crowdfunding"]'), hasTouch);
  const funding = page.locator('#option-crowdfunding > details.option-card');
  await expect(page).toHaveURL(/#option-crowdfunding$/);
  await expect(funding).toHaveAttribute('open', '');
  await expect(sections).not.toHaveAttribute('open', '');
  await expectUncovered(page, funding.locator(':scope > summary'));
  await activate(funding.locator(':scope > summary'), hasTouch);
  await expect(funding).not.toHaveAttribute('open', '');
  await activate(sections.locator(':scope > summary'), hasTouch);
  await activate(sections.locator('a[data-section-id="option-crowdfunding"]'), hasTouch);
  await expect(funding).toHaveAttribute('open', '');
  await expectUncovered(page, funding.locator(':scope > summary'));
  await page.goBack();
  await expect(page).toHaveURL(/#options$/);
  await expect(page.locator('#options h1')).toBeInViewport();
});

test('Orientation: section tracking excludes closed content and filtered-out FAQ groups', async ({ page }) => {
  await page.goto('/faq.html#learning');
  await expect(page.locator('h1')).toHaveText('FAQ');
  const search = page.getByRole('searchbox', { name: 'Find an answer', exact: true });
  await search.fill('no-matching-answer-orientation-test');
  await expect.poll(async () => page.locator('.section-links a[aria-current="location"]').evaluateAll(links => links.every(link => {
    const target = document.getElementById(link.dataset.sectionId);
    if (!target) return false;
    for (let node = target; node; node = node.parentElement) {
      if (node.hidden || getComputedStyle(node).display === 'none') return false;
      if (node !== target && node.tagName === 'DETAILS' && !node.open && !node.querySelector(':scope > summary')?.contains(target)) return false;
    }
    return true;
  }))).toBe(true);
  await expect(page.locator('.page-name')).toHaveText('FAQ');
  await search.fill('');
  await page.goto('/understand.html#forecast-checks');
  const detail = page.locator('#forecast-detail');
  if (await detail.getAttribute('open') !== null) await detail.locator(':scope > summary').click();
  await page.locator('#forecast-checks').evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await expect.poll(async () => page.locator('.section-links a[aria-current="location"]').evaluateAll(links => links.every(link => {
    const target = document.getElementById(link.dataset.sectionId);
    return target && (target.id === 'forecast-detail' || !target.closest('#forecast-detail:not([open])'));
  }))).toBe(true);
});

test('Orientation: menus share keyboard focus, Escape and outside-dismissal rules', async ({ page, hasTouch, browserName }) => {
  await page.goto('/options.html');
  const menu = page.locator('.mobile-menu');
  const sections = page.locator('.page-sections');
  // Start as a keyboard visitor; iOS emulation retains its touch navigation
  // starting point when synthetic Tab events follow an earlier touch sequence.
  await sections.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(sections).toHaveAttribute('open', '');
  const next = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(next);
  await expect(sections.locator('.section-links a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sections).not.toHaveAttribute('open', '');
  await expect(sections.locator(':scope > summary')).toBeFocused();
  await activate(menu.locator(':scope > summary'), hasTouch);
  await activate(sections.locator(':scope > summary'), hasTouch);
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(sections).toHaveAttribute('open', '');
  await activate(menu.locator(':scope > summary'), hasTouch);
  await expect(sections).not.toHaveAttribute('open', '');
  await expect(menu).toHaveAttribute('open', '');
  const bottom = await page.locator('.site-orientation').evaluate(node => node.getBoundingClientRect().bottom);
  // The expanded menu covers the heading on narrow screens. Use the visible
  // page gutter, rather than trying to click content underneath the popup.
  expect(await page.evaluate(y => !document.elementFromPoint(4, y)?.closest('.site-orientation'), bottom + 12)).toBe(true);
  if (hasTouch) await page.touchscreen.tap(4, bottom + 12);
  else await page.mouse.click(4, bottom + 12);
  await expect(menu).not.toHaveAttribute('open', '');
});

test('Orientation: copying the current section reports success without navigating', async ({ page, hasTouch, baseURL }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__sectionCopied = value; } } });
  });
  await page.goto('/options.html#option-crowdfunding');
  await expect.poll(() => activeSection(page)).toBe('option-crowdfunding');
  const before = await page.evaluate(() => ({ url: location.href, history: history.length }));
  await activate(page.locator('.page-sections > summary'), hasTouch);
  await activate(page.locator('.section-copy'), hasTouch);
  await expect.poll(() => page.evaluate(() => window.__sectionCopied)).toBe(baseURL + '/options.html#option-crowdfunding');
  await expect(page.locator('.section-copy-status')).toContainText(/copied/i);
  expect(await page.evaluate(() => ({ url: location.href, history: history.length }))).toEqual(before);
});

test('Orientation: clipboard rejection exposes a selectable link instead of losing the action', async ({ page, hasTouch, baseURL }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard unavailable in this test'); } } });
  });
  await page.goto('/options.html#option-crowdfunding');
  await expect.poll(() => activeSection(page)).toBe('option-crowdfunding');
  await activate(page.locator('.page-sections > summary'), hasTouch);
  await activate(page.locator('.section-copy'), hasTouch);
  const fallback = page.getByRole('textbox', { name: 'Section link', exact: true });
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute('readonly', '');
  await expect(fallback).toHaveValue(baseURL + '/options.html#option-crowdfunding');
  await expect(fallback).toBeFocused();
  expect(await fallback.evaluate(node => node.selectionStart === 0 && node.selectionEnd === node.value.length)).toBe(true);
});

test('Orientation: failed navigation enhancement leaves native page and section routes available', async ({ page, hasTouch }) => {
  await page.route('**/navigation.js*', route => route.fulfill({ status: 503, contentType: 'application/javascript', headers: { 'x-test-fixture': 'intentional-error' }, body: '' }));
  await page.goto('/options.html');
  await expect(page.locator('.page-name')).toHaveText('Ways to keep Kew open');
  const sections = page.locator('.page-sections');
  await activate(sections.locator(':scope > summary'), hasTouch);
  await activate(sections.locator('a[data-section-id="option-crowdfunding"]'), hasTouch);
  await expect(page).toHaveURL(/#option-crowdfunding$/);
  await expect(page.locator('#option-crowdfunding > details.option-card')).toHaveAttribute('open', '');
  if (await sections.getAttribute('open') !== null) await activate(sections.locator(':scope > summary'), hasTouch);
  const menu = page.locator('.mobile-menu');
  await activate(menu.locator(':scope > summary'), hasTouch);
  await activate(menu.getByRole('link', { name: 'About & contact', exact: true }), hasTouch);
  await expect(page).toHaveURL(/about\.html$/);
  await expect(page.locator('.page-name')).toHaveText('About');
});

test('Orientation: short screens keep the complete menu scrollable and its last route reachable', async ({ page, hasTouch }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto('/options.html#option-crowdfunding');
  await activate(page.locator('.mobile-menu > summary'), hasTouch);
  const panel = page.locator('.mobile-menu nav');
  const last = panel.getByRole('link', { name: 'About & contact', exact: true });
  await last.scrollIntoViewIfNeeded();
  const bounds = await panel.boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(376);
  await expect(last).toBeInViewport({ ratio: 1 });
  await activate(last, hasTouch);
  await expect(page).toHaveURL(/about\.html$/);
  await expect(page.locator('.page-name')).toHaveText('About');
});

test('Orientation: enlarged text retains readable controls and an uncovered section destination', async ({ page, hasTouch }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/options.html#option-crowdfunding');
  // Capture every computed size first so nested labels do not multiply more than twice.
  await page.locator('.site-orientation').evaluate(bar => {
    const elements = [bar, ...bar.querySelectorAll('*')];
    const sizes = elements.map(node => parseFloat(getComputedStyle(node).fontSize) * 2);
    elements.forEach((node, i) => { node.style.fontSize = sizes[i] + 'px'; });
  });
  await expect(page.locator('.page-name')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await activate(page.locator('.page-sections > summary'), hasTouch);
  const link = page.locator('.section-links a[data-section-id="option-demand"]');
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeInViewport({ ratio: 1 });
  await activate(link, hasTouch);
  await expect(page.locator('#option-demand > details')).toHaveAttribute('open', '');
  await expectUncovered(page, page.locator('#option-demand > details > summary'));
  await expect(page.locator('#option-demand')).toBeFocused();
});

// The Menu is chosen, not generated: its groups, labels and order are fixed, adding
// a page never adds a row, and every moved destination stays in every footer.
test('Orientation: the curated Menu keeps its three groups and every footer keeps the moved routes', async ({ page }) => {
  for (const file of pages) {
    await page.goto('/' + file);
    const nav = page.locator('.mobile-menu nav');
    const groups = await nav.locator('.menu-group').evaluateAll(nodes => nodes.map(group => [
      group.querySelector('.menu-group-label').textContent.trim(),
      [...group.querySelectorAll('a')].map(link => [link.textContent.trim(), link.getAttribute('href')]),
    ]));
    const expected = menuGroups.map(([heading, links]) => [heading, file === 'sent.html' && heading === 'This website' ? [...links, ['Next steps', 'sent.html']] : links]);
    expect(groups, file).toEqual(expected);
    expect(await nav.locator(':scope > a').count(), `${file}: no link outside a group`).toBe(0);
    // The official response leads Take part with the Parent action plan's emphasis.
    await expect(nav.locator('a[href="proposal.html#take-part"]')).toHaveClass(/\bnav-respond\b/);
    const footer = await page.locator('footer .footer-inner > div:last-child a').evaluateAll(links => links.map(link => link.getAttribute('href')));
    expect(footer, `${file} footer`).toEqual(footerLinks);
  }
  // The longer footer must wrap on every page, not run off landscape phones.
  await page.setViewportSize({ width: 667, height: 375 });
  for (const file of pages) {
    await page.goto('/' + file);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${file} at 667 × 375`).toBeLessThanOrEqual(0);
    await expect(page.locator('footer .footer-inner > div:last-child a').last()).toBeVisible();
  }
});
