const {test,expect}=require('./fixtures');
const canonical='https://savekewriversideprimaryschool.org/';
const official='https://docs.google.com/forms/d/e/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ/viewform';
const council='https://www.richmond.gov.uk/services/children_and_family_care/schools_and_colleges/school_organisation_consultations/kew_riverside_consultation';
async function shareSetup(page,mode){
 await page.addInitScript(mode=>{
  window.shareCalls=[];window.copyCalls=[];
  Object.defineProperty(navigator,'share',{configurable:true,value:mode==='clipboard'||mode==='manual'?undefined:async data=>{
   window.shareCalls.push(data);
   if(mode==='cancel')throw new DOMException('Cancelled','AbortError');
   if(mode==='error')throw new DOMException('Unavailable','NotAllowedError');
   if(mode==='pending')await new Promise(resolve=>window.finishShare=resolve);
  }});
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copyCalls.push(text);if(mode==='manual')throw new Error('Unavailable');}}});
 },mode);await page.goto('/index.html');
}
for(const mode of ['native','cancel','error','clipboard','manual'])test(`Homepage Share: ${mode} keeps the canonical link and usable recovery`,{tag:mode==='native'?'@home-smoke':[]},async({page})=>{
 await shareSetup(page,mode);await page.locator('#share-trigger').click();
 await expect(page.locator('#share-trigger')).toBeEnabled();
 if(['native','cancel','error'].includes(mode))expect(await page.evaluate(()=>window.shareCalls)).toEqual([{title:'Help keep Kew Riverside Primary School open',text:'Help keep Kew Riverside Primary School open.',url:canonical}]);
 if(mode==='clipboard'){expect(await page.evaluate(()=>window.copyCalls)).toEqual([canonical]);await expect(page.locator('#share-status')).toHaveText('Campaign link copied.');}
 if(['error','manual'].includes(mode)){
  await expect(page.locator('#share-fallback')).toHaveAttribute('open','');await expect(page.getByLabel('Campaign link')).toBeFocused();
  expect(await page.getByLabel('Campaign link').evaluate(el=>el.selectionEnd-el.selectionStart)).toBe(canonical.length);
  await page.keyboard.press('Escape');await expect(page.locator('#share-trigger')).toBeFocused();await expect(page.locator('#share-fallback')).toBeHidden();
 }else{await expect(page.locator('#share-fallback')).toBeHidden();await expect(page.locator('#share-trigger')).toBeFocused();}
 if(mode==='cancel')expect(await page.evaluate(()=>window.copyCalls)).toEqual([]);
});
test('Homepage Share: a pending sheet cannot be launched twice',async({page})=>{
 await shareSetup(page,'pending');await page.locator('#share-trigger').click();await expect(page.locator('#share-trigger')).toBeDisabled();
 // A second event while the platform sheet remains pending must be ignored.
 await page.locator('#share-trigger').evaluate(el=>el.dispatchEvent(new Event('click')));
 expect(await page.evaluate(()=>window.shareCalls.length)).toBe(1);
 await page.evaluate(()=>window.finishShare());await expect(page.locator('#share-trigger')).toBeEnabled();
});
// Since 13 October 2026 the homepage Menu matches every other page; the former
// task chooser opens it, and each former task has its current page route there.
test('Homepage: old task chooser links open the shared Menu with each former task route',{tag:'@home-smoke'},async({page})=>{
 for(const id of ['find-your-way','find-title']){
  await page.goto('/index.html#'+id);await expect(page).toHaveURL(/#menu$/);await expect(page.locator('#menu')).toHaveAttribute('open','');
  for(const href of ['faq.html','options.html','proposal.html','proposal.html#council-documents','understand.html#supporting-research','evidence.html#records','feedback.html'])await expect(page.locator(`#menu a[href="${href}"]`)).toHaveCount(1);
  await page.keyboard.press('Escape');await expect(page.locator('#menu')).not.toHaveAttribute('open','');
 }
});
test('Homepage: shared press and manual-copy links reveal their content',async({page})=>{
 await page.goto('/index.html#press');await expect(page.locator('#press')).toHaveAttribute('open','');await expect(page.locator('#press')).toContainText('savekrps@gmail.com');
 await page.goto('/index.html#share');await expect(page.locator('#share-fallback')).toHaveAttribute('open','');await expect(page.getByLabel('Campaign link')).toHaveValue(canonical);
});
for(const [at,href,name] of [['2026-10-16T22:59:59Z',official,'Respond to the council'],['2026-10-16T23:00:00Z',council,'Check the council consultation'],['2027-09-01T12:00:00Z',council,'Check the council consultation']])test(`Homepage deadline: London stage at ${at}`,async({page})=>{
 await page.clock.setFixedTime(new Date(at));await page.goto('/index.html');await expect(page.locator('#main-action')).toHaveAttribute('href',href);await expect(page.locator('#main-action')).toHaveAccessibleName(name);
 if(href===council){await expect(page.locator('#action-note')).toContainText('deadline has passed');await expect(page.locator('.intro')).toContainText('On 12 October 2026');await expect(page.locator('.intro')).toContainText('Check the council’s latest position.');}
});
test('Homepage deadline: a page left open refreshes before an expired response click',{tag:'@home-smoke'},async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-16T22:59:59Z'));await page.goto('/index.html');await expect(page.locator('#main-action')).toHaveAttribute('href',official);
 await page.clock.setFixedTime(new Date('2026-10-16T23:00:00Z'));
 await page.route(council,route=>route.fulfill({contentType:'text/html',body:'<h1>Fictional current council information</h1>'}));
 await page.locator('#main-action').click();await expect(page).toHaveURL(council);await expect(page.getByRole('heading')).toHaveText('Fictional current council information');
});
for(const [at,label] of [['2026-10-12T12:00:00Z','4 days left'],['2026-10-14T23:00:00Z','1 day left'],['2026-10-15T23:00:00Z','Closes today']])test(`Homepage countdown: London date at ${at}`,async({page})=>{
 await page.clock.setFixedTime(new Date(at));await page.goto('/index.html');
 await expect(page.locator('#action-note')).toHaveText(`${label} · Respond by 16 October 2026.`);
 await expect(page.locator('#main-action')).toHaveAttribute('href',official);
});
test('Homepage countdown: visible timer refreshes through midnight and expiry',{tag:'@home-smoke'},async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T22:59:30Z')});await page.goto('/index.html');
 await expect(page.locator('#action-note')).toContainText('2 days left');await page.clock.runFor(60000);
 await expect(page.locator('#action-note')).toContainText('1 day left');
 await page.clock.setSystemTime(new Date('2026-10-16T22:59:30Z'));await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 await expect(page.locator('#action-note')).toContainText('Closes today');await page.clock.runFor(60000);
 await expect(page.locator('#main-action')).toHaveAttribute('href',council);await expect(page.locator('#action-note')).toContainText('deadline has passed');
 await expect(page.locator('#action-note')).not.toContainText('days left');
});
test('Homepage countdown: return refreshes the active count without changing the response destination',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-12T22:59:59Z'));await page.goto('/index.html');
 await expect(page.locator('#action-note')).toContainText('4 days left');
 await page.clock.setFixedTime(new Date('2026-10-12T23:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 await expect(page.locator('#action-note')).toContainText('3 days left');await expect(page.locator('#main-action')).toHaveAttribute('href',official);
});

const petition='https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249';
for(const width of [320,390,1440])test(`Homepage petition: ${width}px keeps the response and Help alongside a working petition action`,async({page,hasTouch})=>{
 await page.setViewportSize({width,height:width===320?568:844});await page.goto('/index.html');
 const link=page.locator('#petition-action');await expect(link).toHaveAccessibleName('Sign the petition');await expect(link).toHaveAttribute('href',petition);
 const bounds=await link.boundingBox(),help=await page.locator('.home-plan').boundingBox();expect(bounds.height).toBeGreaterThanOrEqual(44);expect(help.y).toBe(bounds.y);
 await expect(page.locator('#main-action')).toBeInViewport({ratio:1});
 await expect(page.locator('#petition-note')).toContainText('Signing does not replace your consultation response.');
 await page.route(petition,r=>r.fulfill({contentType:'text/html',body:'<h1>Fictional petition destination</h1>'}));
 if(hasTouch)await link.tap();else{await link.focus();await page.keyboard.press('Enter');}
 await expect(page).toHaveURL(petition);await page.goBack();await expect(link).toBeVisible();
});
for(const [at,label] of [['2026-10-17T12:00:00Z','Sign the petition'],['2027-01-13T23:59:59Z','Sign the petition'],['2027-01-14T00:00:00Z','View the petition']])test(`Homepage petition: independent deadline at ${at}`,async({page})=>{
 await page.clock.setFixedTime(new Date(at));await page.goto('/index.html');await expect(page.locator('#petition-action')).toHaveAccessibleName(label);await expect(page.locator('#petition-action')).toHaveAttribute('href',petition);
});

for (const scripts of [true, false]) test.describe(`Homepage menu sizing, scripts ${scripts}`, () => {
 test.use({ javaScriptEnabled: scripts });
 test('Homepage: menu links fit without sideways scrolling', {tag:'@home-smoke'}, async ({page}) => {
  for (const width of [320, 390, 700, 820, 1440]) {
   await page.setViewportSize({width, height:width === 320 ? 568 : 844});
   await page.goto('/index.html');
   await page.locator('#menu > summary').click();
   const menu = page.locator('#menu nav');
   expect(await menu.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
   for (const link of await menu.locator('a').all()) {
    await link.scrollIntoViewIfNeeded();
    const bounds = await link.boundingBox();
    const panel = await menu.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(panel.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(panel.x + panel.width + 1);
    await expect(link).toBeInViewport({ratio:0.99});
   }
   await menu.locator('a[href="about.html"]').click();
   await expect(page).toHaveURL(/about\.html$/);
  }
 });
});
