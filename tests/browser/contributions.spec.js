const { test, expect, captureSubmissions, chooseKind, revealLetterChoices } = require('./fixtures');

async function openPublicationOptions(page, hasTouch) {
  const summary = page.locator('#publication-options > summary');
  if (hasTouch) await summary.tap();
  else await summary.click();
  await expect(page.locator('#publication-options')).toHaveAttribute('open', '');
}

test('Share ideas offers distinct routes for letters, named support and private contact', async ({ page }) => {
  for (const [name, destination, form] of [
    ['Add my name as a supporter', /supporters.html$/, '#supporter-form'],
    ['Write a community letter', /letters.html$/, '#letter-form'],
    ['Send a private message', /about.html#contact$/, '#contact form'],
  ]) {
    await page.goto('/feedback.html');
    await page.getByRole('link', { name: new RegExp(name, 'i') }).click();
    await expect(page).toHaveURL(destination);
    await expect(page.locator(form)).toBeVisible();
  }
});

for (const kind of ['suggestion', 'evidence', 'meeting', 'correction', 'crowdfunding', 'privacy']) {
  test(`Feedback: ${kind} submits only the applicable publication fields`, async ({ page, hasTouch }) => {
    const submissions = await captureSubmissions(page);
    await page.goto('/feedback.html');
    await page.locator('#message').fill('Synthetic browser test feedback; intercepted locally.');
    if (['evidence', 'meeting'].includes(kind)) {
      await page.locator('#source').fill('https://example.invalid/public-source');
      await page.locator('#email').fill('private-reply@example.invalid');
    }
    await openPublicationOptions(page, hasTouch);
    await page.locator('#display-name').fill('Test contributor');
    await page.locator('#allow-public').check();
    await chooseKind(page, kind);
    const privateOnly = ['crowdfunding', 'privacy'].includes(kind);
    if (privateOnly) {
      await expect(page.locator('#allow-public')).not.toBeChecked();
      await expect(page.locator('#allow-public')).toBeDisabled();
      await expect(page.locator('#display-name')).toBeDisabled();
      await expect(page.locator('#publication-choice')).toBeHidden();
    } else {
      await expect(page.locator('#preview-name')).toHaveText('Test contributor');
      await expect(page.locator('#preview-body')).toContainText('Synthetic browser test feedback');
      await expect(page.locator('#public-preview')).not.toContainText('private-reply@example.invalid');
    }
    await page.locator('#feedback-form button[type="submit"]').click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0].get('kind')).toBe(kind);
    expect(submissions[0].has('display_name')).toBe(!privateOnly);
    expect(submissions[0].has('allow_public')).toBe(!privateOnly);
    if (['evidence', 'meeting'].includes(kind)) {
      expect(submissions[0].get('source')).toBe('https://example.invalid/public-source');
      expect(submissions[0].get('email')).toBe('private-reply@example.invalid');
    }
  });
}

test('Private categories do not restore publication consent when switching back', async ({ page, hasTouch }) => {
  await page.goto('/feedback.html');
  await openPublicationOptions(page, hasTouch);
  await page.locator('#allow-public').check();
  await chooseKind(page, 'privacy');
  await chooseKind(page, 'suggestion');
  await expect(page.locator('#allow-public')).toBeEnabled();
  await expect(page.locator('#allow-public')).not.toBeChecked();
});

test('Share ideas starts with publication off and accepts a private suggestion without optional details', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/feedback.html');
  await expect(page.locator('#publication-options')).not.toHaveAttribute('open', '');
  await expect(page.locator('#allow-public')).not.toBeChecked();
  await expect(page.locator('#display-name')).toHaveValue('');
  await page.locator('#message').fill('A synthetic suggestion submitted for private review only.');
  await page.locator('#feedback-form button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('kind')).toBe('suggestion');
  expect(submissions[0].has('allow_public')).toBe(false);
  expect(submissions[0].get('display_name') || '').toBe('');
  expect(submissions[0].get('email') || '').toBe('');
});

for (const [query, expected] of [['evidence', 'evidence'], ['meeting', 'meeting'], ['source', 'evidence'], ['accessibility', 'suggestion'], ['other', 'suggestion']]) {
  test(`Share ideas deep link ${query} selects ${expected} without inventing a message or consent`, async ({ page }) => {
    await page.goto(`/feedback.html?kind=${query}#feedback-form`);
    await expect(page.locator(`input[name="kind"][value="${expected}"]`)).toBeChecked();
    await expect(page.locator('#message')).toHaveValue('');
    await expect(page.locator('#allow-public')).not.toBeChecked();
    await expect(page.locator('#publication-options')).not.toHaveAttribute('open', '');
    if (expected === 'meeting') {
      await expect(page.locator('#meeting-context')).toBeVisible();
      await expect(page.locator('#meeting-context')).toContainText('does not put it on a meeting agenda or send it to the council');
    } else {
      await expect(page.locator('#meeting-context')).toBeHidden();
    }
  });
}

test('Share ideas: optional publication disclosure works with a keyboard', async ({ page }) => {
  await page.goto('/feedback.html');
  const summary = page.locator('#publication-options > summary');
  await expect(summary).toHaveText('Let others read your idea (optional)');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#display-name')).toBeVisible();
  await expect(page.locator('#allow-public')).toBeVisible();
  await expect(page.locator('#allow-public')).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(page.locator('#publication-options')).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
});

test('Funding deep link selects its question and rejects an untouched template', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/feedback.html?kind=crowdfunding&question=recipient#feedback-form');
  await expect(page.locator('input[name="kind"][value="crowdfunding"]')).toBeChecked();
  await expect(page.locator('#message')).toHaveValue(/who could receive and manage contributions/);
  await page.locator('button[type="submit"]').click();
  expect(submissions).toHaveLength(0);
  expect(await page.locator('#message').evaluate(field => field.validity.valid)).toBe(false);
  await page.locator('#message').fill('Synthetic funding idea provided for this local test only.');
  await page.locator('button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
});

test('Feedback rejects whitespace-only text and accepts a corrected message', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/feedback.html');
  await page.locator('#message').fill('            ');
  await page.locator('button[type="submit"]').click();
  expect(submissions).toHaveLength(0);
  await expect(page.locator('#message')).toBeFocused();
  await page.locator('#message').fill('This corrected test message has sufficient meaningful characters.');
  await page.locator('button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
});

test('Letter requires processing consent without requiring public sharing', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/letters.html');
  await page.locator('#message').fill('This synthetic community letter is intercepted locally.');
  await revealLetterChoices(page);
  await page.locator('button[type="submit"]').click();
  expect(submissions).toHaveLength(0);
  await expect(page.locator('#letter-consent')).toBeFocused();
  await page.locator('#letter-consent').check();
  await page.locator('button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('notice_version')).toBe('2026-09-22-letters-v3');
  expect(submissions[0].get('letter_consent')).toBe('yes-process-my-letter-v3');
  for (const field of ['allow_public', 'allow_council', 'council_name', 'council_postcode']) expect(submissions[0].has(field)).toBe(false);
});

for (const [publish, council] of [[true, false], [false, true], [true, true]]) {
  test(`Letter keeps independent permissions: public=${publish}, council=${council}`, async ({ page }) => {
    const submissions = await captureSubmissions(page);
    await page.goto('/letters.html');
    await expect(page.locator('#allow-public')).not.toBeChecked();
    await expect(page.locator('#allow-council')).not.toBeChecked();
    await page.locator('#message').fill('Synthetic letter for permission testing; never transmitted.');
    await revealLetterChoices(page);
    await page.locator('#display-name').fill('Public alias');
    await page.locator('#email').fill('reply@example.invalid');
    await page.locator('#letter-consent').check();
    if (publish) await page.locator('#allow-public').check();
    if (council) {
      await page.locator('#allow-council').check();
      await expect(page.locator('#council-details')).toBeVisible();
      await page.locator('#council-name').fill('Example adult');
      await page.locator('#council-postcode').fill('ZZ1 1ZZ');
    }
    await expect(page.locator('#preview-name')).toHaveText('Public alias');
    await expect(page.locator('.submission-preview')).not.toContainText('Example adult');
    await expect(page.locator('.submission-preview')).not.toContainText('reply@example.invalid');
    if (publish) await expect(page.locator('#sharing-summary')).toContainText('after automated screening or human review');
    await page.locator('button[type="submit"]').click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0].has('allow_public')).toBe(publish);
    expect(submissions[0].has('allow_council')).toBe(council);
    expect(submissions[0].has('council_name')).toBe(council);
    expect(submissions[0].has('council_postcode')).toBe(council);
    expect(submissions[0].get('notice_version')).toBe('2026-09-22-letters-v3');
    expect(submissions[0].get('letter_consent')).toBe('yes-process-my-letter-v3');
    expect(submissions[0].get('allow_public')).toBe(publish ? 'yes-publish-with-display-name-v3' : null);
    expect(submissions[0].get('allow_council')).toBe(council ? 'yes-share-with-richmond-council-v2' : null);
    expect(submissions[0].has('allow_quotes')).toBe(false);
    expect(submissions[0].get('email')).toBe('reply@example.invalid');
  });
}

test('Letter explains automated publication and the private publication email before consent', async ({ page }) => {
  await page.goto('/letters.html');
  await page.locator('#message').fill('Synthetic letter used to reach the choices; never transmitted.');
  await revealLetterChoices(page);
  await expect(page.locator('#allow-public').locator('..')).toContainText('without a person reviewing them first');
  await expect(page.locator('#email')).not.toHaveAttribute('required', '');
  await expect(page.locator('#email-help')).toContainText('one email after confirming it is live');
  await expect(page.locator('#email-help')).toContainText('edits or removal at any time');
  await expect(page.locator('.review-note')).toContainText('held for human review');
  await expect(page.locator('.review-note')).toContainText('same rules to supportive and critical views');
  await expect(page.locator('.letter-form-intro')).toContainText('not immediate or guaranteed');
  await page.locator('#letter-form a[href="privacy.html#letters-privacy"]').click();
  await expect(page).toHaveURL(/privacy.html#letters-privacy$/);
  await expect(page.locator('main')).toContainText('Submissions under earlier notices retain their original permissions and require human review before publication');
  await expect(page.locator('main')).toContainText('Letters are labelled AI screened or Human reviewed');
});

for (const suffix of ['END', '🙂']) {
  test(`Letter preserves the full 30000-character preview and submission ending ${suffix}`, async ({ page }) => {
    const submissions = await captureSubmissions(page);
    const body = 'A fictional family account.\n\n'.repeat(1200).slice(0, 30000 - suffix.length) + suffix;
    expect(body.length).toBe(30000);
    await page.goto('/letters.html');
    await expect(page.locator('#message')).toHaveAttribute('maxlength', '30000');
    // Automated insertion of 30,000 characters takes ~1.5 s even with page scripts off
    // (the page's input handler takes ~1 ms), and exceeded the 5 s default on loaded CI runners.
    await page.locator('#message').fill(body, { timeout: 20_000 });
    await expect(page.locator('#message')).toHaveValue(body);
    await expect(page.locator('#message-count')).toHaveText('30,000 / 30,000 characters');
    await revealLetterChoices(page);
    await page.locator('.submission-preview > summary').click();
    await expect(page.locator('#preview-body')).toBeVisible();
    expect(await page.locator('#preview-body').textContent()).toBe(body);
    await page.locator('#letter-consent').check();
    await page.locator('#allow-public').check();
    await page.locator('#letter-form button[type="submit"]').click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0].get('message').replace(/\r\n/g, '\n')).toBe(body);
    expect(submissions[0].get('allow_public')).toBe('yes-publish-with-display-name-v3');
  });
}

test('Letter rejects 30001 UTF-16 units and allows correction without truncating the text', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  const oversized = 'F'.repeat(29999) + '🙂';
  expect(oversized.length).toBe(30001);
  await page.goto('/letters.html');
  // Programmatic input bypasses native maxlength, exercising the submit guard.
  await page.locator('#message').evaluate((field, value) => {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }, oversized);
  await expect(page.locator('#message-count')).toHaveText('30,001 / 30,000 characters');
  await revealLetterChoices(page);
  await page.locator('#letter-consent').check();
  await page.locator('#letter-form button[type="submit"]').click();
  await expect(page.locator('#message')).toBeFocused();
  await expect(page.locator('#message')).toHaveValue(oversized);
  expect(submissions).toHaveLength(0);
  expect(await page.locator('#message').evaluate(field => field.validity.valid)).toBe(false);
  const corrected = 'F'.repeat(29998) + '🙂';
  await page.locator('#message').fill(corrected);
  await page.locator('#letter-form button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('message')).toBe(corrected);
});

test('Revoking council sharing excludes previously entered private details', async ({ page }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/letters.html');
  await page.locator('#message').fill('Synthetic letter demonstrating withdrawn council permission.');
  await revealLetterChoices(page);
  await page.locator('#letter-consent').check();
  await page.locator('#allow-council').check();
  await page.locator('#council-name').fill('Example adult');
  await page.locator('#council-postcode').fill('ZZ1 1ZZ');
  await page.locator('#allow-council').uncheck();
  await expect(page.locator('#council-details')).toBeHidden();
  await expect(page.locator('#council-name')).toBeDisabled();
  await page.locator('button[type="submit"]').click();
  await expect.poll(() => submissions.length).toBe(1);
  for (const field of ['allow_council', 'council_name', 'council_postcode']) expect(submissions[0].has(field)).toBe(false);
});

test('Supporter requests require all three independent consent statements', async ({ page, hasTouch }) => {
  const submissions = await captureSubmissions(page);
  await page.goto('/supporters.html');
  await page.locator('#public-name').fill('Test supporter');
  await page.locator('#supporter-email').fill('test@example.invalid');
  const choices = page.locator('#supporter-form input[type="checkbox"]');
  const labels = page.locator('#supporter-form .feedback-permission');
  const submit = page.locator('button[type="submit"]');
  expect(await choices.count()).toBe(3);
  for (let index = 0; index < await choices.count(); index++) {
    const choice = choices.nth(index);
    await expect(choice).not.toBeChecked();
    if (hasTouch) await submit.tap();
    else await submit.click();
    // Wait for native validation to identify the missing consent before responding.
    await expect(choice).toBeFocused();
    await expect(choice).toBeInViewport();
    await expect(choice).not.toBeChecked();
    expect(submissions).toHaveLength(0);
    // Desktop WebKit's native validation bubble can consume the next click.
    // Dismiss it with the ordinary keyboard action before selecting the label;
    // retain the focus, unchecked, blocked-submit and checked-state assertions.
    if (!hasTouch) await page.keyboard.press('Escape');
    if (hasTouch) await labels.nth(index).tap();
    else await labels.nth(index).click();
    await expect(choice).toBeChecked();
  }
  if (hasTouch) await submit.tap();
  else await submit.click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].get('kind')).toBe('supporter');
  expect(submissions[0].get('email')).toBe('test@example.invalid');
  for (const name of ['adult_self', 'supporter_consent', 'allow_supporter']) expect(submissions[0].has(name)).toBe(true);
});

for (const [file, kind] of [['about.html', 'contact'], ['corrections.html', 'privacy']]) {
  test(`${file}: private contact route submits with no publication permission`, async ({ page }) => {
    const submissions = await captureSubmissions(page);
    await page.goto('/' + file);
    await page.locator('textarea[name="message"]').fill('Synthetic private message intercepted by the local test runner.');
    for (const checkbox of await page.locator('form input[type="checkbox"][required]').all()) await checkbox.check();
    await page.locator('button[type="submit"]').click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0].get('kind')).toBe(kind);
    expect(submissions[0].has('allow_public')).toBe(false);
  });
}
