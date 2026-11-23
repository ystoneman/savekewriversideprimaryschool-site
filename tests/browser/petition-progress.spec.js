const { test, expect } = require('./fixtures');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const origin='https://savekewriversideprimaryschool.org';
const endpoint='https://kew-riverside-statistics.analytics-backend.workers.dev/petition';
const source='https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249';
const checkedAt='2026-10-18T14:49:00Z';
async function production(page, context, value, options={}) {
  const reads=[];
  await context.route(origin+'/**', async route=>{
    const url=new URL(route.request().url());const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
    expect(name).toMatch(/^(?:images\/|fonts\/)?[a-z0-9][a-z0-9._-]*$/i);
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(name)];
    if(name==='analytics-config.json')return route.fulfill({json:{enabled:false,counterEnabled:false}});
    await route.fulfill({contentType:mime,body:readFileSync(path.join(__dirname,'../..',name))});
  });
  await context.route(endpoint,async route=>{
    reads.push(route.request());
    if(options.wait)await options.wait;
    await route.fulfill({status:options.status||200,json:value,headers:{'X-Test-Fixture':'intentional-error','Access-Control-Allow-Origin':origin}});
  });
  await page.clock.setFixedTime(new Date('2026-10-18T14:50:00Z'));
  await page.goto(origin+'/');return reads;
}
const record='529 signatures in total, including 223 on paper. Council petition page, 23 November 2026, 13:12 GMT.';
async function combinedUntouched(page){
 // The dated combined council total is never recalculated, relabelled or hidden by an online-only result.
 await expect(page.locator('#petition-combined')).toHaveText('529');
 await expect(page.locator('.petition-total-record')).toBeVisible();
 await expect(page.locator('.petition-total-record')).toHaveText(record);
 await expect(page.locator('.petition-total-record time')).toHaveAttribute('datetime','2026-11-23T13:12:00Z');
 await expect(page.locator('#petition-milestone')).toHaveText('With paper signatures included, the petition has passed the committee’s 500-signature threshold.');
}
for(const count of [0,193,1200])test(`Petition tracker: a fresh online-only result of ${count} stays secondary and dated`,async({page,context})=>{
 const reads=await production(page,context,{onlineSignatures:count,checkedAt,source});
 await expect(page.locator('#petition-total')).toHaveText(count.toLocaleString('en-GB'));
 await expect(page.locator('#petition-online')).toHaveText(`Online signatures only, council page checked 18 October 2026, 15:49 BST: ${count.toLocaleString('en-GB')} (paper signatures not included).`);
 await expect(page.locator('#petition-checked')).toHaveAttribute('datetime',checkedAt);
 await combinedUntouched(page);
 expect(reads).toHaveLength(1);expect(reads[0].method()).toBe('GET');
 const headers=reads[0].headers();expect(headers.cookie).toBeUndefined();expect(headers.referer).toBeUndefined();
});
test('Petition tracker: a delayed successful response updates only the online line',async({page,context})=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 await production(page,context,{onlineSignatures:310,checkedAt,source},{wait});
 await combinedUntouched(page);await expect(page.locator('#petition-total')).toHaveText('306');
 release();await expect(page.locator('#petition-total')).toHaveText('310');
 await expect(page.locator('#petition-calculation')).toHaveText(' (paper signatures not included)');
 await combinedUntouched(page);
});
for(const [label,value,status] of [['outage',{unavailable:true},503],['stale',{onlineSignatures:999,checkedAt:'2026-10-16T14:00:00Z',source},200],['future',{onlineSignatures:999,checkedAt:'2027-10-18T14:00:00Z',source},200],['wrong source',{onlineSignatures:999,checkedAt,source:'https://other.invalid'},200],['private fields',{onlineSignatures:999,checkedAt,source,names:['fictional']},200],['invalid count',{onlineSignatures:-1,checkedAt,source},200]])test(`Petition tracker: ${label} preserves the dated source snapshot`,async({page,context})=>{
 await production(page,context,value,{status});
 await expect(page.locator('#petition-online')).toHaveText('Online signatures only, in that snapshot: 306 (529 total minus 223 on paper).');
 await expect(page.locator('#petition-checked')).toHaveCount(0);
 await combinedUntouched(page);
 await expect(page.locator('#petition-progress .petition-source a')).toHaveAttribute('href',source);
});
test.describe('Petition tracker without JavaScript',()=>{
 test.use({javaScriptEnabled:false});
 test('retains the dated combined total, online detail and official links',async({page})=>{
 await page.goto('/');await combinedUntouched(page);
 await expect(page.locator('#petition-total')).toHaveText('306');
 await expect(page.locator('#petition-national a')).toHaveAttribute('href','https://petition.parliament.uk/petitions/787773/moderation-info');
 await expect(page.locator('#petition-progress .petition-source a')).toHaveAttribute('href',source);
 });
});
test('Petition tracker: visible through London 13 January, hidden from 14 January, and a late response is ignored',async({page,context})=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 await production(page,context,{onlineSignatures:500,checkedAt,source},{wait});
 await page.clock.setFixedTime(new Date('2027-01-13T23:59:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 await expect(page.locator('#petition-progress')).toBeVisible();await expect(page.locator('#petition-action')).toHaveText('Sign the petition');
 await page.clock.setFixedTime(new Date('2027-01-14T00:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 await expect(page.locator('#petition-progress')).toBeHidden();await expect(page.locator('#petition-national')).toBeHidden();release();
 await expect(page.locator('#petition-total')).toHaveText('306');await expect(page.locator('#petition-action')).toHaveText('View the petition');
});
for(const type of ['pointerdown','keydown'])test(`Petition tracker: a delayed response after ${type} leaves the pressed layout still`,async({page,context})=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 await production(page,context,{onlineSignatures:1000,checkedAt,source},{wait});
 const before=await page.locator('#share-trigger').boundingBox();
 await page.locator('#share-trigger').dispatchEvent(type);release();
 await page.waitForResponse(endpoint);
 await expect(page.locator('#petition-total')).toHaveText('306');
 expect(await page.locator('#share-trigger').boundingBox()).toEqual(before);
});
for(const width of [320,390,1440])test(`Petition tracker: ${width}px keeps actions ahead of the combined total card`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:1000});await page.goto('/');
 const action=await page.locator('#petition-action').boundingBox();const note=await page.locator('#petition-note').boundingBox();const tracker=await page.locator('#petition-progress').boundingBox();
 expect(tracker.y).toBeGreaterThanOrEqual(note.y+note.height);expect(tracker.y).toBeGreaterThan(action.y+action.height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.locator('#petition-progress')).toHaveAccessibleName('Council petition signatures');
 await page.emulateMedia({colorScheme:'dark'});await page.locator('#petition-progress').scrollIntoViewIfNeeded();
 await expect(page.locator('#petition-combined')).toBeVisible();
 await expect(page.locator('#petition-national a')).toBeVisible();await expect(page.locator('#petition-progress .petition-source a')).toBeVisible();
});
