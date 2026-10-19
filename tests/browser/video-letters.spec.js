const { test, expect } = require('./fixtures');
const row = { id: 'letter-012345abcdef', date: '2026-09-29', review: 'AI screened', displayName: 'Fictional parent', body: 'A fictional video letter about a school proposal.', youtubeId: 'AbC0123_-xy' };
const playerURL = 'https://www.youtube-nocookie.com/embed/AbC0123_-xy?rel=0';
const fictionalPlayer = '<!doctype html><title>Fictional player</title><button>Play fictional video</button>';
async function board(page, rows = [row]) {
  await page.route('**/letters.json', route => route.fulfill({ json: { version: 1, letters: rows } }));
  await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({contentType:'text/html',body:fictionalPlayer}));
}

test('Video letter: player loads on arrival without autoplay or an extra loading step', async ({ page, browserName }) => {
  await board(page);
  const requests = [];
  page.on('request', request => {
    if (request.url().startsWith('https://www.youtube-nocookie.com/')) requests.push(request.url());
  });
  await page.goto('/letters.html#' + row.id);
  const card = page.locator('#' + row.id);
  await expect(card).toContainText('Video letter · AI screened · Opinion');
  await expect(card.locator('.video-letter-note,.video-letter-load,.video-letter-stop')).toHaveCount(0);
  await expect(card.getByRole('link', {name:'Watch on YouTube'})).toHaveAttribute('href','https://www.youtube.com/watch?v=AbC0123_-xy');
  await expect(card.getByRole('link', {name:'Video privacy'})).toHaveAttribute('href','privacy.html#video-privacy');
  const player = card.locator('iframe');
  await expect(player).toHaveCount(1);
  await expect(player).toHaveAttribute('title','Video letter by Fictional parent');
  await expect(player).toHaveAttribute('src',playerURL);
  await expect(player).toHaveAttribute('allow','fullscreen');
  await expect(player).toHaveAttribute('allowfullscreen','');
  await expect(player).toHaveAttribute('referrerpolicy','strict-origin-when-cross-origin');
  await expect.poll(() => requests).toEqual([playerURL]);
  await expect(player).not.toBeFocused();
  const play = player.contentFrame().getByRole('button',{name:'Play fictional video'});
  await play.focus(); await expect(play).toBeFocused();
  await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
  await expect(card.getByRole('link',{name:'Watch on YouTube'})).toBeFocused();
  await card.getByRole('link',{name:'Report this video letter or request removal'}).click();
  await expect(page).toHaveURL(/feedback\.html\?kind=privacy&letter=letter-012345abcdef#feedback-form$/);
  await expect(page.locator('input[name="kind"][value="privacy"]')).toBeChecked();
  await page.goBack();
  await expect(page.locator('#'+row.id+' iframe')).toHaveAttribute('src',playerURL);
});

test('Video letter: ready player and recovery links fit light and dark layouts', async ({page}) => {
  await board(page);
  for (const scheme of ['light','dark']) {
    await page.emulateMedia({colorScheme:scheme});
    await page.goto('/letters.html#' + row.id);
    const card=page.locator('#'+row.id);
    await expect(card.locator('iframe')).toBeVisible();
    await expect(card.getByRole('link',{name:'Watch on YouTube'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const size=await card.locator('iframe').boundingBox();
    expect(size.width/size.height).toBeCloseTo(16/9,1);
    await card.screenshot({path:test.info().outputPath('video-letter-'+scheme+'.png')});
  }
});

test('Video letter: delayed feed and player preserve writing focus and form arrival', async ({ page }) => {
  await board(page);
  let releaseBoard, releasePlayer;
  const pendingBoard=new Promise(resolve=>{releaseBoard=resolve;});
  const pendingPlayer=new Promise(resolve=>{releasePlayer=resolve;});
  await page.route('**/letters.json',async route=>{
    await pendingBoard;
    await route.fulfill({json:{version:1,letters:[row]}});
  });
  await page.route('https://www.youtube-nocookie.com/**',async route=>{
    await pendingPlayer;
    await route.fulfill({contentType:'text/html',body:fictionalPlayer});
  });
  await page.goto('/letters.html#letter-form',{waitUntil:'domcontentloaded'});
  const message=page.locator('#message');
  await message.fill('A fictional draft stays in focus while the video loads.');
  await expect(message).toBeInViewport();
  releaseBoard();
  await expect(page.locator('#'+row.id+' iframe')).toHaveCount(1);
  await expect(message).toBeFocused();
  releasePlayer();
  await expect(page.frameLocator('#'+row.id+' iframe').getByRole('button')).toBeVisible();
  await expect(message).toBeFocused();
  await expect(message).toBeInViewport();
});

test('Video letter: unsafe video ID fails the entire board closed; ordinary letters still work', async ({ page }) => {
  await board(page, [{...row, youtubeId:'AbC0123_-xy?autoplay=1'}]);
  await page.goto('/letters.html#letters');
  await expect(page.locator('#letters-list article')).toHaveCount(0);
  await expect(page.locator('#letters-message')).toContainText('could not');
  await page.unroute('**/letters.json');
  const text={...row}; delete text.youtubeId; await board(page,[text]);
  await page.reload(); await expect(page.locator('#'+row.id)).toContainText(row.body);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('Video letter: delayed feed preserves an untouched direct form arrival', async ({ page }) => {
  await board(page);
  let releaseBoard;
  const pendingBoard=new Promise(resolve=>{releaseBoard=resolve;});
  await page.route('**/letters.json',async route=>{
    await pendingBoard;
    await route.fulfill({json:{version:1,letters:[row]}});
  });
  await page.goto('/letters.html#letter-form',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#message')).toBeInViewport();
  releaseBoard();
  await expect(page.locator('#'+row.id+' iframe')).toBeVisible();
  await expect(page.locator('#message')).toBeInViewport();
  await expect(page.locator('iframe')).not.toBeFocused();
});

test('Video letter: refreshed assets render mixed written and video letters for returning readers', async ({ page }) => {
  const written = {...row, id:'letter-fedcba543210', body:'A fictional written letter stays readable beside a video.'};
  delete written.youtubeId;
  await board(page,[written,row]);
  await page.goto('/letters.html#letters');
  await expect(page.locator('script[src="letters.js?v=2026101903"]')).toHaveCount(1);
  await expect(page.locator('link[href="community.css?v=2026101902"]')).toHaveCount(1);
  await expect(page.locator('#'+written.id)).toContainText(written.body);
  await expect(page.locator('#'+row.id+' iframe')).toBeVisible();
  await expect(page.locator('#letters-list article')).toHaveCount(2);
});
