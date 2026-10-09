const { test, expect, pages, captureSubmissions, chooseKind, revealLetterChoices } = require('./fixtures');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const SITE = 'https://savekewriversideprimaryschool.org/';
const LETTER = 'A fictional community letter used only in this test.';
// A fixed moment in London time, so dated copy is tested at its real boundaries.
const london = moment => new Date(moment + '+01:00');
const readDraft = page => page.evaluate(() => localStorage.getItem('kr-letter-draft'));
// Only file checks: run them once rather than in every browser project.
const onceOnly = () => test.skip(test.info().project.name !== 'desktop-chromium', 'File check, not browser-specific');
function contrast(a, b) {
  const lum = colour => {
    const [r, g, b] = colour.match(/[\d.]+/g).slice(0, 3).map(v => Number(v) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

async function sendFictionalLetter(page, options = {}) {
  await page.goto('/letters.html');
  await page.locator('#message').fill(options.text || LETTER);
  await revealLetterChoices(page);
  await page.locator('#letter-consent').check();
  if (options.publish) await page.locator('#allow-public').check();
  if (options.quote) await page.locator('#allow-quotes').check();
  if (options.council) await page.locator('#allow-council').check();
  if (options.email) await page.locator('#email').fill(options.email);
  await page.locator('#letter-form button[type="submit"]').click();
}

// ---------- Header tiles ----------

for (const file of pages) {
  test(`${file}: both participation tiles are visible, labelled and easy to tap`, async ({ page }) => {
    await page.goto('/' + file);
    const nav = page.getByRole('navigation', { name: 'Take part' });
    const letters = nav.getByRole('link', { name: /^Community letters/ });
    const ideas = nav.getByRole('link', { name: /^Share ideas/ });
    await expect(letters).toBeVisible();
    await expect(ideas).toBeVisible();
    await expect(letters).toContainText('Read & add yours');
    await expect(ideas).toContainText('Ask or suggest');
    await expect(letters).toHaveAttribute('href', 'letters.html');
    await expect(ideas).toHaveAttribute('href', 'feedback.html');
    for (const tile of [letters, ideas]) {
      const box = await tile.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    // The medallions are decoration; the words carry the meaning.
    await expect(nav.locator('.voice-medallion[aria-hidden="true"]')).toHaveCount(2);
    if (file === 'letters.html') await expect(letters).toHaveAttribute('aria-current', 'page');
    else await expect(letters).not.toHaveAttribute('aria-current', /.*/);
    if (file === 'feedback.html') await expect(ideas).toHaveAttribute('aria-current', 'page');
    else await expect(ideas).not.toHaveAttribute('aria-current', /.*/);
  });
}

test('At 320px the two tiles sit side by side within the page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const file of ['index.html', 'letters.html', 'feedback.html', 'faq.html', 'sent.html']) {
    await page.goto('/' + file);
    const first = await page.locator('.participation-nav .nav-letters').boundingBox();
    const second = await page.locator('.participation-nav .nav-contribute').boundingBox();
    expect(Math.abs(first.y - second.y), `${file}: tiles share a row`).toBeLessThan(2);
    expect(first.x, `${file}: letters tile starts inside the page`).toBeGreaterThanOrEqual(0);
    expect(second.x + second.width, `${file}: ideas tile ends inside the page`).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${file}: no sideways scrolling`).toBeLessThanOrEqual(320);
  }
});

test('The tile cue plays once on arrival from elsewhere, never on internal navigation, the homepage, its own page or reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/faq.html');
  await expect(page.locator('html')).toHaveClass(/\bvoice-cue\b/);
  // It runs once: nothing loops.
  expect(await page.locator('.nav-letters .v-sheet').evaluate(el => getComputedStyle(el).animationIterationCount)).toBe('1');
  expect(await page.locator('.nav-contribute .v-rays').evaluate(el => getComputedStyle(el).animationIterationCount)).toBe('1');
  await page.locator('footer a[href="about.html"]').click();
  await expect(page).toHaveURL(/\/about\.html$/);
  await expect(page.locator('html')).not.toHaveClass(/\bvoice-cue\b/);
  for (const file of ['index.html', 'letters.html', 'feedback.html']) {
    await page.goto('/' + file);
    await expect(page.locator('html'), file).not.toHaveClass(/\bvoice-cue\b/);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/faq.html');
  await expect(page.locator('html')).not.toHaveClass(/\bvoice-cue\b/);
});

test('A shared fragment skips the tile cue and lands on its intended content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/videos.html#upload');
  await expect(page.locator('html')).not.toHaveClass(/\bvoice-cue\b/);
  await expect(page.locator('#upload')).toBeInViewport();
});

// ---------- Letters: write first ----------

test('Letters: writing comes first, and Next explains a too-short letter before revealing the choices', async ({ page }) => {
  await page.goto('/letters.html');
  await expect(page.locator('#message')).toBeVisible();
  await expect(page.locator('#step-choose')).toBeHidden();
  await expect(page.locator('#step-send')).toBeHidden();
  const next = page.locator('#to-choices');
  await expect(next).toBeVisible();
  await page.locator('#message').fill('Too short');
  await next.click();
  await expect(page.locator('#step-error')).toContainText('at least 10 characters');
  await expect(page.locator('#message')).toBeFocused();
  await expect(page.locator('#step-choose')).toBeHidden();
  await page.locator('#message').fill(LETTER);
  await next.click();
  await expect(page.locator('#step-choose')).toBeVisible();
  await expect(page.locator('#step-send')).toBeVisible();
  await expect(page.locator('#step-choose-title')).toBeFocused();
  await expect(next).toBeHidden();
  await expect(page.locator('#step-error')).toBeHidden();
  // The official route stays visible before Send.
  await expect(page.locator('#step-official-open a').first()).toBeVisible();
});

test('Letters: a link to a later field shows every step at once', async ({ page }) => {
  await page.goto('/letters.html#email');
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#letter-consent')).toBeVisible();
  await expect(page.locator('#to-choices')).toBeHidden();
});

test('Letters: a sentence starter begins the letter and leaves the cursor at the end', async ({ page }) => {
  await page.goto('/letters.html');
  await expect(page.locator('#starter-static')).toBeHidden();
  const message = page.locator('#message');
  await page.getByRole('button', { name: 'We chose it because…' }).click();
  await expect(message).toHaveValue('We chose Kew Riverside Primary School because ');
  await expect(message).toBeFocused();
  expect(await message.evaluate(el => el.selectionStart === el.value.length)).toBe(true);
  await page.getByRole('button', { name: 'If it closed, our family would…' }).click();
  await expect(message).toHaveValue('We chose Kew Riverside Primary School because\n\nIf Kew Riverside Primary School closed, our family would ');
});

test('Letters: the character counter appears only near the limit', async ({ page }) => {
  await page.goto('/letters.html');
  await page.locator('#message').fill(LETTER);
  await expect(page.locator('#message-count')).toBeHidden();
  await page.locator('#message').evaluate(el => { el.value = 'x'.repeat(24000); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#message-count')).toBeVisible();
  await expect(page.locator('#message-count')).toHaveText('24,000 / 30,000 characters');
});

// ---------- Letters: drafts on this device ----------

test('Letters: a draft keeps only the letter and public name on this device, and clears on request', async ({ page }) => {
  await page.goto('/letters.html');
  await expect(page.locator('#draft-notice')).toBeVisible();
  await expect(page.locator('#draft-notice')).toContainText('shared device');
  await page.locator('#message').fill(LETTER);
  await expect(page.locator('#draft-status')).toHaveText('✓ Draft saved on this device');
  await revealLetterChoices(page);
  await page.locator('#display-name').fill('Draft alias');
  await page.locator('#email').fill('reply@example.invalid');
  await page.locator('#allow-council').check();
  await page.locator('#council-name').fill('Example adult');
  await expect.poll(async () => JSON.parse(await readDraft(page))?.name).toBe('Draft alias');
  const stored = await readDraft(page);
  expect(Object.keys(JSON.parse(stored)).sort()).toEqual(['name', 'pending', 'saved', 'text', 'v']);
  for (const secret of ['reply@example.invalid', 'Example adult']) expect(stored).not.toContain(secret);

  await page.reload();
  await expect(page.locator('#message')).toHaveValue(LETTER);
  await expect(page.locator('#display-name')).toHaveValue('Draft alias');
  await expect(page.locator('#draft-status')).toHaveText('✓ Draft restored from this device');
  await expect(page.locator('#step-choose')).toBeVisible();

  await page.getByRole('button', { name: 'Clear draft' }).click();
  await expect(page.locator('#message')).toHaveValue('');
  await expect(page.locator('#display-name')).toHaveValue('');
  await expect(page.locator('#message')).toBeFocused();
  expect(await readDraft(page)).toBeNull();
});

test('Letters: a delayed draft save does not move Send under a waiting tap', async ({ page }) => {
  // Isolate the save from the separate 260 ms entrance transform after Next.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 664 });
    await page.goto('/letters.html');
    await page.locator('#message').fill(LETTER);
    await revealLetterChoices(page);
    await page.locator('#letter-consent').check();
    const send = page.locator('#letter-form button[type="submit"]');
    const documentTop = () => send.evaluate(el => el.getBoundingClientRect().top + scrollY);
    const before = await documentTop();
    await page.clock.runFor(650);
    await expect(page.locator('#draft-status')).toHaveText('✓ Draft saved on this device');
    expect(await documentTop(), `${width}px: Send stays still while the draft saves`).toBeCloseTo(before, 0);
  }
});

test('Letters: Clear draft erases private fields, choices and a pending tab copy', async ({ page }) => {
  await page.goto('/letters.html');
  await page.locator('#message').fill(LETTER);
  await revealLetterChoices(page);
  await page.locator('#letter-consent').check();
  await page.locator('#allow-public').check();
  await page.locator('#allow-quotes').check();
  await page.locator('#allow-council').check();
  await page.locator('#email').fill('reply@example.invalid');
  await page.locator('#council-name').fill('Fictional adult');
  await page.evaluate(text => sessionStorage.setItem('kr-sent-letter', JSON.stringify({ text, at: Date.now() })), LETTER);
  await expect(page.locator('#draft-status')).toBeVisible();
  await page.getByRole('button', { name: 'Clear draft' }).click();
  for (const selector of ['#message', '#display-name', '#email', '#council-name']) await expect(page.locator(selector)).toHaveValue('');
  for (const selector of ['#letter-consent', '#allow-public', '#allow-quotes', '#allow-council']) await expect(page.locator(selector)).not.toBeChecked();
  await expect(page.locator('#council-details')).toBeHidden();
  await expect(page.locator('#sharing-summary')).toContainText('All sharing choices are off');
  expect(await readDraft(page)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('kr-sent-letter'))).toBeNull();
  await page.reload();
  await expect(page.locator('#message')).toHaveValue('');
});

test('Letters: a draft older than seven days is not restored and is removed', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('kr-letter-draft', JSON.stringify({ v: 1, text: 'An old fictional draft letter.', name: '', saved: Date.now() - 8 * 86_400_000, pending: false }));
  });
  await page.goto('/letters.html');
  await expect(page.locator('#message')).toHaveValue('');
  await expect(page.locator('#draft-status')).toBeHidden();
  expect(await readDraft(page)).toBeNull();
});

test('Letters: coming back after Send asks whether it arrived, in view, and keeps the words until told', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await sendFictionalLetter(page);
  await expect.poll(() => submissions.length).toBe(1);
  await expect(page).toHaveURL('https://formspree.io/f/xnpnenzy');
  await page.goBack();
  await expect(page).toHaveURL(/\/letters\.html$/);
  // This tab (on this site) remembers only that a letter was sent, for the thank-you page.
  expect(JSON.parse(await page.evaluate(() => sessionStorage.getItem('kr-sent-kind'))).kind).toBe('letter');
  const panel = page.locator('#sent-return');
  await expect(panel).toBeVisible();
  await expect(panel).toBeInViewport();
  await expect(panel).toBeFocused();
  await expect(panel).toContainText('press Send my letter again');
  await expect(page.locator('#return-official-link')).toBeVisible();
  await expect(page.locator('#message')).toHaveValue(LETTER);
  await expect(page.locator('#draft-status')).toBeHidden();
  await page.getByRole('button', { name: 'It arrived: clear this draft' }).click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#message')).toHaveValue('');
  // The note must outlast the draft-saving pause (0.6 s) rather than flash and vanish.
  await page.waitForTimeout(1000);
  await expect(page.locator('#draft-status')).toBeVisible();
  await expect(page.locator('#draft-status')).toHaveText('✓ Draft cleared from this device');
  expect(await readDraft(page)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('kr-sent-letter'))).toBeNull();
  expect(submissions).toHaveLength(1);
});

test('Letters: direct next-steps visit does not confirm receipt or erase the pending draft', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await sendFictionalLetter(page);
  await expect.poll(() => submissions.length).toBe(1);
  // A direct visit is not evidence of a provider receipt.
  await page.goto('/sent.html');
  await expect(page.locator('#sent-title')).toHaveText('After sending your letter');
  await expect(page.locator('#sent-letter-lead')).toContainText('If Formspree confirmed');
  expect(await readDraft(page)).not.toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('kr-letter-cleared'))).toBeNull();
  await page.goto('/letters.html');
  await expect(page.locator('#message')).toHaveValue(LETTER);
  await expect(page.locator('#sent-return')).toBeVisible();
});

test('Letters: explicit removal on next-steps page clears both copies and a restored form', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await sendFictionalLetter(page, { publish: true, council: true, email: 'fictional@example.invalid' });
  await expect.poll(() => submissions.length).toBe(1);
  // Recording the intercepted POST does not mean its document committed yet.
  // Establish the provider history entry before simulating the next-steps visit.
  await page.waitForURL('https://formspree.io/f/xnpnenzy', { waitUntil: 'load' });
  const reference = submissions[0].get('reference');
  await page.goto('/sent.html');
  await page.getByRole('button', { name: 'clear both copies now' }).click();
  expect(await readDraft(page)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('kr-sent-letter'))).toBeNull();
  await page.goBack(); // Provider confirmation or error page.
  await page.goBack(); // Browser-restored letter form.
  await expect(page).toHaveURL(/\/letters\.html$/);
  await expect(page.locator('#message')).toHaveValue('');
  await expect(page.locator('#sent-return')).toBeHidden();
  await expect(page.locator('#allow-public')).not.toBeChecked();
  await expect(page.locator('#allow-council')).not.toBeChecked();
  await expect(page.locator('#email')).toHaveValue('');
  expect(await page.locator('#letter-reference').inputValue()).not.toBe(reference);
  expect(await readDraft(page)).toBeNull();
});

for (const file of ['about.html', 'corrections.html', 'supporters.html']) {
  test(`${file}: a private submission clears an earlier participation marker`, async ({ page }) => {
    const submissions = await captureSubmissions(page);
    await page.goto('/' + file);
    await page.evaluate(text => {
      sessionStorage.setItem('kr-sent-kind', JSON.stringify({ kind: 'letter', at: Date.now() }));
      sessionStorage.setItem('kr-sent-letter', JSON.stringify({ text, at: Date.now() }));
    }, LETTER);
    if (file === 'about.html') {
      await page.locator('#contact-message').fill('A fictional private contact request for testing.');
      await page.locator('input[name="contact_consent"]').check();
    } else if (file === 'corrections.html') {
      await page.locator('#message').fill('A fictional private correction request for testing.');
    } else {
      await page.locator('#public-name').fill('Fictional Adult');
      await page.locator('#supporter-email').fill('fictional@example.invalid');
      await page.locator('input[name="adult_self"]').check();
      await page.locator('input[name="supporter_consent"]').check();
      await page.locator('#allow-supporter').check();
    }
    await page.locator('form[action="https://formspree.io/f/xnpnenzy"] button[type="submit"]').click();
    await expect.poll(() => submissions.length).toBe(1);
    await page.goto('/sent.html');
    await expect(page.locator('#sent-title')).toHaveText('Thank you.');
    await expect(page.locator('#official-card')).toBeHidden();
    await expect(page.locator('#copy-step')).toBeHidden();
    expect(await page.evaluate(() => sessionStorage.getItem('kr-sent-kind'))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem('kr-sent-letter'))).toBeNull();
  });
}

for (const [moment, open] of [['2026-10-16T23:30:00', true], ['2026-10-17T00:30:00', false]]) {
  test(`Letters at ${moment} London time: the official-form asks are ${open ? 'shown' : 'retired'}`, async ({ page }) => {
    await page.clock.setFixedTime(london(moment));
    await page.addInitScript(text => {
      localStorage.setItem('kr-letter-draft', JSON.stringify({ v: 1, text, name: '', saved: Date.now(), pending: true }));
    }, LETTER);
    await page.goto('/letters.html');
    await expect(page.locator('#sent-return')).toBeVisible();
    await expect(page.locator('#return-clear')).toBeVisible();
    for (const selector of ['#official-line', '#step-official-open', '#return-official', '#return-official-link', '#return-copy']) {
      if (open) await expect(page.locator(selector), selector).toBeVisible();
      else await expect(page.locator(selector), selector).toBeHidden();
    }
    await expect(page.locator('#official-line-past')).toBeVisible({ visible: !open });
    await expect(page.locator('#step-official-fallback')).toBeVisible({ visible: !open });
    await expect(page.locator('.official-notice')).toContainText('check the current stage');
  });
}

for (const [moment, shown] of [['2026-10-12T21:00:00', true], ['2026-10-13T00:30:00', false]]) {
  test(`Letters at ${moment} London time: the calendar reminder is ${shown ? 'offered' : 'retired'}`, async ({ page }) => {
    await page.clock.setFixedTime(london(moment));
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/letters.html#email');
    const reminder = page.locator('#step-reminder');
    await expect(reminder).toBeVisible({ visible: shown });
    if (!shown) return;
    await expect(reminder.getByRole('link', { name: 'Add a calendar reminder' })).toHaveAttribute('href', 'respond-reminder.ics');
    // It reads as its own line, not part of the paragraph below.
    const own = await reminder.boundingBox();
    const next = await page.locator('#send-expectations').boundingBox();
    expect(next.y - (own.y + own.height)).toBeGreaterThanOrEqual(12);
  });
}

// ---------- Letters: optional quotes, only with publication ----------

test('Letters: quoting is offered only with publication, starts unticked and is dropped with it', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/letters.html');
  await page.locator('#message').fill(LETTER);
  await revealLetterChoices(page);
  const choice = page.locator('#quote-choice');
  const quote = page.locator('#allow-quotes');
  await expect(page.locator('#sharing-summary')).toHaveText('All sharing choices are off. Your letter will stay in the private review queue.');
  await expect(choice).toBeHidden();
  await page.locator('#allow-public').check();
  await expect(choice).toBeVisible();
  await expect(quote).not.toBeChecked();
  await expect(quote).toBeEnabled();
  await expect(choice).toContainText('from my published letter');
  await expect(choice).toContainText('Not in paid adverts, fundraising appeals, submissions to the council');
  await expect(choice).toContainText('This lasts until 30 September 2028');
  await expect(choice.locator('a[href="privacy.html#letter-quotes"]')).toBeVisible();
  await quote.check();
  await expect(page.locator('#sharing-summary')).toContainText('quoted in Yann’s own campaign materials beyond this website until 30 September 2028');
  await page.locator('#allow-public').uncheck();
  await expect(choice).toBeHidden();
  await expect(quote).not.toBeChecked();
  await expect(quote).toBeDisabled();
  await expect(page.locator('#sharing-summary')).toHaveText('All sharing choices are off. Your letter will stay in the private review queue.');
  // Ticking publication again never brings quoting back by itself.
  await page.locator('#allow-public').check();
  await expect(quote).not.toBeChecked();
  await page.locator('#allow-public').uncheck();
  await page.locator('#letter-consent').check();
  await page.locator('#letter-form button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  for (const field of ['allow_public', 'allow_quotes']) expect(submissions[0].has(field)).toBe(false);
});

for (const quote of [true, false]) {
  test(`Letters: publication ${quote ? 'with' : 'without'} quoting submits exactly the chosen values`, async ({ page }) => {
    const submissions = await captureSubmissions(page);
    await sendFictionalLetter(page, { publish: true, quote });
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0].get('notice_version')).toBe('2026-09-22-letters-v3');
    expect(submissions[0].get('letter_consent')).toBe('yes-process-my-letter-v3');
    expect(submissions[0].get('allow_public')).toBe('yes-publish-with-display-name-v3');
    expect(submissions[0].get('allow_quotes')).toBe(quote ? 'yes-quote-published-letter-v1' : null);
    expect(submissions[0].has('allow_council')).toBe(false);
  });
}

test('Privacy: the quote section states scope, exclusions, end date, records and withdrawal', async ({ page }) => {
  await page.goto('/privacy.html#letter-quotes');
  const heading = page.locator('#letter-quotes');
  await expect(heading).toHaveText('Quotes from letters (optional)');
  await expect(heading).toBeInViewport();
  const text = await page.locator('main').innerText();
  for (const phrase of ['yes-quote-published-letter-v1', 'It is offered only with publication', 'paid adverts, fundraising appeals', 'news organisations', 'Any of these uses would need your new permission', 'until 30 September 2028', 'withdraw quote permission on its own', 'also ends quote permission']) {
    expect(text, phrase).toContain(phrase);
  }
  await expect(page.locator('#device-storage')).toHaveText('Letter drafts in your browser');
});

test('Dark appearance: a chosen card looks stronger than an unchosen one', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/letters.html#email');
  await page.locator('#allow-public').check();
  const letters = await page.evaluate(() => {
    const card = id => document.getElementById(id).closest('.choice-card');
    return {
      ticked: getComputedStyle(card('allow-public')).borderTopColor,
      unticked: getComputedStyle(card('allow-council')).borderTopColor,
      quoteRule: getComputedStyle(document.getElementById('quote-choice')).borderLeftColor,
      page: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(contrast(letters.ticked, letters.page)).toBeGreaterThanOrEqual(3);
  expect(contrast(letters.ticked, letters.page)).toBeGreaterThan(contrast(letters.unticked, letters.page));
  await page.locator('#allow-quotes').check();
  const quoteTicked = await page.locator('#quote-choice').evaluate(el => getComputedStyle(el).borderLeftColor);
  expect(contrast(quoteTicked, letters.page)).toBeGreaterThan(contrast(letters.quoteRule, letters.page));
  await page.goto('/feedback.html');
  const ideas = await page.evaluate(() => {
    const selected = document.querySelector('input[name="kind"]:checked').closest('.kind-card');
    const other = document.querySelector('input[name="kind"]:not(:checked)').closest('.kind-card');
    return {
      selected: getComputedStyle(selected).borderTopColor,
      other: getComputedStyle(other).borderTopColor,
      icon: getComputedStyle(selected.querySelector('.kind-icon svg')).stroke,
      circle: getComputedStyle(selected.querySelector('.kind-icon')).backgroundColor,
      page: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(contrast(ideas.selected, ideas.page)).toBeGreaterThanOrEqual(3);
  expect(contrast(ideas.selected, ideas.page)).toBeGreaterThan(contrast(ideas.other, ideas.page));
  expect(contrast(ideas.icon, ideas.circle)).toBeGreaterThanOrEqual(3);
});

// ---------- Share ideas ----------

for (const [moment, open] of [['2026-10-16T23:30:00', true], ['2026-10-17T00:30:00', false]]) {
  test(`Share ideas at ${moment} London time: the official response link is ${open ? 'offered' : 'retired'}`, async ({ page }) => {
    await page.clock.setFixedTime(london(moment));
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/feedback.html');
    const openRoute = page.locator('#ideas-official-open');
    await expect(openRoute).toBeVisible({ visible: open });
    await expect(page.locator('#ideas-official-closed')).toBeVisible({ visible: !open });
    // Letters and videos stay one tap away either way, and each link appears once.
    const route = page.locator('.ideas-letter-route');
    await expect(route).toContainText(open ? 'You can also write a community letter' : 'Personal view? You can write a community letter', { useInnerText: true });
    await expect(route.getByRole('link', { name: 'write a community letter' })).toBeVisible();
    await expect(route.getByRole('link', { name: 'share your parent testimonial' })).toBeVisible();
    await expect(page.locator('main a[href="videos.html#upload"]')).toHaveCount(1);
    if (!open) return;
    const official = openRoute.getByRole('link', { name: 'official response form' });
    await expect(official).toHaveAttribute('href', /^https:\/\/docs\.google\.com\/forms\//);
    // A personal view meets the official route before the private categories.
    const link = await official.boundingBox();
    const firstCard = await page.locator('#kind-cards .kind-card').first().boundingBox();
    expect(link.y).toBeLessThan(firstCard.y);
  });
}

test('Share ideas: visible choices start on a suggestion, with the meeting card dated before the meeting', async ({ page }) => {
  await page.clock.setFixedTime(london('2026-09-29T15:29:00'));
  await page.goto('/feedback.html');
  await expect(page.locator('input[name="kind"][value="suggestion"]')).toBeChecked();
  const cards = page.locator('#kind-cards > .kind-grid > .kind-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.first()).toContainText('A question for the meeting');
  await expect(page.locator('#meeting-date')).toBeVisible();
  await expect(page.locator('#kind-more')).not.toHaveAttribute('open', /.*/);
  await chooseKind(page, 'privacy');
  await expect(page.locator('#kind-more')).toHaveAttribute('open', '');
  await expect(page.locator('input[name="kind"][value="privacy"]')).toBeChecked();
});

test('Share ideas: after the meeting the card becomes a general question and moves last', async ({ page }) => {
  await page.clock.setFixedTime(london('2026-09-29T15:30:00'));
  await page.goto('/feedback.html');
  await expect(page.locator('#meeting-date')).toBeHidden();
  const cards = page.locator('#kind-cards > .kind-grid > .kind-card');
  await expect(cards.last()).toContainText('A question about the proposal');
  await expect(cards.first()).toContainText('An idea or suggestion');
  await chooseKind(page, 'meeting');
  await expect(page.locator('#meeting-context')).toContainText('does not put it on a meeting agenda');
});

test('Share ideas: sending records only the kind of message, and the thank-you page answers in kind', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/feedback.html');
  await page.locator('#message').fill('A fictional suggestion for the thank-you page check.');
  await page.locator('#feedback-form button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  // Stand-in for the form service's redirect to the thank-you page, in the same tab.
  await page.goto('/sent.html');
  const record = JSON.parse(await page.evaluate(() => sessionStorage.getItem('kr-sent-kind')));
  expect(Object.keys(record).sort()).toEqual(['at', 'kind']);
  expect(record.kind).toBe('suggestion');
  await expect(page.locator('#sent-title')).toHaveText('After sending your idea');
  await expect(page.locator('#share-card')).toBeHidden();
});

// ---------- Thank-you page ----------

async function arriveAfter(page, kind, { minutesAgo = 0, text } = {}) {
  await page.addInitScript(({ kind, minutesAgo, text }) => {
    sessionStorage.setItem('kr-sent-kind', JSON.stringify({ kind, at: Date.now() - minutesAgo * 60_000 }));
    if (text) sessionStorage.setItem('kr-sent-letter', JSON.stringify({ text, at: Date.now() }));
  }, { kind, minutesAgo, text });
}

test('Thank-you page: with no recent record it stays neutral, with no asks, and is not indexed', async ({ page }) => {
  await page.goto('/sent.html');
  await expect(page.locator('#sent-title')).toHaveText('Thank you.');
  await expect(page.locator('#sent-lead')).toBeVisible();
  for (const id of ['#sent-letter-lead', '#official-card', '#official-note', '#official-closed', '#share-card', '#sent-more', '#forget-wrap']) {
    await expect(page.locator(id), id).toBeHidden();
  }
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByRole('link', { name: 'Back to the homepage' })).toBeVisible();
});

test('Thank-you page: a record older than 30 minutes is treated as neutral', async ({ page }) => {
  await arriveAfter(page, 'letter', { minutesAgo: 31, text: LETTER });
  await page.goto('/sent.html');
  await expect(page.locator('#sent-title')).toHaveText('Thank you.');
  await expect(page.locator('#official-card')).toBeHidden();
  await expect(page.locator('#share-card')).toBeHidden();
});

test('Thank-you page after an idea: one official line, no letter or sharing asks', async ({ page }) => {
  await page.clock.setFixedTime(london('2026-09-24T12:00:00'));
  await arriveAfter(page, 'suggestion');
  await page.goto('/sent.html');
  await expect(page.locator('#sent-title')).toHaveText('After sending your idea');
  await expect(page.locator('#official-note')).toBeVisible();
  await expect(page.locator('#official-card')).toBeHidden();
  await expect(page.locator('#share-card')).toBeHidden();
  await expect(page.locator('#sent-more')).toBeVisible();
});

test('Thank-you page after a letter: make it official first, copy the words, then share', async ({ page }) => {
  await page.clock.setFixedTime(london('2026-09-24T12:00:00'));
  await page.addInitScript(text => {
    localStorage.setItem('kr-letter-draft', JSON.stringify({ v: 1, text, name: '', saved: Date.now(), pending: true }));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: value => { window.copiedForTest = value; return Promise.resolve(); } } });
  }, LETTER);
  await arriveAfter(page, 'letter', { text: LETTER });
  await page.goto('/sent.html');
  await expect(page.locator('#sent-title')).toHaveText('After sending your letter');
  await expect(page.locator('#sent-letter-lead')).toBeVisible();
  await expect(page.locator('#official-card')).toBeVisible();
  await expect(page.locator('#copy-step')).toBeVisible();
  await expect(page.locator('#open-step-number')).toHaveText('2');
  await expect(page.locator('#reminder-line a[href="respond-reminder.ics"]')).toBeVisible();
  await expect(page.locator('#share-card')).toBeVisible();
  const official = await page.locator('#official-card').boundingBox();
  const share = await page.locator('#share-card').boundingBox();
  expect(official.y).toBeLessThan(share.y);
  // A Send click is not a provider receipt; keep the draft until explicit removal.
  expect(await readDraft(page)).not.toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('kr-letter-cleared'))).toBeNull();
  await page.getByRole('button', { name: 'Copy my letter' }).click();
  await expect(page.locator('#copy-status')).toContainText('use relevant parts of your letter');
  expect(await page.evaluate(() => window.copiedForTest)).toBe(LETTER);
  // Sharing never carries the letter's words.
  const canShare = await page.evaluate(() => typeof navigator.share === 'function');
  await expect(page.locator('#share-page')).toBeVisible({ visible: canShare });
  await expect(page.locator('#share-whatsapp')).toBeVisible({ visible: !canShare });
  expect(await page.locator('#share-whatsapp').getAttribute('href')).not.toContain('fictional');
  expect(decodeURIComponent(await page.locator('#share-whatsapp').getAttribute('href'))).toContain(SITE);
  await page.getByRole('button', { name: 'clear both copies now' }).click();
  await expect(page.locator('#copy-step')).toBeHidden();
  await expect(page.locator('#open-step-number')).toHaveText('1');
  expect(await page.evaluate(() => sessionStorage.getItem('kr-sent-letter'))).toBeNull();
  expect(await readDraft(page)).toBeNull();
});

test('Thank-you page: if copying is blocked, the letter is shown selected to copy by hand', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Blocked in this test')) } });
  });
  await arriveAfter(page, 'letter', { text: LETTER });
  await page.goto('/sent.html');
  await page.getByRole('button', { name: 'Copy my letter' }).click();
  const area = page.locator('#copy-fallback');
  await expect(area).toBeVisible();
  await expect(area).toHaveValue(LETTER);
  await expect(page.locator('#copy-status')).toHaveText('Select all of the text above and copy it.');
  expect(await area.evaluate(el => el.selectionEnd - el.selectionStart)).toBe(LETTER.length);
});

for (const [day, reminder, open] of [['2026-10-12', true, true], ['2026-10-13', false, true], ['2026-10-16', false, true], ['2026-10-17', false, false]]) {
  test(`Thank-you page on ${day}: reminder ${reminder ? 'shown' : 'hidden'}, official card ${open ? 'shown' : 'replaced'}`, async ({ page }) => {
    await page.clock.setFixedTime(london(day + 'T12:00:00'));
    await arriveAfter(page, 'letter', { text: LETTER });
    await page.goto('/sent.html');
    await expect(page.locator('#official-card')).toBeVisible({ visible: open });
    await expect(page.locator('#reminder-line')).toBeVisible({ visible: reminder });
    await expect(page.locator('#official-closed')).toBeVisible({ visible: !open });
    if (!open) {
      await expect(page.locator('#share-card')).toBeVisible();
      await expect(page.locator('#share-card')).not.toContainText('respond to the consultation');
      expect(await page.locator('#share-whatsapp').getAttribute('href')).not.toContain('consultation');
    }
  });
}

// ---------- Files: calendar reminder and link previews ----------

test('The response reminder is a standard calendar event on the evening of 13 October, London time', async ({ page }) => {
  onceOnly();
  const response = await page.request.get('/respond-reminder.ics');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('text/calendar');
  const raw = await response.text();
  // RFC 5545: CRLF line breaks and lines of at most 75 octets.
  expect(raw.endsWith('\r\n')).toBe(true);
  expect(raw.replaceAll('\r\n', '')).not.toContain('\n');
  for (const line of raw.split('\r\n')) expect(Buffer.byteLength(line), line).toBeLessThanOrEqual(75);
  const text = raw.replaceAll('\r\n ', '');
  expect(text).toMatch(/^BEGIN:VCALENDAR\r\n/);
  expect(text).toContain('\r\nDTSTART;TZID=Europe/London:20261013T193000\r\n');
  expect(text).toContain('\r\nDTEND;TZID=Europe/London:20261013T194500\r\n');
  expect(text).toContain('\r\nBEGIN:VALARM\r\n');
  expect(text).not.toMatch(/ORGANIZER|ATTENDEE|mailto:/);
});

for (const [file, image] of [['index.html', 'og-home.png'], ['letters.html', 'og-letters.png'], ['feedback.html', 'og-ideas.png'], ['videos.html', 'og-videos.png']]) {
  test(`${file}: link previews use a 1200×630 image from this site and absolute page links`, async ({ page }) => {
    onceOnly();
    await page.goto('/' + file);
    const meta = key => page.locator(`meta[property="${key}"], meta[name="${key}"]`).getAttribute('content');
    expect(await meta('og:image')).toBe(SITE + image + '?v=2026100901');
    expect(await meta('og:image:width')).toBe('1200');
    expect(await meta('og:image:height')).toBe('630');
    expect(await meta('og:image:alt')).toBeTruthy();
    expect(await meta('og:url')).toBe(SITE + (file === 'index.html' ? '' : file));
    expect(await meta('twitter:card')).toBe('summary_large_image');
    const png = readFileSync(path.join(root, image));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    expect(png.length).toBeLessThan(300_000);
    expect((await page.request.get('/' + image)).ok()).toBe(true);
  });
}
