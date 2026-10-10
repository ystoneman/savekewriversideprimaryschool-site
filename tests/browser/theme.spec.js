const { test, expect, pages } = require('./fixtures');

const dark = 'rgb(16, 30, 27)', light = 'rgb(251, 250, 246)';
async function appearance(page, expected) {
  // WebKit can expose a transparent body when its background is propagated to
  // the canvas. Assert the explicit canvas and the body's effective background.
  await expect(page.locator('html')).toHaveCSS('background-color', expected);
  await expect.poll(() => page.locator('body').evaluate(el => {
    while (el) {
      const color = getComputedStyle(el).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
      el = el.parentElement;
    }
  })).toBe(expected);
}
async function paintFullPage(page) {
  const { width, height } = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
  }));
  // A full-page capture can exceed WebKit's 32,767-pixel image limit on long
  // pages. Paint the same document in bounded CSS-pixel strips instead.
  for (let y = 0; y < height; y += 16_000) {
    await page.screenshot({ fullPage: true, clip: { x: 0, y, width, height: Math.min(16_000, height - y) }, scale: 'css' });
  }
}
for (const file of pages) {
  test(`Appearance follows the system on ${file}, with readable dark text`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/' + file);
    await appearance(page, dark);
    const sheets = await page.locator('link[rel=stylesheet]').evaluateAll(links => links.map(link => link.href));
    for (const href of sheets) {
      const url = new URL(href);
      if (!url.pathname.endsWith('/button-motion.css')) expect(url.searchParams.get('v'), 'Theme-dependent CSS must bypass older cached palettes').toMatch(/^\d+$/);
    }
    await expect(page.getByLabel('Appearance', { exact: true })).toHaveValue('system');
    await expect(page.getByLabel('Appearance', { exact: true })).toHaveCSS('min-height','44px');
    await expect(page.locator('.participation-nav .nav-letters')).toBeVisible();
    await expect(page.locator('.participation-nav .nav-contribute')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    // Measure only after the complete document has been painted.
    await paintFullPage(page);
    await expect.poll(() => page.evaluate(() => {
      const parse = value => (value.match(/[\d.]+/g) || []).map(Number);
      const lum = rgb => rgb.slice(0,3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum,v,i) => sum + v * [.2126,.7152,.0722][i], 0);
      const failures = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('svg') || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
        if (![...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())) continue;
        const style = getComputedStyle(el); const color = parse(style.color);
        let bg = [255,255,255], current = el;
        while (current) {
          const candidate = parse(getComputedStyle(current).backgroundColor);
          if (candidate.length === 3 || candidate[3] >= .95) { bg = candidate; break; }
          current = current.parentElement;
        }
        const ratio = (Math.max(lum(color),lum(bg))+.05)/(Math.min(lum(color),lum(bg))+.05);
        const large = parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && parseInt(style.fontWeight)>=700);
        if (ratio < (large ? 3 : 4.5)-.02) failures.push({ element: el.tagName+'.'+el.className, ratio: +ratio.toFixed(2), color:style.color, bg });
      }
      return failures;
    }), { message:'Visible HTML text contrast, including consent/source labels' }).toEqual([]);
    await page.emulateMedia({ colorScheme:'light' });
    await appearance(page, light);
  });
}

test('Unanswered questions links, status labels and disclosure controls have readable contrast in both appearances', async ({ page }) => {
  const targets = [
    '#gaps .gaps-intro a', '#evidence-found a', '#gap-records a',
    '#gaps .gap-detail > summary > span:first-child', '#gaps .gap-state',
  ];
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/evidence.html#gaps');
    for (const id of ['evidence-found', 'gap-records']) {
      const detail = page.locator(`#${id} .gap-detail`);
      if (await detail.getAttribute('open') === null) await detail.locator(':scope > summary').click();
    }
    for (const selector of targets) {
      const elements = page.locator(selector);
      expect(await elements.count(), selector + ' is present').toBeGreaterThan(0);
      for (const element of await elements.all()) await expect(element).toBeVisible();
    }
    const measurements = await page.evaluate(selectors => {
      const parse = value => (value.match(/[\d.]+/g) || []).map(Number);
      const lum = rgb => rgb.slice(0,3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum,v,i) => sum + v * [.2126,.7152,.0722][i], 0);
      const blend = (foreground, background) => foreground.slice(0,3).map((v, i) => v * (foreground[3] ?? 1) + background[i] * (1 - (foreground[3] ?? 1)));
      function measure(element, pseudo = null) {
        const ancestors = [];
        for (let current = element; current; current = current.parentElement) ancestors.unshift(current);
        let background = ancestors.reduce((bg, ancestor) => blend(parse(getComputedStyle(ancestor).backgroundColor), bg), [255,255,255]);
        const style = getComputedStyle(element, pseudo);
        if (pseudo) background = blend(parse(style.backgroundColor), background);
        const color = blend(parse(style.color), background);
        const ratio = (Math.max(lum(color),lum(background))+.05)/(Math.min(lum(color),lum(background))+.05);
        const large = parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && parseInt(style.fontWeight)>=700);
        return { element: element.closest('article')?.id || 'intro', text: pseudo ? style.content : element.textContent.trim(), pseudo, ratio, minimum: large ? 3 : 4.5 };
      }
      return [
        ...selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(element => measure(element))),
        ...[...document.querySelectorAll('#gaps .gap-detail > summary')].map(element => measure(element, '::after')),
      ];
    }, targets);
    const controls = measurements.filter(item => item.pseudo);
    expect(controls).toHaveLength(10);
    expect(controls.some(item => item.text.includes('+'))).toBe(true);
    expect(controls.some(item => item.text.includes('−'))).toBe(true);
    for (const measurement of measurements) {
      expect(measurement.ratio, `${scheme}: ${measurement.element} ${measurement.text}`).toBeGreaterThanOrEqual(measurement.minimum - .02);
    }
  }
});

test('Manual choices persist across pages and Back; System resumes live device changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme:'dark' });
  await page.goto('/index.html');
  await page.getByLabel('Appearance', { exact:true }).selectOption('light');
  await appearance(page, light);
  await page.reload(); await appearance(page, light);
  await page.locator('.nav-letters').click(); await appearance(page, light);
  await page.getByLabel('Appearance', { exact:true }).selectOption('dark');
  await page.goBack(); await appearance(page, dark);
  await expect(page.getByLabel('Appearance', { exact:true })).toHaveValue('dark');
  await page.getByLabel('Appearance', { exact:true }).selectOption('dark');
  await page.emulateMedia({ colorScheme:'light' }); await appearance(page, dark);
  await page.getByLabel('Appearance', { exact:true }).selectOption('system'); await appearance(page, light);
  await page.emulateMedia({ colorScheme:'dark' }); await appearance(page, dark);
  expect(await page.evaluate(() => localStorage.getItem('kew-appearance-v1'))).toBeNull();
});

test('A saved Light choice paints a fresh page under a dark device setting', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme:'dark' });
  await page.goto('/index.html');
  await page.getByLabel('Appearance', { exact:true }).selectOption('light');
  const fresh = await context.newPage();
  await fresh.emulateMedia({ colorScheme:'dark' });
  await fresh.goto('/letters.html');
  await appearance(fresh, light);
  await expect(fresh.locator('body')).toHaveCSS('color', 'rgb(53, 75, 72)');
  await expect(fresh.getByLabel('Appearance', { exact:true })).toHaveValue('light');
  await fresh.close();
});

test('Another open tab receives a changed or removed override', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme:'light' }); await page.goto('/index.html');
  const second=await context.newPage(); await second.emulateMedia({colorScheme:'light'}); await second.goto('/faq.html');
  await page.getByLabel('Appearance', { exact:true }).selectOption('dark');
  await appearance(second,dark);
  await page.getByLabel('Appearance', { exact:true }).selectOption('system');
  await appearance(second,light); await second.close();
});

for (const mode of ['blocked','invalid']) test(`Storage ${mode} keeps reading and appearance controls usable`, async ({ page }) => {
  await page.addInitScript(mode => {
    if (mode==='blocked') for (const method of ['getItem','setItem','removeItem']) Object.defineProperty(Storage.prototype,method,{value:()=>{throw new Error('Unavailable');}});
    else localStorage.setItem('kew-appearance-v1','not-a-theme');
  },mode);
  await page.emulateMedia({colorScheme:'dark'}); await page.goto('/feedback.html'); await appearance(page,dark);
  await page.getByLabel('Appearance', {exact:true}).selectOption('light'); await appearance(page,light);
  if (mode==='blocked') await expect(page.locator('#appearance-status')).toContainText('could not be saved');
  await expect(page.locator('#message')).toBeVisible();
});

test('System appearance works without JavaScript and print remains light', async ({ browser, baseURL }) => {
  const context = await browser.newContext({javaScriptEnabled:false,colorScheme:'dark',ignoreHTTPSErrors:true});
  const page = await context.newPage();
  await page.goto(baseURL+'/faq.html'); await appearance(page,dark);
  await expect(page.getByLabel('Appearance',{exact:true})).toHaveCount(0);
  await page.emulateMedia({media:'print'}); await expect(page.locator('body')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(page.locator('html')).toHaveCSS('color-scheme','light'); await context.close();
});

test('Dark mode keeps forms, disclosure content and focus readable without changing permissions', async ({page}) => {
  await page.emulateMedia({colorScheme:'dark'}); await page.goto('/letters.html#letter-form');
  await expect(page.locator('#message')).toHaveCSS('background-color','rgb(25, 43, 37)');
  for (const checkbox of await page.locator('form input[type=checkbox]').all()) await expect(checkbox).not.toBeChecked();
  const choice = page.getByLabel('Appearance',{exact:true}); await choice.focus();
  await expect(choice).toBeFocused(); await expect(choice).toHaveCSS('outline-style','solid');
  await page.goto('/faq.html'); await page.locator('.faq-answer summary').first().click();
  await expect(page.locator('.faq-answer').first()).toHaveAttribute('open','');
  await expect(page.locator('.faq-answer').first()).toHaveCSS('background-color','rgb(25, 43, 37)');
});

test('Analytics choices follow the system appearance while remaining readable', async ({page}) => {
  await page.emulateMedia({colorScheme:'dark'}); await page.goto('/index.html');
  await page.getByRole('link',{name:'Analytics choices',exact:true}).click();
  const panel=page.locator('#analytics-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('background-color','rgb(25, 43, 37)');
  await expect(panel).toHaveCSS('color','rgb(238, 244, 236)');
  // Aggregate statistics is the default; optional detailed measurement stays unpressed.
  await expect(panel.getByRole('button',{name:'Aggregate statistics only'})).toHaveCSS('background-color','rgb(34, 56, 46)');
  await expect(panel.getByRole('button',{name:'Include detailed usage'})).toHaveCSS('background-color','rgb(25, 43, 37)');
  await expect(panel.getByRole('button',{name:'Turn analytics off'})).toHaveCSS('background-color','rgb(25, 43, 37)');
  await page.emulateMedia({colorScheme:'light'});
  await expect(panel).toHaveCSS('background-color','rgb(255, 253, 247)');
});

test('Chart series, keys and forecast markers retain their meaning in dark mode', async ({page}) => {
  await page.emulateMedia({colorScheme:'dark'}); await page.goto('/evidence.html');
  await expect(page.locator('.roll-legend i').first()).toHaveCSS('border-top-color','rgb(139, 215, 207)');
  await expect(page.locator('.roll-reported')).toHaveCSS('stroke','rgb(139, 215, 207)');
  await expect(page.locator('.roll-forecast')).toHaveCSS('stroke-dasharray','8px, 6px');
  await expect(page.locator('.roll-point.forecast').first()).toHaveCSS('fill','rgb(57, 47, 32)');
  await page.goto('/understand.html');
  await expect(page.locator('.attainment-bar').first()).toHaveCSS('fill','rgb(139, 215, 207)');
  await expect(page.locator('.attainment-bar.series-1').first()).toHaveCSS('fill','rgb(169, 197, 172)');
  await expect(page.locator('.attainment-bar.series-2').first()).toHaveCSS('fill','rgb(233, 198, 139)');
  await expect(page.locator('.attainment-charts text').first()).toHaveCSS('fill','rgb(193, 210, 198)');
  const ramp=await page.locator('.cohort-key i').evaluateAll(items=>items.map(el=>getComputedStyle(el).backgroundColor));
  expect(new Set(ramp).size).toBe(ramp.length);
  await page.goto('/lessons.html');
  for (const img of await page.locator('.lesson-exhibit img').all()) await expect(img).toHaveCSS('filter','none');
});

test('Expanded borough chart keeps a solid surface in light and dark appearances', async ({page}) => {
  for (const [scheme, background, ink] of [
    ['light', 'rgb(255, 255, 255)', 'rgb(24, 55, 51)'],
    ['dark', 'rgb(25, 43, 37)', 'rgb(238, 244, 236)'],
  ]) {
    await page.emulateMedia({colorScheme:scheme});
    await page.goto('/evidence.html');
    await page.locator('#council-figures > summary').click();
    await page.locator('#borough-context > summary').click();
    const chart=page.locator('#borough-context .chart-card');
    await expect(chart).toBeVisible();
    await expect(chart).toHaveCSS('background-color',background);
    await expect(chart.getByRole('heading',{name:'Fewer on-time Reception applications'})).toHaveCSS('color',ink);
  }
});

test('Dark system with a manual override still prints in light colours', async ({page}) => {
  await page.emulateMedia({colorScheme:'dark'}); await page.goto('/index.html');
  await page.getByLabel('Appearance',{exact:true}).selectOption('dark');
  await page.emulateMedia({media:'print'});
  await expect(page.locator('html')).toHaveCSS('color-scheme','light');
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(page.locator('.theme-controls')).toBeHidden();
});

test('Narrow dark arrival retains the parent plan and touch navigation', async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  await page.emulateMedia({colorScheme:'dark'}); await page.goto('/index.html');
  await expect(page.locator('.parent-plan-spotlight')).toBeInViewport();
  await page.locator('.mobile-menu summary').click();
  await expect(page.locator('.mobile-menu')).toHaveAttribute('open','');
  await page.locator('.mobile-menu a[href="faq.html"]').click();
  await expect(page).toHaveURL(/faq\.html$/); await appearance(page,dark);
  await expect(page.locator('.mobile-menu')).not.toHaveAttribute('open','');
});

// Primary buttons must read as buttons in both appearances. In dark mode the brand
// green was almost the page and card colour (1.0–1.36:1), so the main action on the
// video page, the homepage response button and the letter/idea Send buttons looked
// like plain text. Text contrast alone did not catch it.
test('Primary buttons stand out at least 3:1 from their background in both appearances', async ({ page }) => {
  for (const colorScheme of ['light', 'dark']) {
    // Two states appear only after a fictional letter: the letters return panel
    // and the next-steps card. Both hold an official-response button.
    const visits = [
      ['index.html'], ['proposal.html'], ['letters.html'], ['feedback.html'], ['videos.html'], ['options.html'], ['faq.html'],
      ['letters.html', () => localStorage.setItem('kr-letter-draft', JSON.stringify({ v: 1, text: 'A fictional letter for a colour check.', name: '', saved: Date.now(), pending: true }))],
      ['sent.html', () => { sessionStorage.setItem('kr-sent-kind', JSON.stringify({ kind: 'letter', at: Date.now() })); sessionStorage.setItem('kr-sent-letter', JSON.stringify({ text: 'A fictional letter.', at: Date.now() })); }],
    ];
    for (const [file, seed] of visits) {
      const context = page.context();
      const fresh = await context.newPage();
      await fresh.emulateMedia({ colorScheme });
      if (seed) await fresh.addInitScript(seed);
      await fresh.goto('/' + file);
      if (seed) await expect(fresh.locator('main .primary[href^="https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC"]').first()).toBeVisible();
      const weak = await fresh.evaluate(() => {
        const rgb = value => { const m = value.match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); return a === 0 ? null : [r, g, b]; };
        const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const behind = el => { for (let node = el.parentElement; node; node = node.parentElement) { const c = rgb(getComputedStyle(node).backgroundColor); if (c) return c; } return rgb(getComputedStyle(document.documentElement).backgroundColor) || [255, 255, 255]; };
        return [...document.querySelectorAll('main .primary')].filter(el => el.getClientRects().length).map(el => {
          const own = rgb(getComputedStyle(el).backgroundColor);
          return { label: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), ratio: own ? +ratio(own, behind(el)).toFixed(2) : 0 };
        }).filter(item => item.ratio < 3);
      });
      expect(weak, `${colorScheme}: ${file}${seed ? ' (after a letter)' : ''}`).toEqual([]);
      await fresh.close();
    }
  }
});
