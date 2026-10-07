const { test, expect, expectDestination, expectScrollSettled } = require('./fixtures');
const upload = 'https://docs.google.com/forms/d/e/1FAIpQLScJZ8ZnZWTaPUIoM9l2Vjir7TgNNTHuUyDEF5uLRJolm8iccg/viewform';
const dropbox = 'https://www.dropbox.com/request/9uaa0fawrtdz6pv8b6hn';
const legacy = 'https://docs.google.com/forms/d/e/1FAIpQLSfK3b8XtDJ5_mhKWTqxfZpZwPOJLGXjN1QIQYTKYlJ0dRAHHQ/viewform';
const official = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';

for (const source of ['letters.html', 'feedback.html']) {
  test(`Video: discover private upload from ${source}`, async ({ page, baseURL, hasTouch }) => {
    await page.goto('/' + source);
    const entry = page.locator('main a[href="videos.html#upload"]');
    if (source === 'letters.html') await expect(page.locator('.form-route').filter({ has: page.locator('a[href="videos.html#upload"]') })).toHaveText('Share your parent testimonial to help new families discover the school.');
    await expect(entry).toBeVisible();
    if (hasTouch) await entry.tap(); else await entry.click();
    await expectDestination(page, 'videos.html#upload', baseURL);
    // Site links open at the permission step, as the flyer QR code does.
    await expect(page.locator('#video-upload-link')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#upload-step-two')).toContainText('No account needed');
    await expect(page.locator('.video-three')).toContainText('Adults only. Keep children off camera.');
    await expect(page.locator('#video-title')).toHaveText('Parent testimonials');
  });
}

test('Video: upload is a clear external handoff without embedded trackers or local data fields', async ({ page, hasTouch }) => {
  const requests = [];
  await page.route(upload, async route => {
    requests.push(route.request().method());
    await route.fulfill({contentType:'text/html',body:'<!doctype html><title>Fictional upload destination</title><main>External handoff intercepted. No upload sent.</main>'});
  });
  await page.goto('/videos.html');
  await expect(page.locator('iframe,video,form,input[type="file"]')).toHaveCount(0);
  await expect(page.locator('.video-process')).toContainText('Nothing is published automatically');
  await expect(page.locator('#video-upload-link')).toHaveText(/^Share your parent testimonial/);
  await expect(page.locator('#upload-step-two')).toContainText('Permissions first, then private upload');
  await expect(page.locator('#resume-instructions')).toContainText('same email in both steps');
  await expect(page.locator('.video-process')).toContainText('An unmatched upload stays private');
  await expect(page.locator('#video-upload-link')).toHaveAttribute('aria-describedby', 'upload-requirements upload-step-two recording-rule');
  await expect(page.locator('#upload-help a[href^="https://www.youtube.com"]')).toHaveAttribute('href', 'https://www.youtube.com/@KewParentVoices');
  if (hasTouch) await page.locator('#video-upload-link').tap(); else await page.locator('#video-upload-link').click();
  await expect(page).toHaveURL(upload);
  expect(requests).toEqual(['GET']);
});

test('Video: one native Help disclosure supports touch and keyboard', async ({ page, hasTouch }) => {
  await page.goto('/videos.html');
  await expect(page.locator('main details')).toHaveCount(1);
  const detail = page.locator('#upload-help');
  const summary = detail.locator('summary');
  await expect(detail).not.toHaveAttribute('open','');
  if (hasTouch) await summary.tap(); else { await summary.focus(); await page.keyboard.press('Enter'); }
  await expect(detail).toHaveAttribute('open','');
  for (const id of ['prompt-title','process-title','recording-tips','video-choices']) await expect(page.locator('#'+id)).toBeVisible();
  if (hasTouch) await summary.tap(); else await page.keyboard.press('Enter');
  await expect(detail).not.toHaveAttribute('open','');
});

test('Video: withdrawal leads to private request and non-Google alternative stays available', async ({ page }) => {
  await page.goto('/videos.html');
  await page.locator('#upload-help summary').click();
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('New submissions require YouTube publication permission');
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('filename question is optional');
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('Your face and voice can still identify you');
  await page.locator('section[aria-labelledby="video-choices"] a[href^="feedback.html"]').click();
  await expect(page.locator('input[name="kind"][value="privacy"]')).toBeChecked();
  await expect(page.locator('#publication-options')).toBeHidden();
  await page.goto('/videos.html');
  await page.locator('#upload-help summary').click();
  await page.locator('#upload-help a[href="letters.html#letter-form"]').click();
  await expect(page.locator('#letter-form')).toBeInViewport();
  await page.goto('/videos.html');
  await page.locator('#upload-help summary').click();
  await page.locator('.video-upload a[href="privacy.html#video-privacy"]').click();
  await expect(page.locator('#video-privacy')).toBeInViewport();
  await expect(page.locator('section[aria-labelledby="video-privacy"]')).toContainText('2026-09-22-videos-v1');
  await expect(page.locator('section[aria-labelledby="video-privacy"]')).toContainText('2026-09-22-videos-dropbox-v1');
});

// Main run 35823364131: focusing the help summary started a smooth scroll in desktop
// WebKit, which moved the original-form link beneath the following click.
test('Video: focusing and opening upload help stays still before a link is used', async ({ page }) => {
  await page.goto('/videos.html');
  const summary = page.locator('#upload-help summary');
  await summary.focus();
  // WebKit can return from focus before its native scroll is painted. Observe
  // the focused target, then retain the full check for continuing movement.
  await expect(summary).toBeFocused();
  await expect(summary).toBeInViewport({ ratio: 1 });
  const focusedPosition = await summary.evaluate(element => ({
    top: element.getBoundingClientRect().top,
    bottom: element.getBoundingClientRect().bottom,
    barBottom: document.querySelector('.site-orientation').getBoundingClientRect().bottom,
    viewport: innerHeight,
  }));
  expect(focusedPosition.top).toBeGreaterThanOrEqual(focusedPosition.barBottom);
  expect(focusedPosition.bottom).toBeLessThanOrEqual(focusedPosition.viewport);
  await expectScrollSettled(page, 'Focusing upload help');
  await page.keyboard.press('Enter');
  await expect(page.locator('#upload-help')).toHaveAttribute('open', '');
  await expectScrollSettled(page, 'Opening upload help');
});

for (const [name, selector, destination] of [
  ['resume a permitted Dropbox upload', '#dropbox-upload-link', dropbox],
  ['keep the original Google upload available', '#legacy-google-upload-link', legacy],
]) {
  test(`Video: ${name}`, async ({ page, hasTouch }) => {
    const requests = [];
    await page.route(destination, async route => {
      requests.push(route.request().method());
      await route.fulfill({contentType:'text/html',body:'<!doctype html><title>Fictional external destination</title><p>No data sent.</p>'});
    });
    await page.goto('/videos.html');
    if (selector.includes('legacy')) {
      const summary = page.locator('#upload-help summary');
      if (hasTouch) await summary.tap(); else { await summary.focus(); await page.keyboard.press('Enter'); }
      await expect(page.locator('#upload-help')).toContainText('It requires Google sign-in');
      await expect(page.locator('#upload-help')).toContainText('you do not need to submit it again');
    } else {
      await expect(page.locator('#resume-instructions')).toContainText('Already started?');
    }
    const link = page.locator(selector);
    if (hasTouch) await link.tap(); else await link.click();
    await expect(page).toHaveURL(destination);
    expect(requests).toEqual(['GET']);
  });
}


test('Video: direct arrival explains testimonial purpose and retains upload help and council route', async ({ page, baseURL, hasTouch }) => {
  await page.route(official, route => route.fulfill({ contentType: 'text/html', body: '<h1>Fictional official response destination</h1><p>No response sent.</p>' }));
  await page.goto('/videos.html#upload');
  const card = page.locator('#upload');
  await expect(card).toContainText('YouTube permission required');
  await expect(card).toContainText('News-media and paid-ads permissions optional');
  const councilNote = card.locator('.video-council-note');
  await expect(councilNote).toContainText('not an official council response');
  // Videos are for families choosing a school; views on the proposal are sent to the council instead.
  await expect(councilNote).toContainText('Views on the council consultation?');
  await expect(card.locator('.video-lead')).toHaveText('Help new families discover Kew Riverside Primary School.');
  await expect(page.locator('.video-prompts')).not.toContainText('council');
  await expect(councilNote).toContainText('16 October 2026');
  await expect(councilNote.locator('a').first()).toHaveAttribute('href', official);
  // The official response remains a separate route below the three recording instructions.
  await expect(page.locator('.video-three')).toContainText('DO NOT discuss the council consultation');
  if (hasTouch) await councilNote.locator('a').first().tap(); else await councilNote.locator('a').first().click();
  await expect(page).toHaveURL(official);
  await page.goBack();
  await expect(page).toHaveURL(/videos.html#upload$/);
  await expect(page.locator('#video-upload-link')).toBeVisible();
  await expect(card.locator('#resume-instructions')).toContainText('including any earlier private-only choice, even if you upload later');
  await expect(page.locator('#private-video-alternative')).toHaveCount(0);
  await page.locator('#upload-help summary').click();
  const contact = page.locator('#upload-help a[href="about.html#contact"]').last();
  await expect(contact).toBeVisible();
  if (hasTouch) await contact.tap(); else await contact.click();
  await expectDestination(page, 'about.html#contact', baseURL);
  await page.goBack();
  await expect(page).toHaveURL(/videos.html#upload$/);
  await page.locator('#upload-help summary').click();
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('News-media permission is optional and unchecked');
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('withdraw YouTube, news-media or paid-ads permission separately');
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('Paid-ads permission is optional and unchecked');
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('they are not fundraising appeals');
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('before an ad first runs, and uses it only if you agree');
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('public ad libraries');
  await expect(page.locator('section[aria-labelledby="video-choices"]')).toContainText('normally within two working days');
  await expect(page.locator('section[aria-labelledby="video-choices"] a[href="privacy.html#video-ads-privacy"]')).toHaveText('Read the paid-ads details');
  const earlierAds = page.locator('section[aria-labelledby="video-choices"] a[href="about.html#contact"]');
  await expect(earlierAds).toHaveText('contact Yann privately');
});

test('Video: paid-ads permission is separate, versioned and never inferred from earlier records', async ({ page }) => {
  await page.goto('/videos.html');
  await expect(page.locator('#upload-help')).toContainText('paid ads on YouTube, Facebook and Instagram');
  await expect(page.locator('#upload-help')).toContainText('Paid-ads permission is optional and unchecked');
  await page.locator('#upload-help summary').click();
  await expect(page.locator('#upload-help')).toContainText('optional news-media and paid-ads choices');
  await expect(page.locator('#video-upload-link')).toHaveAttribute('href', upload);
  await expect(page.locator('#dropbox-upload-link')).toHaveAttribute('href', dropbox);
  await expect(page.locator('#legacy-google-upload-link')).toHaveAttribute('href', legacy);
  await page.goto('/privacy.html');
  const notice = page.locator('section[aria-labelledby="video-privacy"]');
  for (const version of ['2026-09-26-videos-v3', '2026-09-26-videos-dropbox-v3', '2026-09-22-videos-v1', '2026-09-22-videos-v2', '2026-09-22-videos-dropbox-v1', '2026-09-22-videos-dropbox-v2']) await expect(notice).toContainText(version);
  await expect(notice).toContainText('an earlier record grants no paid-ads permission');
  await expect(notice).toContainText('The YouTube permission alone does not allow Yann to use the recording on other social platforms, in a council collection, in paid ads or in a mailing list.');
  await expect(notice).not.toContainText('in advertising or in a mailing list');
  await expect(page.locator('#video-ads-privacy')).toContainText('not run for the school or PTA');
  await expect(page.locator('#video-ads-privacy')).toContainText('up to seven years');
  await expect(page.locator('#video-ads-privacy')).toContainText('uses it only if you agree');
  await expect(notice).toContainText('separate unlisted uploads');
  await expect(page.locator('#video-ads-privacy')).toContainText('some platforms show who paid');
  await page.goto('/letters.html');
  await expect(page.locator('main')).toContainText('Not in paid adverts');
});

// Owner request: no scrolling before the complete testimonial action, including
// the small-phone baseline and plain page-top arrival (not just the QR anchor).
for (const [width, height] of [[320,568],[375,667],[390,844],[1440,1000]]) {
  for (const route of ['/videos.html','/videos.html#upload']) {
    test(`Video: ${width}×${height} ${route} shows the complete testimonial action on arrival`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(route);
      await expectScrollSettled(page, 'Testimonial arrival');
      const button = page.locator('#video-upload-link');
      await expect(button).toHaveText(/^Share your parent testimonial/);
      await expect(button).toBeInViewport({ ratio: 1 });
      const position = await button.evaluate(element => ({top:element.getBoundingClientRect().top,bar:document.querySelector('.site-orientation').getBoundingClientRect().bottom}));
      expect(position.top).toBeGreaterThanOrEqual(position.bar);
      await expect(page.locator('.video-three > li')).toHaveCount(3);
      await expect(page.locator('.video-three')).toContainText('Film only yourself');
      await expect(page.locator('.video-three')).toContainText('30 seconds–3 minutes');
      await expect(page.locator('.video-three')).toContainText('DO NOT discuss the council consultation');
      await expect(page.locator('.site-orientation .page-sections')).toHaveCount(0);
      const reminder = page.locator('.video-council-note');
      await expect(reminder).toContainText('16 October 2026');
      await expect(reminder.locator('a').first()).toHaveAttribute('href',official);
    });
  }
}

for (const id of ['prompt-title','process-title','recording-tips','video-choices','upload-help']) {
  test(`Video: old #${id} link opens its Help content and survives Back`, async ({ page }) => {
    await page.goto('/videos.html#'+id);
    await expect(page.locator('#upload-help')).toHaveAttribute('open','');
    await expect(page.locator('#'+id)).toBeInViewport();
    const channel = page.locator('#upload-help a[href="https://www.youtube.com/@KewParentVoices"]');
    await page.route('https://www.youtube.com/@KewParentVoices',route=>route.fulfill({contentType:'text/html',body:'<h1>Fictional channel</h1>'}));
    await channel.click();
    await page.goBack();
    await expect(page.locator('#upload-help')).toHaveAttribute('open','');
    // A repeated same-fragment activation reopens content after it was closed.
    await page.locator('#upload-help summary').click();
    await page.evaluate(id => {
      const link=document.createElement('a'); link.href='#'+id; link.textContent='Repeat saved link'; link.id='test-repeat-link'; document.querySelector('main').append(link);
    },id);
    await page.locator('#test-repeat-link').click();
    await expect(page.locator('#upload-help')).toHaveAttribute('open','');
    await expect(page.locator('#'+id)).toBeInViewport();
  });
}

test('Video: recording instructions and privacy notice allow off-camera household sounds', async ({page})=>{
  await page.goto('/videos.html#recording-tips');
  await expect(page.locator('main')).not.toContainText('heard in the background');
  await expect(page.locator('main')).not.toContainText('Prefer to speak privately');
  await expect(page.locator('section[aria-labelledby="recording-tips"]')).toContainText('no children or other identifiable people in the picture');
  await page.goto('/privacy.html#video-privacy');
  const notice=page.locator('section[aria-labelledby="video-privacy"]');
  await expect(notice).toContainText('no children or other identifiable people in the picture');
  await expect(notice).not.toContainText('picture or background audio');
});
