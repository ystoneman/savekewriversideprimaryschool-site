const {test,expect}=require('./fixtures');
const media='/media/kew-petition-film-ram-20261014.mp4';
const petition='https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249';

test('Campaign film: optional placement keeps the hero intact and loads no video before Play',{tag:'@home-smoke'},async({page})=>{
 const requests=[];page.on('request',r=>{if(r.url().endsWith(media))requests.push(r.url());});
 await page.goto('/index.html');
 const before=await page.locator('.home-plan').boundingBox();
 expect(await page.locator('#campaign-film').evaluate(el=>el.previousElementSibling.classList.contains('hero-grid'))).toBe(true);
 await page.locator('#film-play').scrollIntoViewIfNeeded();
 await expect(page.locator('#film-play')).toBeVisible();
 await expect(page.locator('#campaign-film-video')).toHaveCount(0);
 expect(requests).toEqual([]);
 await page.locator('#film-transcript > summary').click();
 await expect(page.locator('#film-transcript')).toContainText('No final decision has been made.');
 await expect(page.locator('#film-transcript')).toContainText('View or sign');
 await page.evaluate(()=>window.scrollTo(0,0));
 expect((await page.locator('.home-plan').boundingBox()).y).toBe(before.y);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Campaign film: user playback advances, pauses and seeks with same-origin media',async({page,hasTouch})=>{
 const errors=[];page.on('console',m=>{if(m.type()==='error' && /Content Security Policy|Refused to/i.test(m.text()))errors.push(m.text());});
 await page.goto('/index.html#campaign-film');
 if(hasTouch)await page.locator('#film-play').tap();else{await page.locator('#film-play').focus();await page.keyboard.press('Enter');}
 const video=page.locator('#campaign-film-video');
 await expect(video).toBeVisible();
 await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:15000}).toBeGreaterThan(.2);
 expect(await video.evaluate(v=>({muted:v.muted,volume:v.volume,hasAudio:!!(v.webkitAudioDecodedByteCount || v.audioTracks?.length || v.mozHasAudio),controls:v.controls,inline:v.playsInline})) ).toMatchObject({muted:false,volume:1,controls:true,inline:true});
 expect(await video.evaluate(v=>v.duration)).toBeCloseTo(85.5,0);
 await video.evaluate(v=>v.pause());expect(await video.evaluate(v=>v.paused)).toBe(true);
 await video.evaluate(v=>{v.currentTime=60;});
 await expect.poll(()=>video.evaluate(v=>!v.seeking && v.readyState>=2)).toBe(true);
 expect(await video.evaluate(v=>v.currentTime)).toBeCloseTo(60,0);
 expect(await video.evaluate(v=>v.error)).toBeNull();
 expect(errors).toEqual([]);
});

test('Campaign film: a media error offers retry and direct-file recovery',async({page})=>{
 await page.route('**'+media,r=>r.fulfill({contentType:'video/mp4',body:'Invalid video bytes for recovery test'}));
 await page.goto('/index.html#campaign-film');await page.locator('#film-play').click();
 await expect(page.locator('#film-status')).toContainText('Playback could not start');
 await expect(page.locator('#film-play')).toBeFocused();
 await expect(page.locator('#film-download')).toBeVisible();
});

test('Campaign film: a failed script preserves a dated fallback and transcript',async({page})=>{
 await page.route('**/campaign-film.js*',r=>r.fulfill({contentType:'text/javascript',body:'/* Film script unavailable in this test. */'}));
 await page.goto('/index.html#campaign-film');
 await expect(page.locator('#film-poster-link')).toHaveAttribute('href',media.slice(1));
 await expect(page.locator('#film-context')).toContainText('14 October 2026');
 await page.locator('#film-transcript > summary').click();await expect(page.locator('#film-transcript')).toContainText('Please share this film.');
});

test('Campaign film: Retry recovers after the first media response fails',async({page})=>{
 let requests=0;
 await page.route('**'+media,r=>++requests===1?r.fulfill({contentType:'video/mp4',body:'Invalid first response'}):r.continue());
 await page.goto('/index.html#campaign-film');await page.locator('#film-play').click();
 await expect(page.locator('#film-status')).toContainText('Playback could not start');
 await page.locator('#film-play').click();
 await expect.poll(()=>page.locator('#campaign-film-video').evaluate(v=>v.currentTime),{timeout:15000}).toBeGreaterThan(.2);
 await expect(page.locator('#film-status')).toBeHidden();
 expect(requests).toBeGreaterThan(1);
});

test.describe('Campaign film without JavaScript',()=>{
 test.use({javaScriptEnabled:false});
 test('Dated native-link fallback and transcript remain usable',async({page})=>{
  await page.goto('/index.html#campaign-film');await expect(page.locator('#film-poster-link')).toBeVisible();
  await expect(page.locator('#film-context')).toContainText('13 January 2027');
  await expect(page.locator('#film-petition')).toHaveText('View the council petition');
  await page.locator('#film-transcript > summary').click();await expect(page.locator('#film-transcript')).toContainText('Please share this film.');
 });
});

for(const [at,closed,consultation] of [
 ['2026-10-16T22:59:59Z',false,true],['2026-10-16T23:00:00Z',false,false],
 ['2027-01-13T23:59:59Z',false,false],['2027-01-14T00:00:00Z',true,false],
])test(`Campaign film: London-date invitation at ${at}`,async({page})=>{
 await page.clock.setFixedTime(new Date(at));await page.goto('/index.html#campaign-film');
 await expect(page.locator('#film-petition')).toHaveText(closed?'View the petition':'Sign the petition');
 if(closed){await expect(page.locator('.film-player')).toBeHidden();await expect(page.locator('#film-status')).toContainText('deadline');await expect(page.locator('#film-download')).toBeHidden();}
 else{await expect(page.locator('#film-play')).toBeVisible();if(consultation)await expect(page.locator('#film-petition-note')).toContainText('does not replace');else await expect(page.locator('#film-petition-note')).not.toContainText('consultation response');}
});

test('Campaign film: returning after expiry removes the old player without downloading it',async({page})=>{
 await page.clock.setFixedTime(new Date('2027-01-13T23:59:59Z'));await page.goto('/index.html#campaign-film');
 await page.clock.setFixedTime(new Date('2027-01-14T00:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 await expect(page.locator('.film-player')).toBeHidden();await expect(page.locator('#film-petition')).toHaveText('View the petition');
});

test('Campaign film: petition handoff and Back preserve the optional section',async({page})=>{
 await page.route(petition,r=>r.fulfill({contentType:'text/html',body:'<h1>Fictional petition</h1>'}));
 await page.goto('/index.html#campaign-film');await page.locator('#film-petition').click();await expect(page).toHaveURL(petition);
 await page.goBack();await expect(page).toHaveURL(/#campaign-film$/);await expect(page.locator('#film-play')).toBeVisible();
});
