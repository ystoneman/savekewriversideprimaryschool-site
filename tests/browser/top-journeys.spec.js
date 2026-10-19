const { test, expect, expectScrollSettled } = require('./fixtures');
const official = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';
const petition = 'https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249';
// Fixed London dates either side of the published 16 October 2026 response deadline.
const consultationWeek = '2026-10-13T12:00:00Z';
const afterDeadline = '2026-10-17T12:00:00Z';

// Top parent journeys (J2, J3): the official response stays on the first screen of
// common phones in Safari, with Get involved beside the petition (13 October 2026
// slim-site decision: it replaced the Help shortcut). The homepage hero gained this
// through spacing only; text sizes are unchanged.
for (const [width, height] of [[375, 667], [390, 844]]) {
  test(`Top journeys: ${width}×${height} homepage arrival shows Get involved and the response button`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(consultationWeek));
    await page.setViewportSize({ width, height });
    await page.goto('/index.html');
    const involved = page.locator('.home-plan');
    await expect(involved).toHaveAccessibleName('Get involved');
    await expect(involved).toHaveAttribute('href', 'get-involved.html');
    await expect(involved).toBeInViewport({ ratio: 1 });
    const respond = page.locator('#top .button.primary');
    await expect(respond).toHaveAttribute('href', official);
    await expect(respond).toBeInViewport({ ratio: 1 });
  });
}

// J2 after the published deadline: the petition leads and Get involved stays beside it,
// both fully on the first screen down to the 320 × 568 baseline.
for (const [width, height] of [[320, 568], [375, 667], [390, 844]]) {
  test(`Top journeys: ${width}×${height} homepage arrival after the deadline leads with the petition and Get involved`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(afterDeadline));
    await page.setViewportSize({ width, height });
    await page.goto('/index.html');
    await expect(page.locator('#top .button.primary')).toBeHidden();
    const sign = page.locator('#petition-action');
    await expect(sign).toHaveAttribute('href', petition);
    await expect(sign).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.home-plan')).toBeInViewport({ ratio: 1 });
  });
}

// People reach Get involved from the homepage, the wide-screen header and the Menu
// (13 October 2026 slim-site decision: it replaced the archived Parent action plan,
// which has no live entry). While the consultation is open its first action is the
// official response; afterwards a dated note takes that place.
for (const [width, height] of [[320, 568], [390, 844]]) {
  test(`Top journeys: ${width}×${height} Get involved arrival shows its title and response button`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(consultationWeek));
    await page.setViewportSize({ width, height });
    await page.goto('/get-involved.html');
    await expectScrollSettled(page, 'Get involved arrival');
    await expect(page.getByRole('heading', { level: 1, name: 'Get involved', exact: true })).toBeInViewport({ ratio: 1 });
    const respond = page.locator('#respond a[data-current-response]');
    await expect(respond).toHaveAttribute('href', official);
    await expect(respond).toHaveAccessibleName(/^Respond to the council/);
    await expect(respond).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#respond')).toContainText('responses must be submitted by 16 October 2026');
  });

  // Implementation review (13 October 2026, J2): after the deadline the petition leads
  // Get involved, followed by current actions; the closed note is at the bottom.
  test(`Top journeys: ${width}×${height} Get involved after the deadline leads with the petition, then current actions with the dated note at the bottom`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(afterDeadline));
    await page.setViewportSize({ width, height });
    await page.goto('/get-involved.html');
    await expectScrollSettled(page, 'Get involved arrival after the deadline');
    await expect(page.locator('#respond a[data-current-response]')).toBeHidden();
    await expect(page.locator('#petition h2')).toBeInViewport({ ratio: 1 });
    await expect(page.locator(`#petition a[href="${petition}"]`)).toBeVisible();
    expect(await page.locator('main section[id]').evaluateAll(sections => sections.map(section => section.id).slice(0, 2))).toEqual(['petition', 'representatives']);
    expect(await page.locator('main > section').last().getAttribute('id')).toBe('respond');
    const closed = page.locator('#respond [data-stage="closed"]');
    await expect(closed.getByRole('heading', { level: 2 })).toHaveText('The consultation response deadline has passed');
    await expect(closed.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(closed).toContainText('The published response deadline, 16 October 2026, has passed.');
  });
}

// J1/J3: Dates, leaflet & FAQs (the Menu entry since the 13 October 2026 slim-site
// decision) opens with the form's deadline, then the council's documents and its
// timetable verbatim, with no sideways scrolling on small phones. At 390 × 844 the
// response link and the first council document share the first screen; at 320 × 568
// they follow a short scroll. Shared and legacy links to the documents arrive at them.
for (const [width, height, firstScreen] of [[320, 568, false], [390, 844, true]]) {
  test(`Top journeys: ${width}×${height} council dates and documents arrival shows the deadline and documents first`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(consultationWeek));
    await page.setViewportSize({ width, height });
    await page.goto('/dates.html');
    await expectScrollSettled(page, 'Dates arrival');
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toHaveText('Dates, leaflet & FAQs');
    await expect(title).toBeInViewport({ ratio: 1 });
    const deadline = page.locator('#deadline [data-stage="open"] .council-deadline');
    await expect(deadline).toContainText('All responses must be submitted by 16 October 2026');
    await expect(deadline).toBeInViewport();
    const respond = deadline.locator('a');
    await expect(respond).toHaveAttribute('href', official);
    const documents = page.locator('#council-documents .council-document-list a');
    if (firstScreen) {
      await expect(respond).toBeInViewport({ ratio: 1 });
      await expect(documents.first()).toBeInViewport({ ratio: 1 });
    }
    await page.goto('/dates.html#council-documents');
    await expectScrollSettled(page, 'Council documents arrival');
    await expect(page.locator('#council-documents h2')).toBeInViewport({ ratio: 1 });
    await expect(documents.first()).toBeInViewport({ ratio: 1 });
    expect(await documents.evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual([
      'https://www.richmond.gov.uk/media/fxhbilws/kew_riverside_consultation_leaflet.pdf',
      'https://www.richmond.gov.uk/media/3pderpuw/school_organisation_kew_riverside_faq.pdf',
      'https://www.richmond.gov.uk/media/prepaqcb/school_organisation_consultation_faq.pdf',
      'https://www.richmond.gov.uk/services/children_and_family_care/schools_and_colleges/school_organisation_consultations/kew_riverside_consultation',
    ]);
    const timetable = page.locator('#timetable');
    expect(await timetable.locator('.council-timetable tbody th').allTextContents()).toEqual([
      'Pre-statutory consultation (current)',
      'Review of outcomes from pre-statutory consultation and development of final proposals',
      'Education and Children’s Services Committee - approval to proceed to statutory consultation',
      'Publication of statutory notices',
      'Statutory representation period',
      'Review of outcomes from statutory consultation',
      'Education and Children’s Services Committee - Determination',
      'Implementation',
    ]);
    expect(await timetable.locator('.council-table-wrap, .decision-table-wrap').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    // Dates must stay readable: no month or year split across lines.
    const brokenWords = await timetable.locator('.council-timetable td').evaluateAll(cells => {
      const broken = [];
      for (const cell of cells) {
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          for (const match of node.data.matchAll(/[A-Za-z0-9]+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            if (range.getClientRects().length !== 1) broken.push(match[0]);
          }
        }
      }
      return broken;
    });
    expect(brokenWords).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

// J1 after the published deadline: Dates replaces the response link with a dated note
// and keeps the council's documents next.
test('Top journeys: after the deadline Dates shows a dated note before the council documents', async ({ page }) => {
  await page.clock.setFixedTime(new Date(afterDeadline));
  await page.goto('/dates.html');
  await expect(page.locator('#deadline [data-stage="open"]')).toBeHidden();
  await expect(page.locator(`main a[href="${official}"]:visible`)).toHaveCount(0);
  const closed = page.locator('#deadline [data-stage="closed"]');
  await expect(closed).toBeVisible();
  await expect(closed).toContainText('The published response deadline, 16 October 2026, has passed. No final decision has been made.');
  await expect(page.locator('#council-documents .council-document-list a').first()).toBeVisible();
});

// J7: no family-guidance section (13 October 2026 slim-site decision, which archived the
// Parent action plan and FAQ). The council's own Kew Riverside FAQ, which covers school
// places, is listed on Dates, one Menu choice from the homepage.
test('Top journeys: the council’s Kew Riverside FAQ is one Menu choice from the homepage', async ({ page }) => {
  const faq = 'https://www.richmond.gov.uk/media/3pderpuw/school_organisation_kew_riverside_faq.pdf';
  await page.goto('/index.html');
  await page.locator('.mobile-menu summary').click();
  await expect(page.locator('.mobile-menu a[href="faq.html"], .mobile-menu a[href^="proposal.html"]')).toHaveCount(0);
  await page.locator('.mobile-menu').getByRole('link', { name: 'Dates, leaflet & FAQs', exact: true }).click();
  await expect(page).toHaveURL(/dates\.html$/);
  const link = page.locator(`#council-documents a[href="${faq}"]`);
  await expect(link).toHaveAccessibleName('Kew Riverside FAQ (PDF, 13 pages)');
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
  await page.route(faq, route => route.fulfill({ contentType: 'text/html', body: '<h1>Fictional council FAQ</h1>' }));
  await link.click();
  await expect(page).toHaveURL(faq);
  await expect(page.getByRole('heading')).toHaveText('Fictional council FAQ');
});

// The footer links are direct external handoffs, visible without opening More pages.
// Dates replaces the archived FAQ as the representative inner page (13 October 2026 slim-site decision).
for(const file of ['index.html','dates.html','videos.html'])for(const [name,url] of [['Parent Voices on YouTube','https://www.youtube.com/@KewParentVoices'],['Visit our Open Days','https://docs.google.com/forms/d/e/1FAIpQLSfwTdpsQB5HOlbJxumjINzFjWiZZCshEHUIrkgXlUDCBBPGrw/viewform']])test(`Footer: ${file} ${name} is a direct accessible handoff with Back recovery`,async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('/'+file);const link=page.locator('.footer-discovery').getByRole('link',{name,exact:true});await link.scrollIntoViewIfNeeded();await expect(link).toBeVisible();await expect(link).toHaveAttribute('href',url);
 await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<h1>Fictional external destination</h1>'}));await link.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(url);await page.goBack();await expect(link).toBeVisible();
});
