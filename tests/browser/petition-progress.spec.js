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
for(const [count,percent,remaining,milestone] of [[0,'0%','1,000 more','500 online signatures.'],[193,'19.3%','807 more','500 online signatures.'],[500,'50%','500 more','500 online signatures — reached.'],[1000,'100%','Campaign goal reached.','500 online signatures — reached.'],[1200,'120%','Campaign goal reached.','500 online signatures — reached.']])test(`Petition tracker: ${count} online signatures keeps campaign targets and math accurate`,async({page,context})=>{
 const reads=await production(page,context,{onlineSignatures:count,checkedAt,source});
 await expect(page.locator('#petition-total')).toHaveText(count.toLocaleString('en-GB'));
 await expect(page.locator('#petition-percent')).toHaveText(percent);
 await expect(page.locator('#petition-remaining')).toContainText(remaining);
 await expect(page.locator('#petition-milestone')).toContainText(milestone);
 await expect(page.locator('#petition-freshness')).toHaveText('Council count snapshot checked');
 await expect(page.locator('#petition-checked')).toHaveAttribute('datetime',checkedAt);
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext',`${count.toLocaleString('en-GB')} online signatures; campaign goal 1,000.`);
 expect(await page.locator('#petition-meter').evaluate(el=>el.value)).toBe(Math.min(count,1000));
 expect(reads).toHaveLength(1);expect(reads[0].method()).toBe('GET');
 const headers=reads[0].headers();expect(headers.cookie).toBeUndefined();expect(headers.referer).toBeUndefined();
});
for(const [label,value,status] of [['outage',{unavailable:true},503],['stale',{onlineSignatures:999,checkedAt:'2026-10-16T14:00:00Z',source},200],['future',{onlineSignatures:999,checkedAt:'2027-10-18T14:00:00Z',source},200],['wrong source',{onlineSignatures:999,checkedAt,source:'https://other.invalid'},200],['private fields',{onlineSignatures:999,checkedAt,source,names:['fictional']},200],['invalid count',{onlineSignatures:-1,checkedAt,source},200]])test(`Petition tracker: ${label} preserves the dated source snapshot`,async({page,context})=>{
 await production(page,context,value,{status});
 await expect(page.locator('#petition-total')).toHaveText('193');
 await expect(page.locator('#petition-freshness')).toHaveText('Council count snapshot checked');
 await expect(page.locator('#petition-checked')).toHaveText('18 October 2026, 15:48 BST');
 await expect(page.locator('#petition-progress a')).toHaveAttribute('href',source);
});
test.describe('Petition tracker without JavaScript',()=>{
 test.use({javaScriptEnabled:false});
 test('retains the dated aggregate and official source',async({page})=>{
 await page.goto('/');await expect(page.locator('#petition-total')).toHaveText('193');
 await expect(page.locator('#petition-freshness')).toHaveText('Council count snapshot checked');
 });
});
test('Petition tracker: London expiry hides targets on an open page and blocks a late response',async({page,context})=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 await production(page,context,{onlineSignatures:500,checkedAt,source},{wait});
 await expect(page.locator('#petition-progress')).toBeVisible();
 await page.clock.setFixedTime(new Date('2027-01-14T00:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 await expect(page.locator('#petition-progress')).toBeHidden();release();
 await expect(page.locator('#petition-total')).toHaveText('193');await expect(page.locator('#petition-action')).toHaveText('View the petition');
});
for(const type of ['pointerdown','keydown'])test(`Petition tracker: a delayed response after ${type} leaves the pressed layout still`,async({page,context})=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 await production(page,context,{onlineSignatures:1000,checkedAt,source},{wait});
 const before=await page.locator('#share-trigger').boundingBox();
 await page.locator('#share-trigger').dispatchEvent(type);release();
 await page.waitForResponse(endpoint);
 await expect(page.locator('#petition-total')).toHaveText('193');
 expect(await page.locator('#share-trigger').boundingBox()).toEqual(before);
});
for(const width of [320,390,1440])test(`Petition tracker: ${width}px keeps actions ahead of a readable native meter`,async({page})=>{
 await page.setViewportSize({width,height:width===320?568:1000});await page.goto('/');
 const action=await page.locator('#petition-action').boundingBox();const note=await page.locator('#petition-note').boundingBox();const tracker=await page.locator('#petition-progress').boundingBox();
 expect(tracker.y).toBeGreaterThanOrEqual(note.y+note.height);expect(tracker.y).toBeGreaterThan(action.y+action.height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.getByRole('progressbar')).toHaveAccessibleName('Online signatures towards the campaign goal of 1,000');
 await page.emulateMedia({colorScheme:'dark'});await page.locator('#petition-progress').scrollIntoViewIfNeeded();
 await expect(page.locator('#petition-progress a')).toBeVisible();
});
