// Fictional clean contexts only. Production origins are intercepted locally;
// no real form, analytics, provider or saved visitor data is used.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const NEW = 'https://savekewriversideprimaryschool.org/';
let directory, artifact;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf' };
test.beforeAll(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kew-redirect-test-'));
  artifact = path.join(directory, 'legacy');
  execFileSync('python3', ['.github/scripts/check_site.py', '--stage', path.join(directory, 'source')]);
  execFileSync('python3', ['.github/scripts/build_old_site_redirect.py', '--source', path.join(directory, 'source'), '--output', artifact]);
});
test.afterAll(() => { if (directory) fs.rmSync(directory, { recursive: true }); });
for (const OLD of ['https://ystoneman.github.io/kew-riverside-website/', 'https://savekewriverside.org/']) {
test.describe(OLD, () => {
async function setup(browser, options = {}, seed) {
  const project = test.info().project.use;
  const context = await browser.newContext({ viewport: project.viewport, isMobile: project.isMobile, hasTouch: project.hasTouch, deviceScaleFactor: project.deviceScaleFactor, userAgent: project.userAgent, ...options, serviceWorkers: 'block' });
  const forbidden = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET') { forbidden.push(request.url()); return route.abort(); }
    if (request.url().startsWith(OLD)) {
      const relative = decodeURIComponent(url.pathname.slice(new URL(OLD).pathname.length)) || 'index.html';
      const file = path.join(artifact, relative);
      if (!file.startsWith(artifact + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: 'missing' });
      return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    }
    if (url.origin === new URL(NEW).origin || url.origin === 'https://before.example.invalid') {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Destination</title><a href="' + OLD + 'letters.html">Recover old draft</a><p>Fictional destination</p>' });
    }
    forbidden.push(request.url());
    return route.abort();
  });
  if (seed) await context.addInitScript(seed);
  const page = await context.newPage();
  return { context, page, forbidden };
}
for (const relative of ['', ...fs.readdirSync('.').filter(name => name.endsWith('.html')), 'proposal.html?source=flyer#take-part', 'feedback.html?kind=privacy#feedback-form', 'letters.html#letter-fictional']) {
  test('forwards known page, query and section: ' + relative, async ({ browser }, info) => {
    test.skip(info.project.name === 'iphone-no-javascript', 'No-script fallback tested separately');
    const { context, page, forbidden } = await setup(browser);
    try {
      await page.goto(OLD + relative);
      await expect(page).toHaveURL(NEW + relative.replace(/^index\.html$/, ''));
      expect(forbidden).toEqual([]);
    } finally { await context.close(); }
  });
}
test('replace navigation makes Back return to prior page without an old/new loop', async ({ browser }, info) => {
  test.skip(info.project.name === 'iphone-no-javascript', 'No-script fallback tested separately');
  const { context, page } = await setup(browser);
  try {
    await page.goto('https://before.example.invalid/');
    await page.goto(OLD + 'videos.html#upload');
    await expect(page).toHaveURL(NEW + 'videos.html#upload');
    await page.goBack();
    await expect(page).toHaveURL('https://before.example.invalid/');
  } finally { await context.close(); }
});
for (const text of ['abc', 'A fictional saved letter about our neighbourhood school.']) {
  test('keeps and restores old draft, including unfinished words: ' + text.length, async ({ browser }, info) => {
    test.skip(info.project.name === 'iphone-no-javascript', 'Draft restoration requires scripts');
    const draft = { v: 1, text, name: 'Fictional', saved: Date.now(), pending: false };
    const { context, page, forbidden } = await setup(browser);
    // Add only on initial arrival; never reseed after an explicit clear.
    await context.addInitScript(({ draft, origin }) => { if (location.origin === origin && !sessionStorage.getItem('seeded')) { localStorage.setItem('kr-letter-draft', JSON.stringify(draft)); sessionStorage.setItem('seeded', 'yes'); } }, { draft, origin: new URL(OLD).origin });
    try {
      await page.goto(OLD + 'letters.html#letter-form');
      await expect(page.locator('#recovered-0')).toHaveValue(text);
      await expect(page.locator('#letter-form')).toBeVisible();
      await expect(page.locator('form')).toHaveCount(0);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kr-letter-draft')))).toEqual(draft);
      await page.getByRole('button', { name: 'Clear saved words', exact: true }).click();
      await expect(page.locator('textarea')).toHaveCount(0);
      await page.reload();
      await expect(page).toHaveURL(NEW + 'letters.html#letter-form');
      expect(forbidden).toEqual([]);
    } finally { await context.close(); }
  });
}
for (const area of ['localStorage', 'sessionStorage']) {
  test('inaccessible ' + area + ' keeps a usable recovery form', async ({ browser }, info) => {
    test.skip(info.project.name === 'iphone-no-javascript', 'Storage failure requires scripts');
    const { context, page } = await setup(browser);
    await context.addInitScript(area => { Object.defineProperty(window, area, { get() { throw new DOMException('Blocked', 'SecurityError'); } }); }, area);
    try {
      await page.goto(OLD + 'letters.html#letter-form');
      await expect(page.locator('#recovery-status')).toContainText('storage is unavailable');
      await expect(page.locator('.cutover-link')).toBeVisible();
      await expect(page.locator('form')).toHaveCount(0);
      await expect(page).toHaveURL(OLD + 'letters.html#letter-form');
    } finally { await context.close(); }
  });
}
test('explicit recovery and current new-site recovery link stay on old origin', async ({ browser }, info) => {
  test.skip(info.project.name === 'iphone-no-javascript', 'No-script fallback tested separately');
  const { context, page } = await setup(browser);
  try {
    await page.goto(OLD + 'letters.html?recover=draft#letter-form');
    await expect(page.locator('.cutover-link')).toBeVisible();
    await expect(page).toHaveURL(OLD + 'letters.html?recover=draft#letter-form');
    await page.goto(NEW);
    await page.getByRole('link', { name: 'Recover old draft' }).click();
    await expect(page.locator('#letter-form')).toBeVisible();
    await expect(page).toHaveURL(OLD + 'letters.html');
  } finally { await context.close(); }
});
for (const relative of ['letters.html', 'sent.html']) {
  test('pending letter return retains old Copy and Clear controls: ' + relative, async ({ browser }, info) => {
    test.skip(info.project.name === 'iphone-no-javascript', 'Session return requires scripts');
    const { context, page } = await setup(browser);
    await context.addInitScript(origin => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied = text; } } });
      if (location.origin !== origin || sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', 'yes');
      sessionStorage.setItem('kr-sent-kind', JSON.stringify({ kind: 'letter', at: Date.now() }));
      sessionStorage.setItem('kr-sent-letter', JSON.stringify({ text: 'Fictional pending letter, not a receipt.', at: Date.now() }));
      localStorage.setItem('kr-letter-draft', JSON.stringify({ v: 1, text: 'Fictional pending letter, not a receipt.', saved: Date.now(), pending: true }));
    }, new URL(OLD).origin);
    try {
      await page.goto(OLD + relative);
      await expect(page).toHaveURL(OLD + relative);
      await expect(page.getByRole('button', { name: /Copy saved words/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Clear saved words/ })).toBeVisible();
      await page.getByRole('button', { name: /Copy saved words/ }).click();
      await expect.poll(() => page.evaluate(() => window.__copied)).toBe('Fictional pending letter, not a receipt.');
      await page.getByRole('button', { name: /Clear saved words/ }).click();
      expect(await page.evaluate(() => localStorage.getItem('kr-letter-draft'))).toBeNull();
      expect(await page.evaluate(() => sessionStorage.getItem('kr-sent-letter'))).toBeNull();
      await page.reload();
      await expect(page).toHaveURL(NEW + relative);
    } finally { await context.close(); }
  });
}
for (const value of ['{broken', JSON.stringify({ v: 1, text: 'Expired fictional draft', saved: 1 }), JSON.stringify({ v: 2, text: 'Unknown draft', saved: Date.now() })]) {
  test('invalid or expired data does not permanently hold an ordinary arrival: ' + value.slice(0, 20), async ({ browser }, info) => {
    test.skip(info.project.name === 'iphone-no-javascript', 'Storage gate requires scripts');
    const { context, page } = await setup(browser);
    await context.addInitScript(value => localStorage.setItem('kr-letter-draft', value), value);
    try { await page.goto(OLD + 'letters.html'); await expect(page).toHaveURL(NEW + 'letters.html'); }
    finally { await context.close(); }
  });
}
test('different draft and pending copies stay separate, copy failure is recoverable', async ({ browser }, info) => {
 test.skip(info.project.name === 'iphone-no-javascript', 'Storage recovery requires JavaScript');
 const { context, page, forbidden } = await setup(browser);
 await context.addInitScript(origin => {
  if (location.origin !== origin || sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded','yes');
  localStorage.setItem('kr-letter-draft', JSON.stringify({v:1,text:'Fictional draft version',name:'Example',saved:Date.now()}));
  sessionStorage.setItem('kr-sent-letter',JSON.stringify({text:'Different fictional pending version',at:Date.now()}));
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('Unavailable');}}});
 },new URL(OLD).origin);
 try {
  await page.goto(OLD+'letters.html?recover=draft#letter-form');
  await expect(page.locator('#recovered-0')).toHaveValue('Fictional draft version');
  await expect(page.locator('#recovered-1')).toHaveValue('Different fictional pending version');
  await page.getByRole('button',{name:'Copy pending words'}).click();
  await expect(page.locator('#recovery-status')).toContainText('selected');
  await expect(page.locator('#recovered-1')).toBeFocused();
  await page.getByRole('link',{name:'Continue on the current website'}).click();
  await page.goBack();
  await expect(page.locator('#recovered-1')).toHaveValue('Different fictional pending version');
  await page.getByRole('button',{name:'Clear saved words'}).click();
  await expect(page.locator('textarea')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('textarea')).toHaveCount(0);
  expect(forbidden).toEqual([]);
 } finally { await context.close(); }
});
test('partial storage clear failure remains honest and keeps recoverable words', async ({ browser }, info) => {
 test.skip(info.project.name === 'iphone-no-javascript', 'Storage recovery requires JavaScript');
 const {context,page}=await setup(browser,{viewport:{width:320,height:568}});
 await context.addInitScript(origin=>{
  if(location.origin!==origin)return;
  localStorage.setItem('kr-letter-draft',JSON.stringify({v:1,text:'Fictional retained words',saved:Date.now()}));
  sessionStorage.setItem('kr-sent-letter',JSON.stringify({text:'Different pending words',at:Date.now()}));
  const original=Storage.prototype.removeItem;
  Storage.prototype.removeItem=function(key){if(this===localStorage && key==='kr-letter-draft')throw new DOMException('Blocked','SecurityError');return original.call(this,key);};
 },new URL(OLD).origin);
 try {
  await page.goto(OLD+'letters.html?recover=draft');
  await page.getByRole('button',{name:'Clear saved words'}).click();
  await expect(page.locator('#recovery-status')).toContainText('could not be cleared');
  await expect(page.locator('#recovery-status')).toBeFocused();
  await expect(page.locator('#recovery-status')).toBeInViewport();
  await expect(page.locator('#recovered-0')).toHaveValue('Fictional retained words');
 }finally{await context.close();}
});
for(const relative of ['evidence.html?search=schools#source-search','feedback.html?kind=privacy#feedback-form','videos.html#upload','index.html#records']) {
 test('failed redirect script has a useful manual destination: '+relative,async({browser})=>{
  const {context,page}=await setup(browser,{javaScriptEnabled:false});
  try{
   await page.goto(OLD+relative);
   await expect(page.locator('.cutover-link')).toBeVisible();
   await expect(page.locator('.cutover-link')).toHaveAttribute('href',NEW+relative.split(/[?#]/)[0].replace('index.html',''));
   await expect(page.locator('form')).toHaveCount(0);
  }finally{await context.close();}
 });
}
for (const kind of ['suggestion','correction','contact']) {
 test('non-letter pending return keeps its canonical next-steps destination: '+kind,async({browser},info)=>{
  test.skip(info.project.name==='iphone-no-javascript','Session state requires scripts');
  const {context,page}=await setup(browser);
  await context.addInitScript(({origin,kind})=>{
   if(location.origin===origin)sessionStorage.setItem('kr-sent-kind',JSON.stringify({kind,at:Date.now()}));
  },{origin:new URL(OLD).origin,kind});
  try {await page.goto(OLD+'sent.html');await expect(page).toHaveURL(NEW+'sent.html');}
  finally {await context.close();}
 });
}
test('no JavaScript retains useful old page and manual new-address link', async ({ browser }) => {
  const { context, page, forbidden } = await setup(browser, { javaScriptEnabled: false, viewport: { width: 320, height: 568 } });
  try {
    await page.goto(OLD + 'letters.html?recover=draft#letter-form');
    await expect(page.locator('.cutover-link')).toBeVisible();
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('#storage-help')).toBeVisible();
    await expect(page.locator('#storage-help')).toContainText('JavaScript is required');
    await page.locator('.cutover-link').click();
    await expect(page).toHaveURL(NEW + 'letters.html');
    expect(forbidden).toEqual([]);
  } finally { await context.close(); }
});
for (const url of [NEW + 'letters.html', 'https://ystoneman.github.io/another-project/letters.html', 'https://ystoneman.github.io/kew-riverside-website-extra/letters.html']) {
  test('script has no effect outside exact old project: ' + url, async ({ browser }) => {
    const { context, page } = await setup(browser);
    await context.route('**/*', route => {
      const name = new URL(route.request().url()).pathname.split('/').pop() || 'index.html';
      const file = path.join(artifact, name);
      return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.existsSync(file) ? fs.readFileSync(file) : '' });
    });
    try {
      await page.goto(url);
      await expect(page.locator('#letter-form')).toBeVisible();
      await expect(page).toHaveURL(url);
    } finally { await context.close(); }
  });
}
for (const width of [320, 390, 1440]) {
  test('recovery notice and form fit viewport ' + width, async ({ browser }) => {
    const { context, page, forbidden } = await setup(browser, { viewport: { width, height: 900 } });
    try {
      await page.goto(OLD + 'letters.html?recover=draft#letter-form');
      await expect(page.locator('.cutover-link')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('#letter-form')).toBeVisible();
      expect(forbidden).toEqual([]);
    } finally { await context.close(); }
  });
}

});
}
