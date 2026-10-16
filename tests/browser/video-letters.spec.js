const { test, expect } = require('./fixtures');
const row = { id: 'letter-012345abcdef', date: '2026-09-29', review: 'AI screened', displayName: 'Fictional parent', body: 'A fictional video letter about a school proposal.', youtubeId: 'AbC0123_-xy' };
async function board(page, rows = [row]) {
  await page.route('**/letters.json', route => route.fulfill({ json: { version: 1, letters: rows } }));
}

test('Video letter: Load video stands out with readable text in light and dark', async ({page}) => {
  await board(page);
  for (const scheme of ['light','dark']) {
    await page.emulateMedia({colorScheme:scheme});
    await page.goto('/letters.html#letters');
    const load=page.getByRole('button',{name:'Load video letter by Fictional parent'});
    await expect(load).toBeVisible();
    const measured=await load.evaluate(el=>{
      const parse=v=>(v.match(/[\d.]+/g)||[]).map(Number);
      const lum=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
      const style=getComputedStyle(el),background=parse(style.backgroundColor);
      let parent=el.parentElement;
      while(parent && parse(getComputedStyle(parent).backgroundColor)[3]===0) parent=parent.parentElement;
      return {text:contrast(parse(style.color),background),control:contrast(background,parse(getComputedStyle(parent).backgroundColor))};
    });
    expect(measured.text).toBeGreaterThanOrEqual(4.5);
    expect(measured.control).toBeGreaterThanOrEqual(3);
  }
});

test('Video letter: no Google request before activation; one removable player and truthful labels', async ({ page, hasTouch }) => {
  await board(page);
  const requests = [];
  await page.route('https://www.youtube-nocookie.com/**', route => {
    requests.push(route.request().url());
    return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Fictional player</title><button>Fictional play control</button>'});
  });
  await page.goto('/letters.html#letters');
  const card = page.locator('#' + row.id);
  await expect(card).toContainText('Video letter · AI screened · Opinion');
  await expect(card).toContainText('watchable here and shareable by link');
  await expect(card.getByRole('link', {name:'Watch on YouTube'})).toHaveAttribute('href','https://www.youtube.com/watch?v=AbC0123_-xy');
  await expect(page.locator('iframe')).toHaveCount(0); expect(requests).toEqual([]);
  await card.screenshot({path:test.info().outputPath('video-letter-before.png')});
  const load = card.getByRole('button', {name:'Load video letter by Fictional parent'});
  if (hasTouch) await load.tap(); else { await load.focus(); await page.keyboard.press('Enter'); }
  const player = card.locator('iframe');
  await expect(player).toHaveCount(1); await expect(player).toHaveAttribute('title','Video letter by Fictional parent');
  await expect(player).toHaveAttribute('src','https://www.youtube-nocookie.com/embed/AbC0123_-xy?rel=0');
  await expect(load).toBeHidden(); await expect(player).toBeFocused();
  await expect.poll(() => requests.length).toBe(1);
  await card.screenshot({path:test.info().outputPath('video-letter-player.png')});
  await card.getByRole('button',{name:'Close video player'}).click();
  await expect(player).toHaveCount(0); await expect(load).toBeFocused();
  await card.getByRole('link',{name:'Report this video letter or request removal'}).click();
  await expect(page).toHaveURL(/feedback\.html\?kind=privacy&letter=letter-012345abcdef#feedback-form$/);
  await expect(page.locator('input[name="kind"][value="privacy"]')).toBeChecked();
});

test('Video letter: a delayed player response cannot steal focus from the next action', async ({ page }) => {
  await board(page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('https://www.youtube-nocookie.com/**', async route => {
    await pending;
    await route.fulfill({contentType:'text/html',body:'<!doctype html><title>Fictional delayed player</title><button>Fictional play</button>'});
  });
  await page.goto('/letters.html#letters');
  const card=page.locator('#'+row.id);
  await card.locator('.video-letter-load').click();
  const close=card.locator('.video-letter-stop'); await close.focus(); release();
  await expect(card.locator('iframe')).toBeVisible();
  await expect(close).toBeFocused();
  await close.click();
});

test('Video letter: unsafe video ID fails the entire board closed; ordinary letters still work', async ({ page }) => {
  await board(page, [{...row, youtubeId:'AbC0123_-xy?autoplay=1'}]);
  await page.goto('/letters.html#letters');
  await expect(page.locator('#letters-list article')).toHaveCount(0);
  await expect(page.locator('#letters-message')).toContainText('could not');
  await page.unroute('**/letters.json');
  const text={...row}; delete text.youtubeId; await board(page,[text]);
  await page.reload(); await expect(page.locator('#'+row.id)).toContainText(row.body);
  await expect(page.locator('.video-letter-load,iframe')).toHaveCount(0);
});
