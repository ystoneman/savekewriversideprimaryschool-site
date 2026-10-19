const { test, expect, expectScrollSettled } = require('./fixtures');

// The slim campaign site (owner decision, 13 October 2026). These expectations are
// written out by hand, not read from the pages, so a navigation or archive change
// has to be made deliberately here as well.

const officialForm = 'https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';
const petition = 'https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249';
// 14 October 2026, 13:00 in London: inside the published response window.
const beforeDeadline = new Date('2026-10-14T12:00:00Z');

const campaignLinks = [
  ['index.html', 'Home'],
  ['dates.html', 'Dates, leaflet & FAQs'],
  ['get-involved.html', 'Get involved'],
  ['updates.html', 'Campaign updates'],
  ['about.html', 'About & contact'],
];
const menuNames = [...campaignLinks.map(([, name]) => name), 'Watch Parent Voices', 'Book an Open Day'];
const menuPages = campaignLinks.map(([file]) => file);
const supportingPages = ['questions.html', 'understand.html', 'evidence.html', 'options.html', 'lessons.html', 'lessons-sources.html'];
const livePages = [...menuPages, ...supportingPages, 'letters.html', 'videos.html', 'feedback.html', 'privacy.html', 'corrections.html', 'sent.html'];
const archivedPages = ['proposal.html', 'faq.html', 'rally.html', 'supporters.html', 'fundraising-trustees.html', 'fundraising-admin.html'];
const phoneSizes = [{ width: 320, height: 568 }, { width: 390, height: 844 }];

function menu(page) {
  return page.locator('details.mobile-menu');
}

async function openMenu(page) {
  const details = menu(page);
  if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
  await expect(details.locator('nav a').first()).toBeVisible();
}

// Compare with clientWidth, not innerWidth: mobile browsers widen the layout viewport
// to fit overflowing content, so innerWidth grows with the overflow and hides it.
async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return {
      scrollWidth: document.documentElement.scrollWidth, width,
      wider: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > width + 1)
        .map(element => `${element.tagName.toLowerCase()} "${element.textContent.trim().slice(0, 50)}"`).slice(0, 5),
    };
  });
  expect(overflow.scrollWidth, `${label} has no horizontal overflow (wider: ${overflow.wider.join(', ')})`).toBeLessThanOrEqual(overflow.width + 1);
}

// The element itself, not a sticky bar or banner above it, is under its centre.
async function expectUncovered(locator, label) {
  const uncovered = await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + Math.min(box.width / 2, 20), box.top + box.height / 2);
    return Boolean(hit && (element === hit || element.contains(hit)));
  });
  expect(uncovered, `${label} is not covered`).toBe(true);
}

test.describe('Menu on the live pages', () => {
  for (const file of ['index.html', 'dates.html', 'get-involved.html', 'updates.html', 'about.html', 'letters.html', 'videos.html', 'feedback.html', 'privacy.html', 'corrections.html']) {
    test(`${file} has the slim Menu, no header tiles and no section chooser`, async ({ page }) => {
      await page.goto('/' + file);
      await openMenu(page);
      const links = menu(page).locator('nav a');
      await expect(links).toHaveText(menuNames);
      // Only the page you are on is marked current, and only when it is a Campaign page.
      const current = menu(page).locator('nav a[aria-current="page"]');
      if (menuPages.includes(file)) {
        await expect(current).toHaveCount(1);
        await expect(current).toHaveAttribute('href', file);
      } else {
        await expect(current).toHaveCount(0);
      }
      // Header participation tiles and live-page "On this page" choosers were removed
      // by the 13 October 2026 slim-site decision.
      await expect(page.locator('.participation-nav')).toHaveCount(0);
      await expect(page.locator('.page-sections')).toHaveCount(0);
      if (file !== 'index.html') {
        await expect(page.locator('nav.desktop-explore a')).toHaveCount(1);
        await expect(page.locator('nav.desktop-explore a')).toHaveText('Get involved');
        await expect(page.locator('nav.desktop-explore a')).toHaveAttribute('href', 'get-involved.html');
      }
    });
  }

  test('Each Campaign Menu link reaches its page, which marks itself current', async ({ page, baseURL }) => {
    for (const [file, name] of campaignLinks) {
      await page.goto('/updates.html');
      await openMenu(page);
      await menu(page).getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new URL(file, baseURL + '/').href);
      await expect(page.locator('main h1')).toBeVisible();
      const current = menu(page).locator('nav a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute('href', file);
      await expect(current).toHaveText(name);
    }
  });
});

test.describe('Dates, leaflet & FAQs', () => {
  for (const size of phoneSizes) {
    test(`arrives readable at ${size.width}x${size.height} with the council's documents and timetable`, async ({ page }) => {
      await page.clock.setFixedTime(beforeDeadline);
      await page.setViewportSize(size);
      await page.goto('/dates.html');
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveText('Dates, leaflet & FAQs');
      await expect(heading).toBeInViewport();
      await expect(page.locator('#deadline')).toContainText('All responses must be submitted by 16 October 2026');
      for (const pdf of ['kew_riverside_consultation_leaflet.pdf', 'school_organisation_kew_riverside_faq.pdf', 'school_organisation_consultation_faq.pdf']) {
        const link = page.locator(`#council-documents a[href$="/${pdf}"]`);
        await expect(link, `${pdf} is linked`).toHaveCount(1);
        await expect(link).toBeVisible();
        expect(new URL(await link.getAttribute('href')).origin).toBe('https://www.richmond.gov.uk');
      }
      await expect(page.locator('#timetable table tbody tr')).toHaveCount(8);
      await expect(page.locator('#timetable table tbody tr').last()).toContainText('1 September 2027');
      await expectNoHorizontalOverflow(page, `dates.html at ${size.width}px`);
    });

    for (const [fragment, title] of [['council-documents', 'documents-title'], ['timetable', 'timetable-title']]) {
      test(`#${fragment} lands on its section at ${size.width}x${size.height}`, async ({ page }) => {
        await page.clock.setFixedTime(beforeDeadline);
        await page.setViewportSize(size);
        await page.goto(`/dates.html#${fragment}`);
        await expectScrollSettled(page, `dates.html#${fragment}`);
        await expect(page.locator(`#${fragment}`)).toBeInViewport();
        await expect(page.locator(`#${title}`)).toBeInViewport({ ratio: 1 });
        await expectUncovered(page.locator(`#${title}`), `#${title}`);
      });
    }
  }
});

test.describe('Get involved', () => {
  const destinations = [
    [officialForm, 'the official response form'],
    [petition, 'the council petition'],
    ['letters.html#letter-form', 'the community letter form'],
    ['letters.html', 'the community letters'],
    ['videos.html#upload', 'video sharing'],
    ['feedback.html', 'Share ideas'],
    ['https://cabnet.richmond.gov.uk/mgMemberIndex.aspx?bcr=1', 'Richmond councillors'],
    ['https://members.parliament.uk/FindYourMP', 'Find your MP'],
    ['mailto:schoolorganisation@achievingforchildren.org.uk', 'the council response email'],
  ];

  test('offers every current route before the response deadline', async ({ page }) => {
    await page.clock.setFixedTime(beforeDeadline);
    await page.goto('/get-involved.html');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get involved');
    for (const [href, label] of destinations) {
      const link = page.locator(`main a[href="${href}"]`);
      expect(await link.count(), `${label} (${href}) is linked`).toBeGreaterThan(0);
      await expect(link.first(), `${label} is visible`).toBeVisible();
    }
    await expect(page.locator('#petition a[href="' + petition + '"]')).toBeVisible();
    await expect(page.locator('#respond a[href="' + officialForm + '"]')).toHaveText(/Respond to the council/);
  });

  test('shows the heading and the Respond button on arrival at 320x568', async ({ page }) => {
    await page.clock.setFixedTime(beforeDeadline);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/get-involved.html');
    await expectScrollSettled(page, 'get-involved.html arrival');
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport({ ratio: 1 });
    const respond = page.locator('#respond a.primary');
    await expect(respond).toHaveAttribute('href', officialForm);
    await expect(respond).toHaveText(/Respond to the council/);
    await expect(respond).toBeInViewport({ ratio: 1 });
    await expectUncovered(respond, 'Respond button');
    await expectNoHorizontalOverflow(page, 'get-involved.html at 320px');
  });
});

test.describe('Response deadline (London dates)', () => {
  const formLinks = page => page.locator(`a[href="${officialForm}"]`).filter({ visible: true });

  test('the respond blocks lead until 23:59:59 on 16 October 2026', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T22:59:59Z'));
    for (const file of ['dates.html', 'get-involved.html']) {
      await page.goto('/' + file);
      await expect(page.locator('main [data-stage="open"]'), `${file} respond block`).toBeVisible();
      await expect(page.locator('main [data-stage="closed"]'), `${file} closed block`).toBeHidden();
      expect(await formLinks(page).count(), `${file} links the official form`).toBeGreaterThan(0);
    }
    await page.goto('/index.html');
    await expect(page.locator('#main-action')).toBeVisible();
    await expect(page.locator('#main-action')).toHaveAttribute('href', officialForm);
    await expect(page.locator('#petition-note')).toContainText('Signing does not replace your consultation response.');
  });

  test('from 17 October 2026 the closed notes replace every response invitation', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T23:00:00Z'));
    for (const file of ['dates.html', 'get-involved.html']) {
      await page.goto('/' + file);
      await expect(page.locator('main [data-stage="open"]'), `${file} respond block`).toBeHidden();
      const closed = page.locator('main [data-stage="closed"]');
      await expect(closed, `${file} closed block`).toBeVisible();
      await expect(closed).toContainText('has passed');
      await expect(formLinks(page), `${file} keeps no visible link to the official form`).toHaveCount(0);
    }
    await page.goto('/index.html');
    await expect(page.locator('#main-action')).toBeHidden();
    await expect(page.locator('#action-note')).toBeHidden();
    await expect(page.locator('.hero .intro')).toHaveText('Richmond Council proposes closing the school from 1 September 2027. If it proceeds in November 2026, it plans a final decision in April 2027.');
    const firstAction = await page.locator('.actions .action').evaluateAll(actions => actions.find(action => action.getClientRects().length && getComputedStyle(action).visibility !== 'hidden')?.id);
    expect(firstAction, 'The petition is the first visible homepage action').toBe('petition-action');
    await expect(page.locator('#petition-action')).toHaveAttribute('href', petition);
    await expect(page.locator('#petition-note')).not.toContainText('does not replace');
    await expect(formLinks(page)).toHaveCount(0);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('current Get involved fallback shows the closed stage; Dates retains its existing fallback', async ({ page }) => {
      // A post-deadline clock proves the static copy, not the date script, decides here.
      await page.clock.setFixedTime(new Date('2026-10-20T12:00:00Z'));
      for (const file of ['dates.html', 'get-involved.html']) {
        await page.goto('/' + file);
        await expect(page.locator('.current-response-note'), 'No page script ran').toHaveCount(0);
        const currentFallback = file === 'get-involved.html';
        await expect(page.locator('main [data-stage="open"]'), `${file} respond block`).toBeVisible({ visible: !currentFallback });
        await expect(page.locator('main [data-stage="closed"]'), `${file} closed block`).toBeVisible({ visible: currentFallback });
        if (currentFallback) expect(await page.locator('main > section').last().getAttribute('id')).toBe('respond');
      }
    });
  });
});

test('Campaign updates are dated exactly, newest first, and the petition entry leads to Get involved', async ({ page }) => {
  await page.goto('/updates.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Campaign updates');
  const entries = page.locator('main ol.update-list > li');
  expect(await entries.count(), 'There are campaign updates').toBeGreaterThan(1);
  const dates = await entries.evaluateAll(items => items.map(item => item.querySelectorAll('time[datetime]').length === 1 ? item.querySelector('time[datetime]').getAttribute('datetime') : null));
  for (const date of dates) {
    expect(date, 'Each update has one exact date').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(date + 'T00:00:00Z').toISOString().slice(0, 10), `${date} is a real calendar date`).toBe(date);
  }
  for (let index = 1; index < dates.length; index++) {
    expect(dates[index] <= dates[index - 1], `${dates[index]} follows ${dates[index - 1]} (newest first)`).toBe(true);
  }
  const bbc = page.locator('#update-bbc');
  await expect(entries.first()).toHaveAttribute('id', 'update-consultation-deadline');
  await expect(page.locator('#update-consultation-deadline time')).toHaveAttribute('datetime', '2026-10-16');
  await expect(page.locator('#update-recovery-plan time')).toHaveAttribute('datetime', '2026-10-16');
  const interviews = page.locator('#update-press-16-october');
  await expect(interviews.locator('time')).toHaveAttribute('datetime', '2026-10-16');
  await expect(interviews).toContainText('Campaign organisers reported');
  await expect(interviews).toContainText('after arranging a visit with Richmond Nub News');
  await expect(interviews).not.toContainText('The Standard');
  await expect(interviews).not.toContainText('MyLondon');
  await expect(page.locator('#update-press-15-october time')).toHaveAttribute('datetime', '2026-10-15');
  await expect(page.locator('#update-press-15-october')).toContainText('South West Londoner reporter');
  const article = page.locator('#update-bbc-article');
  await expect(article.locator('time')).toHaveAttribute('datetime', '2026-10-15');
  await expect(article.getByRole('link', { name: /Read the BBC article/ })).toHaveAttribute('href', 'https://www.bbc.co.uk/news/articles/c6rmy3e179n8o');
  await expect(bbc.locator('time')).toHaveAttribute('datetime', '2026-10-13');
  await expect(bbc).toContainText('6:30pm');
  await expect(bbc.getByRole('link', { name: /full programme on iPlayer/ })).toHaveAttribute('href', 'https://www.bbc.co.uk/iplayer/episode/m0032vcr/bbc-london-evening-news-13102026');
  await expect(bbc).toContainText('availability may be limited');
  const text = await page.locator('main').innerText();
  expect(text).not.toContain('~');
  expect(text.toLowerCase()).not.toContain('to be verified');
  const petitionEntry = entries.filter({ has: page.getByRole('heading', { name: /petition/i }) });
  await expect(petitionEntry).toHaveCount(1);
  await expect(petitionEntry.locator('a[href="get-involved.html#petition"]')).toBeVisible();
  const rally=page.locator('main ol.update-list > #update-york-house-rally');
  await expect(rally.locator('time')).toHaveAttribute('datetime','2026-10-06');
  const photo=rally.locator('img');
  await photo.scrollIntoViewIfNeeded();
  await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0), { message: 'The lazy-loaded rally photograph has loaded before decoding' }).toBe(true);
  await photo.evaluate(image=>image.decode());
  await expect(photo).toHaveAttribute('alt',/Campaign members.*York House/);
  const box=await photo.boundingBox();expect(box.width/box.height).toBeCloseTo(4/3,2);
});

for (const scripts of [true,false]) test.describe(`Updates discovery with scripts ${scripts}`,()=>{
 test.use({javaScriptEnabled:scripts});
 test('Shortcuts reach the proposal, media, rally photo and planned next-event details',async({page})=>{
  await page.goto('/updates.html');
  const nav=page.getByRole('navigation',{name:'Find campaign updates'});
  for(const [label,id]of[['Recovery proposal','update-recovery-plan'],['Media updates','update-press-16-october'],['Rally photo','update-york-house-rally'],['12 November rally','next-rally']]){
   await nav.getByRole('link',{name:label,exact:true}).click();
   await expect(page).toHaveURL(new RegExp('#'+id+'$'));
   await expect(page.locator('#'+id+' h2')).toBeInViewport();
   if(scripts)await expectScrollSettled(page,'Update '+label);
   await page.goBack();await expect(page).toHaveURL(/updates\.html$/);
  }
  await expect(page.locator('#update-recovery-plan')).toContainText('Achieving for Children');
  await expect(page.locator('#update-recovery-plan')).toContainText('The campaign believes');
  await expect(page.locator('#next-rally')).toContainText('Thursday 12 November 2026, 6pm');
  await expect(page.locator('#next-rally')).toContainText('until around 6:45pm');
  await expect(page.locator('#next-rally')).toContainText('access arrangements are not yet confirmed');
  await expect(page.locator('#next-rally time')).toHaveAttribute('datetime','2026-11-12T18:00:00+00:00');
  await expect(page.locator('#next-rally a')).toHaveAttribute('href','https://cabnet.richmond.gov.uk/ieListDocuments.aspx?CId=800&MId=500000748&Ver=4');
  await expect(page.locator('#update-news a')).toHaveCount(4);
 });
 test('Direct interview and existing BBC links retain readable destinations',async({page})=>{
  await page.setViewportSize({width:320,height:568});
  for(const [id,title]of[['update-press-16-october','Further parent interviews at the school gates'],['update-press-15-october','Parents speak with South West Londoner'],['update-bbc-article','Kew Riverside parents in BBC News']]){
   await page.goto('/updates.html#'+id);
   await expect(page.locator('#'+id+' h2')).toHaveText(title);
   await expect(page.locator('#'+id+' h2')).toBeInViewport();
   await expectNoHorizontalOverflow(page,'Updates '+id);
  }
 });
});

// A dated update remains a useful historical entry after the published deadline.
for (const [date, stage] of [['2026-10-16T12:00:00Z', 'open'], ['2026-10-17T12:00:00Z', 'closed']]) {
  test(`The deadline update reaches current official response details (${stage})`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(date));
    await page.goto('/updates.html#update-consultation-deadline');
    const entry = page.locator('#update-consultation-deadline');
    await expect(entry).toBeInViewport();
    await expect(entry).toContainText('16 October 2026');
    await entry.getByRole('link', { name: 'Official response details' }).click();
    await expect(page).toHaveURL(/get-involved\.html#respond$/);
    const response = page.locator(`#respond [data-stage="${stage}"]`);
    await expect(response).toBeVisible();
    if (stage === 'open') {
      await expect(response.locator(`a[href="${officialForm}"]`)).toBeVisible();
    } else {
      await expect(response).toContainText('16 October 2026');
      await expect(page.locator('#respond [data-stage="open"]')).toBeHidden();
    }
    await page.goBack();
    await expect(page).toHaveURL(/updates\.html#update-consultation-deadline$/);
    await expect(page.locator('#update-consultation-deadline')).toBeInViewport();
  });
}

test.describe('Archived pages', () => {
  for (const file of archivedPages) {
    test(`${file} says it is archived, points to current pages and is not indexed`, async ({ page }) => {
      await page.goto('/' + file);
      const first = page.locator('main > :first-child');
      await expect(first).toHaveClass(/(^|\s)archive-banner(\s|$)/);
      expect(await first.evaluate(element => element.tagName)).toBe('ASIDE');
      await expect(first).toBeVisible();
      await expect(first).toContainText('Archived 13 October 2026');
      await expect(first.locator('a[href="dates.html"]')).toBeVisible();
      await expect(first.locator('a[href="get-involved.html"]')).toBeVisible();
      const robots = file.startsWith('fundraising-') ? 'noindex,nofollow' : 'noindex,follow';
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', robots);
      await expect(page.locator('.site-orientation .archive-flag')).toHaveText('Archived');
      // Archived pages' dated Menu status note was removed by the 13 October 2026 slim-site decision.
      await expect(menu(page).locator('.mobile-page-note')).toHaveCount(0);
    });

    test(`${file} archive banner text has at least 4.5:1 contrast in light and dark`, async ({ page }) => {
      for (const colorScheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme });
        await page.goto('/' + file);
        const ratios = await page.locator('main > aside.archive-banner').evaluate(banner => {
          const parse = value => (value.match(/[\d.]+/g) || []).map(Number);
          const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
          const background = element => {
            for (let current = element; current; current = current.parentElement) {
              const colour = parse(getComputedStyle(current).backgroundColor);
              if (colour.length === 3 || colour[3] >= 0.95) return colour;
            }
            return [255, 255, 255];
          };
          return [banner.querySelector('p'), ...banner.querySelectorAll('p strong, p a')].map(element => {
            const fg = luminance(parse(getComputedStyle(element).color));
            const bg = luminance(background(element));
            return { element: element.tagName, ratio: +((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)).toFixed(2) };
          });
        });
        expect(ratios.length).toBeGreaterThanOrEqual(4);
        for (const { element, ratio } of ratios) expect(ratio, `${colorScheme} ${element} banner text contrast`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  for (const size of phoneSizes) {
    for (const link of ['faq.html#school-places', 'proposal.html#parent-plan', 'proposal.html#take-part']) {
      test(`${link} shows the Archived flag on arrival at ${size.width}x${size.height}`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto('/' + link);
        await expectScrollSettled(page, link);
        const flag = page.locator('.site-orientation .archive-flag');
        await expect(flag).toHaveText('Archived');
        await expect(flag).toBeVisible();
        await expect(flag).toBeInViewport({ ratio: 1 });
        await expectUncovered(flag, `${link} Archived flag`);
        await expectNoHorizontalOverflow(page, `${link} at ${size.width}px`);
      });
    }
  }

  test('the sitemap lists only the current pages', async ({ page, baseURL }) => {
    const response = await page.request.get(baseURL + '/sitemap.xml');
    expect(response.ok()).toBe(true);
    const locations = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    expect(locations).toEqual(['/', '/dates.html', '/get-involved.html', '/updates.html', '/about.html', '/letters.html', '/questions.html', '/evidence.html', '/understand.html', '/options.html', '/lessons.html', '/lessons-sources.html'].map(path => 'https://savekewriversideprimaryschool.org' + path));
  });
});

test('Live pages link to archived pages only through the dated Home research footer', async ({ page, baseURL }) => {
  // privacy.html explains who is named on the archived proposal page and links to that section.
  const allowed = { 'privacy.html': ['proposal.html#who-decides'], 'lessons-sources.html': ['proposal.html'] };
  for (const file of livePages) {
    await page.goto('/' + file);
    const hrefs = await page.locator('a[href]').evaluateAll(links => links
      .filter(link => !link.closest('aside.legacy-route'))
      .filter(link => !(document.body.hasAttribute('data-home-landing') && link.closest('footer #supporting-research') && ['questions.html#questions', 'understand.html#budget', 'options.html#options', 'lessons.html#key-lessons'].includes(link.getAttribute('href'))))
      .map(link => link.href));
    const archived = hrefs.map(href => new URL(href)).filter(url => [new URL(baseURL).origin, 'https://savekewriversideprimaryschool.org'].includes(url.origin)
      && archivedPages.includes(url.pathname.replace(/^\//, '')))
      .map(url => url.pathname.replace(/^\//, '') + url.hash)
      .filter(href => !(allowed[file] || []).includes(href));
    expect(archived, `${file} links only to current pages`).toEqual([]);
  }
});

test('Homepage legacy routes to current pages land on sections that exist', async ({ page, baseURL }) => {
  // Hard-coded: the old homepage fragments whose content now lives on a current page.
  const expected = {
    'next-dates': 'dates.html#timetable',
    'find-your-way': '#menu',
    'find-title': '#menu',
    overview: 'dates.html#council-documents',
    'quick-answers': 'dates.html#council-documents',
    'quick-answers-title': 'dates.html#council-documents',
    'visit-school': 'visit/index.html',
    'visit-school-title': 'visit/index.html',
    'brief-title': 'about.html#our-story',
    'about-prototype': 'about.html#site-responsibility',
  };
  await page.goto('/index.html');
  const routes = await page.locator('main aside.legacy-route').evaluateAll(asides => asides.map(aside => [aside.id, aside.dataset.destination]));
  const byId = Object.fromEntries(routes);
  for (const [id, destination] of Object.entries(expected)) expect(byId[id], `index.html#${id} still forwards`).toBe(destination);
  const livePaths = [...livePages, 'visit/index.html'];
  const home = new URL('/index.html', baseURL);
  const checked = new Map();
  for (const [id, destination] of routes) {
    const target = new URL(destination, home);
    const file = target.pathname.replace(/^\//, '');
    if (target.origin !== home.origin || !livePaths.includes(file)) continue;
    if (!checked.has(file)) {
      const response = await page.request.get(new URL(file, home).href);
      expect(response.ok(), `${file} is served`).toBe(true);
      checked.set(file, await response.text());
    }
    if (target.hash) {
      const fragment = decodeURIComponent(target.hash.slice(1));
      expect(checked.get(file).includes(` id="${fragment}"`), `index.html#${id} -> ${destination} reaches an existing id`).toBe(true);
    }
  }
  expect(checked.size, 'Live destinations were checked').toBeGreaterThanOrEqual(4);
});

// Implementation review (13 October 2026): after the deadline the petition leads on Get
// involved, while links to #respond still land on the closed note at the bottom.
test.describe('Get involved order around the deadline', () => {
  const order = page => page.locator('main section[id]').evaluateAll(sections => sections.map(section => section.id).slice(0, 2));

  test('Respond leads until 16 October and the petition leads from 17 October', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-16T22:59:59Z'));
    await page.goto('/get-involved.html');
    expect(await order(page)).toEqual(['respond', 'petition']);
    await page.clock.setFixedTime(new Date('2026-10-16T23:00:00Z'));
    await page.goto('/get-involved.html');
    expect(await order(page)).toEqual(['petition', 'representatives']);
    await expect(page.locator('#petition a[href="' + petition + '"]')).toBeVisible();
    expect(await page.locator('main > section').last().getAttribute('id')).toBe('respond');
    await page.goto('/get-involved.html#respond');
    await expectScrollSettled(page, 'get-involved.html#respond');
    await expect(page.locator('#respond [data-stage="closed"]')).toBeInViewport();
  });

  test('a page left open moves the petition up once and keeps keyboard focus', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-16T22:59:00Z') });
    await page.goto('/get-involved.html');
    expect(await order(page)).toEqual(['respond', 'petition']);
    await page.clock.runFor(61_000);
    expect(await order(page)).toEqual(['petition', 'representatives']);
    const link = page.locator('#petition a[href="' + petition + '"]');
    await link.focus();
    await page.clock.runFor(121_000);
    expect(await order(page)).toEqual(['petition', 'representatives']);
    await expect(link).toBeFocused();
    const y = await page.evaluate(() => scrollY);
    await page.evaluate(() => { dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('visibilitychange')); });
    expect(await page.evaluate(() => scrollY)).toBe(y);
    await expect(link).toBeFocused();
    expect(await page.locator('main > section').last().getAttribute('id')).toBe('respond');
  });

  for (const size of phoneSizes) {
    test(`the petition heading is on the first screen after the deadline at ${size.width}x${size.height}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-10-17T08:00:00Z'));
      await page.setViewportSize(size);
      await page.goto('/get-involved.html');
      await expect(page.locator('#petition h2')).toBeInViewport({ ratio: 1 });
      await expectNoHorizontalOverflow(page, `get-involved.html after the deadline at ${size.width}px`);
    });
  }
});

test('About links its campaign case to Campaign updates and the council documents', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('section#our-case')).toHaveCount(0);
  await page.goto('/about.html');
  const caseSection = page.locator('#our-case');
  for (const [href, name] of [['dates.html', 'Read the council’s dates, leaflet and FAQs'], ['updates.html', 'See what the campaign has done']]) {
    const link = caseSection.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
  }
});

test('Archived pages name the archive date in the wide-screen status strip', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const file of archivedPages) {
    await page.goto('/' + file);
    const strip = page.locator('.independent-bar span').first();
    await expect(strip, file).toHaveText('Archived 13 October 2026');
    await expect(strip, file).toBeVisible();
  }
});

test.describe('Archived deep links without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  for (const size of [...phoneSizes, { width: 1280, height: 800 }]) {
    for (const link of ['faq.html#school-places', 'proposal.html#take-part']) {
      test(`${link} keeps the Archived flag in view at ${size.width}x${size.height}`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto('/' + link);
        const flag = page.locator('.site-orientation .archive-flag');
        await expect(flag).toBeInViewport({ ratio: 1 });
        // The target lands below the sticky header once any smooth scrolling ends.
        const id = link.split('#')[1];
        await expect.poll(() => page.evaluate(id => {
          const target = document.getElementById(id).getBoundingClientRect().top;
          const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
          return target >= header - 1 && target < innerHeight;
        }, id), { message: `${link} target clear of the header` }).toBe(true);
        await expect(flag).toBeInViewport({ ratio: 1 });
      });
    }
  }
});

// Owner correction after the team preview: Home stays concise; old case links survive.
for (const id of ['our-case', 'case-title']) {
  test(`Home campaign-case anchor ${id} reaches About`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/index.html#' + id);
    await expect(page).toHaveURL(new RegExp('about\\.html#' + id + '$'));
    await expect(page.locator('#' + id)).toBeInViewport();
    const heading = await page.locator('#case-title').boundingBox();
    const header = await page.locator('header').boundingBox();
    expect(heading.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    await expect(page.locator('#our-case')).toContainText('A funded, workable alternative has not yet been established.');
  });
}

// Owner-authorized optional depth: Home remains concise and Menu stays unchanged.
for (const width of [320, 390, 1440]) {
  test(`Home research footer restores dated references at ${width}px`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
    await page.setViewportSize({ width, height: width === 320 ? 568 : 1000 });
    await page.goto('/index.html');
    const group = page.locator('footer #supporting-research');
    await expect(group).not.toHaveAttribute('open', '');
    await expect(page.locator('section#our-case')).toHaveCount(0);
    await expect(page.locator('.mobile-menu a[href^="proposal"], .mobile-menu a[href^="understand"], .mobile-menu a[href^="evidence"], .mobile-menu a[href^="options"], .mobile-menu a[href^="lessons"]')).toHaveCount(0);
    expect(await page.locator('.footer-details > details').evaluateAll(items => items.map(item => item.id))).toEqual(['press', 'site-settings', 'supporting-research']);
    await group.locator('summary').scrollIntoViewIfNeeded();
    await group.locator('summary').focus();
    await group.locator('summary').press('Enter');
    await expect(group).toHaveAttribute('open', '');
    await expect(group).not.toContainText('archived');
    await expect(group.locator('a[href="dates.html"], a[href="get-involved.html"]')).toHaveCount(0);
    for (const [href, name] of [['questions.html#questions','Six questions worth asking'],['evidence.html#records','Evidence & original sources'],['understand.html#budget','School finances & closure costs'],['options.html#options','Ways to keep Kew open'],['lessons.html#key-lessons','Historical school cases']]) {
      const link = group.getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', href);
      await link.click();
      await expect(page.locator('.archive-flag, .archive-banner')).toHaveCount(0);
      const id = href.split('#')[1];
      await expect(page.locator('#'+id)).toBeInViewport();
      if (id === 'questions') {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Six questions worth asking');
        await expect(page.locator('#questions')).toContainText('You can respond without waiting for answers.');
        await expect(page.locator('#questions')).toContainText('If Kew closed, where would my child go?');
      }
      await page.goBack();
      await expect(group).toHaveAttribute('open', '');
    }
    await expectNoHorizontalOverflow(page, `research footer at ${width}px`);
  });
}

test('Shared research-footer link opens the optional section', async ({ page }) => {
  await page.goto('/index.html#supporting-research');
  await expect(page.locator('footer #supporting-research')).toHaveAttribute('open', '');
});


test.describe('Visual contribution cards', () => {
  test('video follows the letter immediately and help is the last action before the consultation reference', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
    await page.goto('/get-involved.html#share-your-story');
    expect(await page.locator('main > section').evaluateAll(sections => sections.map(section => section.id))).toEqual([
      'petition', 'representatives', 'share-your-story', 'parent-video', 'spread-the-word', 'school-contributions', 'help', 'respond',
    ]);
    await expect(page.locator('#share-your-story + #parent-video')).toHaveCount(1);
    await expect(page.locator('#school-contributions + #help + #respond')).toHaveCount(1);
    // Native focus traversal follows the visual order across the newly adjacent cards.
    // macOS WebKit uses Option-Tab for links; the phone projects still verify DOM order.
    if (!test.info().project.name.startsWith('iphone') && !test.info().project.name.startsWith('android')) {
      const read = page.locator('#share-your-story .contribution-secondary');
      await read.focus();
      await page.keyboard.press(test.info().project.name.includes('webkit') ? 'Alt+Tab' : 'Tab');
      await expect(page.locator('#parent-video a.primary')).toBeFocused();
    }
    await page.goto('/get-involved.html#parent-video');
    const video = page.locator('#parent-video');
    await expectScrollSettled(page, 'parent video arrival');
    await expect(video.locator(':scope > .contribution-kicker')).toBeInViewport({ ratio: 1 });
    await expect(video.getByRole('heading', { level: 2 })).toBeInViewport({ ratio: 1 });
    await video.locator('a.primary').click();
    await expect(page.locator('#video-upload-link')).toBeInViewport({ ratio: 1 });
    await page.goBack();
    await expect(video.getByRole('heading', { level: 2 })).toBeInViewport({ ratio: 1 });
  });

  test('letter and video actions reach the existing forms and Back returns to the card', async ({ page }) => {
    await page.goto('/get-involved.html#share-your-story');
    const letter = page.locator('#share-your-story');
    await expect(letter.getByRole('link', { name: 'Read community letters' })).toHaveAttribute('href', 'letters.html');
    await letter.getByRole('link', { name: 'Write a community letter' }).click();
    await expect(page).toHaveURL(/letters\.html#letter-form$/);
    await expect(page.locator('#message')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/get-involved\.html#share-your-story$/);
    await expect(letter).toBeInViewport();
    const video = page.locator('#parent-video');
    await expect(video).toContainText('30 seconds–3 minutes');
    await expect(video).toContainText('adults only');
    await expect(video).toContainText('children off camera');
    await expect(video).toContainText('YouTube permission required');
    await expect(video).toContainText('Permissions first, then private upload');
    await expect(video).toContainText('published automatically after checks');
    await expect(page.locator('#share-your-story a[href="videos.html#upload"]')).toHaveCount(0);
    await expect(page.locator('#parent-video.recruitment-action > .contribution-kicker')).toHaveText('Discover the school');
    await expect(video.getByRole('heading', { level: 2, name: 'Record a parent video' })).toBeVisible();
    await video.getByRole('link', { name: 'Share your parent testimonial' }).click();
    await expect(page).toHaveURL(/videos\.html#upload$/);
    await expect(page.locator('#video-upload-link')).toBeInViewport({ ratio: 1 });
  });

  test('help card reaches the private choices without changing them', async ({ page }) => {
    await page.goto('/get-involved.html#help');
    const help = page.locator('#help');
    await expect(help.getByRole('link', { name: 'Email savekrps@gmail.com' })).toHaveAttribute('href', 'mailto:savekrps@gmail.com');
    await help.getByRole('link', { name: 'Send an idea or offer help' }).click();
    await expect(page).toHaveURL(/feedback\.html$/);
    await expect(page.locator('.ideas-intro')).toContainText('Nothing is published');
    await expect(page.locator('#kind-cards')).toBeVisible();
  });

  test('old QR anchors expose distinctly labelled campaign and Open Day downloads', async ({ page }) => {
    for (const [id, prefix, group] of [
      ['share-qr', 'home', 'Campaign homepage QR downloads'],
      ['visit-qr', 'visit', 'Open Day QR downloads'],
    ]) {
      await page.goto('/get-involved.html#' + id);
      await expect(page.locator('#' + id)).toBeInViewport();
      for (const format of ['png', 'svg']) {
        const link = page.getByRole('navigation', { name: group }).locator(`a[href="qr/savekewriverside-${prefix}-qr.${format}"]`);
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('download', `savekewriverside-${prefix}-qr.${format}`);
        const downloadPromise = page.waitForEvent('download');
        await link.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe(`savekewriverside-${prefix}-qr.${format}`);
        expect(await download.failure()).toBe(null);
      }
    }
    await expect(page.locator('.school-contributions #visit-qr')).toContainText('without showing campaign pages');
    await expect(page.locator('#spread-the-word #visit-qr')).toHaveCount(0);
  });

  test('cards reflow with visible buttons in both appearances and enlarged text', async ({ page }) => {
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 1000 });
        await page.goto('/get-involved.html#share-your-story');
        for (const id of ['share-your-story', 'help', 'parent-video', 'visit-qr']) {
          const card = page.locator('#' + id);
          const actions = card.locator('.simple-actions a');
          for (const action of await actions.all()) {
            await expect(action).toBeVisible();
            const box = await action.boundingBox();
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
          }
        }
        await expectNoHorizontalOverflow(page, `${width}px ${colorScheme} contribution cards`);
      }
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('main, main *')].map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
      for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`;
    });
    await expectNoHorizontalOverflow(page, '320px enlarged text contribution cards');
    // Enter keyboard modality before checking the native link’s focus outline.
    const write = page.locator('#share-your-story a.primary');
    await page.keyboard.press('Tab');
    await write.focus();
    await expect(write).toBeFocused();
    expect(await write.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(3);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('letters, recruitment video and old downloads work as ordinary links', async ({ page }) => {
      await page.goto('/get-involved.html#share-your-story');
      expect(await page.locator('main > section').evaluateAll(sections => sections.map(section => section.id))).toEqual([
        'petition', 'representatives', 'share-your-story', 'parent-video', 'spread-the-word', 'school-contributions', 'help', 'respond',
      ]);
      await page.locator('#share-your-story a.primary').click();
      await expect(page.locator('#message')).toBeVisible();
      await page.goBack();
      await expect(page.locator('#share-your-story')).toBeInViewport();
      await page.locator('#parent-video a.primary').click();
      await expect(page.locator('#video-upload-link')).toBeInViewport({ ratio: 1 });
      for (const id of ['share-qr', 'visit-qr']) {
        await page.goto('/get-involved.html#' + id);
        await expect(page.locator('#' + id)).toBeInViewport();
        await expect(page.locator('#' + id + ' a[download]')).toHaveCount(2);
      }
    });
  });
});

// Owner request, 19 October: get to available actions sooner, with the petition's
// own closing date on its button and the closed consultation retained at #respond.
test.describe('Current actions first', () => {
  test('petition deadline is part of the action and lookup buttons reach the right representatives', async ({ page, hasTouch }) => {
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
    await page.goto('/get-involved.html');
    const button = page.locator('#involved-petition-action');
    await expect(button).toHaveAccessibleName('Sign petition by 13 Jan 2027');
    await expect(button.locator('time')).toHaveAttribute('datetime', '2027-01-13');
    await expect(page.locator('#petition > p')).toContainText('live, work or study in Richmond borough');
    await expect(page.locator('#petition > p')).toContainText('Richmond Account');
    for (const [name, url] of [
      ['Find your councillors', 'https://cabnet.richmond.gov.uk/mgMemberIndex.aspx?bcr=1'],
      ['Find your MP', 'https://members.parliament.uk/FindYourMP'],
    ]) {
      await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<h1>Fictional representative lookup</h1>' }));
      const link = page.locator('#representatives').getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', url);
      await link.scrollIntoViewIfNeeded();
      if (hasTouch) await link.tap(); else await link.click();
      await expect(page).toHaveURL(url);
      await page.goBack();
      await expect(page.locator('#representatives')).toBeInViewport();
    }
  });

  for (const [at, expired] of [['2027-01-13T23:59:59Z', false], ['2027-01-14T00:00:00Z', true]]) {
    test(`petition invitation follows its independent London closing date at ${at}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(at));
      await page.goto('/get-involved.html#petition');
      await expect(page.locator('#petition-title')).toHaveText(expired ? 'View the petition' : 'Sign the petition');
      await expect(page.locator('#involved-petition-action')).toHaveAccessibleName(expired ? 'View petition · closed 13 Jan 2027' : 'Sign petition by 13 Jan 2027');
      await expect(page.locator('#involved-petition-action')).toHaveAttribute('href', petition);
    });
  }

  test('midnight refresh keeps a held petition target stable, then updates on activation and Back', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-01-13T23:59:00Z') });
    await page.goto('/get-involved.html#petition');
    const link = page.locator('#involved-petition-action');
    await link.focus();
    await link.dispatchEvent('pointerdown');
    const before = await link.boundingBox();
    await page.clock.runFor(61_000);
    await expect(link).toHaveAccessibleName('Sign petition by 13 Jan 2027');
    expect(await link.boundingBox()).toEqual(before);
    await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup')));
    await page.route(petition, route => route.fulfill({ contentType: 'text/html', body: '<h1>Fictional petition</h1>' }));
    await link.press('Enter');
    await expect(page).toHaveURL(petition);
    await page.goBack();
    await expect(page.locator('#petition-title')).toHaveText('View the petition');
    await expect(link).toHaveAccessibleName('View petition · closed 13 Jan 2027');
    await expect(link).toBeInViewport();
  });

  test('unpressed long-open page updates the whole petition invitation without stealing focus', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-01-13T23:59:00Z') });
    await page.goto('/get-involved.html#petition');
    const link = page.locator('#involved-petition-action');
    await link.focus();
    await page.clock.runFor(61_000);
    await expect(page.locator('#petition-title')).toHaveText('View the petition');
    await expect(link).toHaveAccessibleName('View petition · closed 13 Jan 2027');
    await expect(link).toBeFocused();
  });

  test('old consultation links arrive at the visible heading and return from its timetable', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
    await page.goto('/get-involved.html#respond');
    await expectScrollSettled(page, 'closed consultation arrival');
    const heading = page.locator('#respond-closed-title');
    await expect(heading).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#respond')).toHaveAccessibleName('The consultation response deadline has passed');
    await page.locator('#respond a[href="dates.html#timetable"]').click();
    await expect(page.locator('#timetable')).toBeInViewport();
    await page.goBack();
    await expect(heading).toBeInViewport({ ratio: 1 });
  });
});
