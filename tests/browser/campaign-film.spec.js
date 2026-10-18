const {test,expect}=require('./fixtures');
const media='/media/kew-petition-film-ram-20261014.mp4?v=2026101803';
const portrait='/media/kew-petition-film-ram-4x5-20261014.mp4?v=2026101803';
const mediaRoute='**/media/kew-petition-film-ram-*.mp4*';
const selectedMedia=page=>page.viewportSize().width<=700?portrait:media;
const petition='https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249';

test('Campaign video: petition below the player and optional transcript preserve homepage actions',{tag:'@home-smoke'},async({page})=>{
 const requests=[];page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('.mp4'))requests.push(r.url());});
 await page.goto('/index.html');
 const before=await page.locator('.home-plan').boundingBox();
 expect(await page.locator('#campaign-film').evaluate(el=>el.previousElementSibling.classList.contains('hero-grid'))).toBe(true);
 await expect(page.locator('main a[href="'+petition+'"]')).toHaveCount(3);
 await expect(page.locator('#petition-action, #film-petition-action')).toHaveCount(2);
 await expect(page.locator('#petition-progress a')).toHaveAttribute('href',petition);
 await expect(page.locator('#petition-note')).toContainText('13 January 2027');
 await expect(page.locator('#petition-note')).toContainText('live, work or study');
 await expect(page.locator('#petition-note')).toContainText('Richmond Account');
 await expect(page.locator('#film-heading')).toHaveText('Campaign video');
 await expect(page.locator('#film-petition-action')).toHaveAttribute('href',petition);
 expect(await page.locator('#film-petition-action').evaluate(el=>el.closest('.film-petition').previousElementSibling.tagName)).toBe('FIGURE');
 await expect(page.locator('#film-transcript')).not.toHaveAttribute('open');
 await expect(page.locator('#film-transcript > summary')).toHaveText('Transcript');
 await expect(page.locator('.film-download:visible')).toHaveCount(0);
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
 expect(await video.evaluate(v=>[v.videoWidth,v.videoHeight])).toEqual(page.viewportSize().width<=700?[1080,1350]:[1920,1080]);
 await video.evaluate(v=>v.pause());expect(await video.evaluate(v=>v.paused)).toBe(true);
 await video.evaluate(v=>{v.currentTime=60;});
 await expect.poll(()=>video.evaluate(v=>!v.seeking && v.readyState>=2)).toBe(true);
 expect(await video.evaluate(v=>v.currentTime)).toBeCloseTo(60,0);
 expect(await video.evaluate(v=>v.error)).toBeNull();
 expect(errors).toEqual([]);
});

test('Campaign film: a media error offers retry and direct-file recovery',async({page})=>{
 await page.route(mediaRoute,r=>r.fulfill({contentType:'video/mp4',body:'Invalid video bytes for recovery test'}));
 await page.goto('/index.html#campaign-film');await page.locator('#film-play').click();
 await expect(page.locator('#film-status')).toContainText('Playback could not start');
 await expect(page.locator('#film-play')).toBeFocused();
 await expect(page.locator('.film-download:visible')).toHaveAttribute('href',selectedMedia(page).slice(1));
});

test('Campaign film: a failed script preserves a dated fallback and transcript',async({page})=>{
 await page.route('**/campaign-film.js*',r=>r.fulfill({contentType:'text/javascript',body:'/* Film script unavailable in this test. */'}));
 await page.goto('/index.html#campaign-film');
 await expect(page.locator('.film-player .film-poster:visible')).toHaveAttribute('href',selectedMedia(page).slice(1));
 await expect(page.locator('#film-context')).toContainText('14 October 2026');
 await page.locator('#film-transcript > summary').click();await expect(page.locator('#film-transcript')).toContainText('Please share this film.');
});

test('Campaign film: Retry recovers after the first media response fails',async({page})=>{
 let requests=0;
 await page.route(mediaRoute,r=>++requests===1?r.fulfill({contentType:'video/mp4',body:'Invalid first response'}):r.continue());
 await page.goto('/index.html#campaign-film');await page.locator('#film-play').click();
 await expect(page.locator('#film-status')).toContainText('Playback could not start');
 await page.locator('#film-play').click();
 await expect.poll(()=>page.locator('#campaign-film-video').evaluate(v=>v.currentTime),{timeout:15000}).toBeGreaterThan(.2);
 await expect(page.locator('#film-status')).toBeHidden();
 await expect(page.locator('.film-download:visible')).toHaveCount(0);
 expect(requests).toBeGreaterThan(1);
});

test.describe('Campaign film without JavaScript',()=>{
 test.use({javaScriptEnabled:false});
 test('Dated native-link fallback and transcript remain usable',async({page})=>{
  await page.goto('/index.html#campaign-film');await expect(page.locator('.film-player .film-poster:visible')).toHaveAttribute('href',selectedMedia(page).slice(1));
  await expect(page.locator('#film-context')).toContainText('14 October 2026');
  await expect(page.locator('#petition-note')).toContainText('13 January 2027');
  await expect(page.locator('main a[href="'+petition+'"]')).toHaveCount(3);
 await expect(page.locator('#petition-action, #film-petition-action')).toHaveCount(2);
 await expect(page.locator('#petition-progress a')).toHaveAttribute('href',petition);
  await expect(page.locator('#film-petition-action')).toHaveText('View or sign the petition');
  await page.locator('#film-share-fallback > summary').click();
  await expect(page.locator('#film-share-url')).toHaveValue('https://savekewriversideprimaryschool.org/#campaign-film');
  await expect(page.locator('#film-share-fallback a[download]')).toHaveCount(2);
  await expect(page.locator('#film-youtube')).toHaveAttribute('href','https://youtu.be/VvHGIg5Fcvk');
  await expect(page.locator('.film-download:visible')).toHaveCount(0);
  await page.locator('#film-transcript > summary').click();await expect(page.locator('#film-transcript')).toContainText('Please share this film.');
 });
});

for(const [at,closed,consultation] of [
 ['2026-10-16T22:59:59Z',false,true],['2026-10-16T23:00:00Z',false,false],
 ['2027-01-13T23:59:59Z',false,false],['2027-01-14T00:00:00Z',true,false],
])test(`Campaign film: London-date invitation at ${at}`,async({page})=>{
 await page.clock.setFixedTime(new Date(at));await page.goto('/index.html#campaign-film');
 await expect(page.locator('#petition-action')).toHaveText(closed?'View the petition':'Sign the petition');
 await expect(page.locator('#film-petition-action')).toHaveText(closed?'View the petition':'Sign the petition');
 expect(await page.locator('#film-petition-note').textContent()).toBe(await page.locator('#petition-note').textContent());
 if(closed){await expect(page.locator('.film-player')).toBeHidden();await expect(page.locator('#film-status')).toContainText('deadline');await expect(page.locator('#film-download')).toBeHidden();await expect(page.locator('#film-portrait-download')).toBeHidden();await expect(page.locator('.film-sharing')).toBeHidden();}
 else{await expect(page.locator('#film-play')).toBeVisible();if(consultation)await expect(page.locator('#petition-note')).toContainText('does not replace');else await expect(page.locator('#petition-note')).not.toContainText('consultation response');}
});

test('Campaign film: returning after expiry removes the old player without downloading it',async({page})=>{
 await page.clock.setFixedTime(new Date('2027-01-13T23:59:59Z'));await page.goto('/index.html#campaign-film');
 await page.clock.setFixedTime(new Date('2027-01-14T00:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 await expect(page.locator('.film-player')).toBeHidden();await expect(page.locator('#petition-action')).toHaveText('View the petition');
 await expect(page.locator('.film-sharing')).toBeHidden();
});

test('Campaign film: petition handoff and Back preserve the optional section',async({page})=>{
 await page.route(petition,r=>r.fulfill({contentType:'text/html',body:'<h1>Fictional petition</h1>'}));
 await page.goto('/index.html#campaign-film');await page.locator('#film-petition-action').focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(petition);
 await page.goBack();await expect(page).toHaveURL(/#campaign-film$/);await expect(page.locator('#film-play')).toBeVisible();
});

for(const width of [320,390,700,701,1440])test(`Campaign film: ${width}px chooses a matching poster, frame and single MP4`,async({page})=>{
 const requested=[];page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('.mp4'))requested.push(new URL(r.url()).pathname+new URL(r.url()).search);});
 await page.setViewportSize({width,height:844});await page.goto('/index.html#campaign-film');
 const expected=selectedMedia(page);const ratio=width<=700?4/5:16/9;
 await expect(page.locator('.film-download:visible')).toHaveCount(0);
 const poster=page.locator('#film-play img');await poster.evaluate(img=>img.decode());
 expect(await poster.evaluate(img=>img.naturalWidth/img.naturalHeight)).toBeCloseTo(ratio,2);
 expect(requested).toEqual([]);
 await page.locator('#film-play').click();const video=page.locator('#campaign-film-video');
 await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:15000}).toBeGreaterThan(.1);
 await expect(video).toHaveAttribute('src',expected.slice(1));
 const bounds=await page.locator('.film-player').boundingBox();expect(bounds.width/bounds.height).toBeCloseTo(ratio,2);
 expect([...new Set(requested)]).toEqual([expected]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const [start,end]of[[390,844],[1440,390]])test(`Campaign film: resizing ${start} to ${end}px preserves the selected cut and playback time`,async({page})=>{
 const requested=[];page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('.mp4'))requested.push(new URL(r.url()).pathname+new URL(r.url()).search);});
 await page.setViewportSize({width:start,height:844});await page.goto('/index.html#campaign-film');const expected=selectedMedia(page);
 await page.locator('#film-play').click();const video=page.locator('#campaign-film-video');await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:15000}).toBeGreaterThan(2);
 const before=await video.evaluate(v=>{window.rotationVideo=v;return v.currentTime;});
 await page.setViewportSize({width:end,height:390});
 expect(await video.evaluate(v=>v.currentTime)).toBeGreaterThanOrEqual(before);await expect(video).toHaveAttribute('src',expected.slice(1));
 expect(await video.evaluate(v=>v===window.rotationVideo)).toBe(true);
 const bounds=await page.locator('.film-player').boundingBox();expect(bounds.width/bounds.height).toBeCloseTo(start<=700?4/5:16/9,2);
 await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:10000}).toBeGreaterThan(before+.2);
 expect([...new Set(requested)]).toEqual([expected]);
});

test('Campaign film: Retry after resizing selects the current viewport cut',async({page})=>{
 let first=true;await page.route(mediaRoute,r=>{if(first){first=false;return r.fulfill({contentType:'video/mp4',body:'Invalid first response'});}return r.continue();});
 await page.setViewportSize({width:390,height:844});await page.goto('/index.html#campaign-film');await page.locator('#film-play').click();await expect(page.locator('#film-status')).toContainText('Playback could not start');
 await page.setViewportSize({width:1440,height:1000});await page.locator('#film-play').click();const video=page.locator('#campaign-film-video');await expect.poll(()=>video.evaluate(v=>v.currentTime),{timeout:15000}).toBeGreaterThan(.1);await expect(video).toHaveAttribute('src',media.slice(1));
});

for (const mode of ['native','cancelled','clipboard','manual']) test(`Campaign film sharing: ${mode} keeps the video link and recovery usable`,async({page})=>{
 await page.addInitScript(mode=>{
  window.videoShares=[];window.videoCopies=[];
  Object.defineProperty(navigator,'share',{configurable:true,value:mode==='native'||mode==='cancelled'?async data=>{window.videoShares.push(data);if(mode==='cancelled')throw new DOMException('Cancelled','AbortError');}:undefined});
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:mode==='manual'?undefined:{writeText:async text=>window.videoCopies.push(text)}});
 },mode);
 await page.goto('/index.html?utm_source=fictional#campaign-film');
 await page.locator('#film-share-trigger').click();
 const canonical='https://savekewriversideprimaryschool.org/#campaign-film';
 if(mode==='native'||mode==='cancelled'){
  expect(await page.evaluate(()=>window.videoShares)).toEqual([{title:'Keep Kew Riverside open — narrated by Ram',url:canonical}]);
  expect(await page.evaluate(()=>window.videoCopies)).toEqual([]);
  await expect(page.locator('#film-share-fallback')).not.toHaveAttribute('open');
 }else if(mode==='clipboard'){
  expect(await page.evaluate(()=>window.videoCopies)).toEqual([canonical]);
  await expect(page.locator('#film-share-status')).toHaveText('Video link copied.');
 }else{
  await expect(page.locator('#film-share-url')).toBeFocused();
  await expect(page.locator('#film-share-url')).toHaveValue(canonical);
  expect(await page.locator('#film-share-url').evaluate(el=>el.selectionEnd-el.selectionStart)).toBe(canonical.length);
 }
 await expect(page.locator('#film-share-trigger')).toBeEnabled();
 await expect(page.locator('#film-petition-action')).toHaveAttribute('href',petition);
});

test('Campaign film: an expired petition click keeps its target stable and updates both invitations',async({page})=>{
 await page.clock.setFixedTime(new Date('2027-01-13T23:59:59Z'));
 await page.goto('/index.html#campaign-film');
 const link=page.locator('#film-petition-action');await link.scrollIntoViewIfNeeded();
 const before=await link.boundingBox();
 await page.clock.setFixedTime(new Date('2027-01-14T00:00:00Z'));
 await link.dispatchEvent('pointerdown');
 expect(await link.boundingBox()).toEqual(before);
 await expect(link).toHaveText('Sign the petition');
 await page.route(petition,r=>r.fulfill({contentType:'text/html',body:'<h1>Fictional closed petition</h1>'}));
 await link.click();await expect(page).toHaveURL(petition);
 await page.goBack();await expect(link).toHaveText('View the petition');
 await expect(page.locator('#film-petition-note')).toContainText('closing date');
});

for(const route of ['share','download','youtube'])test(`Campaign film: a long-open ${route} action retires the dated video after midnight`,async({page})=>{
 await page.addInitScript(()=>{window.videoShares=[];Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.videoShares.push(data)});});
 await page.clock.setFixedTime(new Date('2027-01-13T23:59:59Z'));await page.goto('/index.html#campaign-film');
 if(route!=='share')await page.locator('#film-share-fallback > summary').click();
 await page.clock.setFixedTime(new Date('2027-01-14T00:00:00Z'));
 let downloads=0;page.on('download',()=>downloads++);
 await page.locator(route==='share'?'#film-share-trigger':route==='youtube'?'#film-youtube':'#film-share-fallback a[download]').first().click();
 await expect(page.locator('.film-sharing')).toBeHidden();
 await expect(page.locator('#film-status')).toContainText('deadline');
 expect(await page.evaluate(()=>window.videoShares)).toEqual([]);expect(downloads).toBe(0);
});
