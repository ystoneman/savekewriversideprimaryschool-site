const { test, expect, archivedPages } = require('./fixtures');
const site = 'https://savekewriversideprimaryschool.org/';
// The slim campaign site (13 October 2026) lists only its live reading pages; archived pages stay served but unlisted.
const sitemapPages = ['', 'dates.html', 'get-involved.html', 'updates.html', 'about.html', 'letters.html', 'questions.html', 'understand.html', 'evidence.html', 'options.html', 'lessons.html', 'lessons-sources.html'];

for (const [file, type] of [['sitemap.xml', 'application/xml'], ['robots.txt', 'text/plain']]) {
  test(`${file} is served by GET and HEAD with the correct MIME type`, async ({ request }) => {
    const get = await request.get('/' + file);
    expect(get.status()).toBe(200);
    expect(get.headers()['content-type']).toBe(type + '; charset=utf-8');
    const text = await get.text();
    expect(text).toContain(site + (file === 'robots.txt' ? 'sitemap.xml' : 'get-involved.html'));
    const head = await request.head('/' + file);
    expect(head.status()).toBe(200);
    expect(head.headers()['content-type']).toBe(get.headers()['content-type']);
    expect(await head.body()).toHaveLength(0);
  });
}

test('sitemap destinations resolve to indexable self-canonical pages', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  const urls = [...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  expect(new Set(urls).size).toBe(urls.length);
  expect([...urls].sort()).toEqual(sitemapPages.map(page => site + page).sort());
  for (const url of urls) {
    const path = new URL(url).pathname;
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const head = (await response.text()).split('</head>')[0];
    expect(head).toContain(`<link rel="canonical" href="${url}">`);
    expect(head).not.toMatch(/name="(?:robots|googlebot)" content="[^\"]*noindex/);
    expect(head).toContain('Independent parent-led campaign.');
  }
});

test('archived pages stay served for old links but are unlisted and not indexed', async ({ request }) => {
  const listed = await (await request.get('/sitemap.xml')).text();
  expect(archivedPages.length).toBeGreaterThan(0);
  for (const file of archivedPages) {
    expect(listed, file).not.toContain(site + file);
    const response = await request.get('/' + file);
    expect(response.status(), file).toBe(200);
    const head = (await response.text()).split('</head>')[0];
    expect(head, file).toContain(`<link rel="canonical" href="${site + file}">`);
    // Archived pages still let crawlers follow their links; the fundraising briefs never did.
    const robots = file.startsWith('fundraising-') ? 'noindex,nofollow' : 'noindex,follow';
    expect(head, file).toContain(`<meta name="robots" content="${robots}">`);
  }
});
