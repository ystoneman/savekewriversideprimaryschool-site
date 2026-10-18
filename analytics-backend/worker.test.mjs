import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { parsePetition, petitionResponse, PETITION_SOURCE } from './worker.mjs';

function environment() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('schema.sql', import.meta.url), 'utf8'));
  return { sql, COUNTS: {
    prepare(query) {
      return { bind(...values) { return { run: () => sql.prepare(query).run(...values) }; },
        run: () => sql.prepare(query).run() };
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const result = statements.map(s => s.run()); sql.exec('COMMIT'); return result; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  } };
}
function request(body, extra = {}) {
  return new Request('https://counter.example/count', { method: 'POST',
    headers: { Origin: 'https://savekewriversideprimaryschool.org', 'Content-Type': 'text/plain', ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body) });
}
const valid = { counters: [{ metric: 'page', label: 'faq.html' }, { metric: 'source', label: 'external' }] };
const petitionHTML = count => `<h1>Keep Kew Riverside Primary School open.</h1><p>This petition runs from 13/10/2026 to 13/01/2027.</p><p>${count} people have signed this petition.</p><p>Fictional signer data must not survive.</p>`;

test('Petition parser requires exact identity, run dates and one valid standalone aggregate', () => {
  for (const count of [0,193,500,1000,1200,1000000]) assert.equal(parsePetition(petitionHTML(count.toLocaleString('en-GB'))), count);
  for (const html of [petitionHTML('-1'), petitionHTML('1,00'), petitionHTML('1.5'), petitionHTML('1000001'),
    petitionHTML('193').replace('Kew Riverside','Another School'), petitionHTML('193').replace('13/01/2027','14/01/2027'),
    petitionHTML('193') + '<p>500 people have signed this petition.</p>']) assert.equal(parsePetition(html),null);
});
test('Petition GET fetches one fixed source, caching only its sanitized count and original check time', async () => {
  const stored = new Map(); let reads=0;
  const cache = { match: async key => stored.get(key.url)?.clone(), put: async (key,value) => stored.set(key.url,value) };
  const dependencies = { cache, now:()=>new Date('2026-10-18T14:48:17Z'), fetchPage:async (url,options) => {
    reads++; assert.equal(url,PETITION_SOURCE); assert.deepEqual(options.headers,{Accept:'text/html'});
    assert.equal(options.redirect,'error'); assert.equal(options.cf.cacheTtl,0);
    return new Response(petitionHTML('193'),{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }};
  const req = new Request('https://counter.example/petition',{headers:{Origin:'https://savekewriversideprimaryschool.org',Cookie:'fictional-private',Referer:'https://private.invalid/'}});
  for (let n=0;n<2;n++) {
    const response=await petitionResponse(req,dependencies); assert.equal(response.status,200);
    assert.equal(response.headers.get('Cache-Control'),'public, max-age=900');
    assert.deepEqual(await response.json(),{onlineSignatures:193,checkedAt:'2026-10-18T14:48:17.000Z',source:PETITION_SOURCE});
  }
  assert.equal(reads,1); assert.equal(stored.size,1);
  assert.doesNotMatch(await [...stored.values()][0].text(),/Fictional|private|Cookie|signer/);
});
test('Petition failures never fabricate zero, store upstream HTML, redirect or write to D1', async () => {
  for (const result of [()=>{throw new Error('Outage')},()=>new Response('wrong'),()=>new Response(petitionHTML('193'),{status:503}),
    ()=>new Response(petitionHTML('193')+'x'.repeat(65536),{headers:{'Content-Type':'text/html'}})]) {
    let cached=false; const response=await petitionResponse(new Request('https://counter.example/petition'),{
      fetchPage:async()=>result(),cache:{match:async()=>undefined,put:async()=>{cached=true}}});
    assert.equal(response.status,503); assert.deepEqual(await response.json(),{unavailable:true}); assert.equal(cached,false);
  }
  assert.equal((await petitionResponse(new Request('https://counter.example/petition',{method:'POST'}))).status,405);
  assert.equal((await petitionResponse(new Request('https://counter.example/petition',{headers:{Origin:'https://other.invalid'}}))).status,403);
  const env=environment(); assert.equal((await worker.fetch(new Request('https://counter.example/petition?source=private'),env)).status,404);
  assert.equal(env.sql.prepare('SELECT count(*) AS n FROM counts').get().n,0);
});

test('Requests increment daily totals directly, retaining only counter columns', async () => {
  const env = environment();
  for (let n = 0; n < 3; n++) {
    const response = await worker.fetch(request(valid, { 'User-Agent': 'Fictional browser', 'CF-Connecting-IP': '192.0.2.1' }), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted: true });
  }
  const rows = env.sql.prepare('SELECT * FROM counts ORDER BY metric').all();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].total, 3);
  assert.deepEqual(Object.keys(rows[0]), ['day', 'metric', 'label', 'total']);
  assert.deepEqual(env.sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x => x.name), ['counts']);
});
test('Reject arbitrary and private values before any database write', async () => {
  const env = environment();
  for (const body of [
    { ...valid, email: 'private@example.invalid' },
    { counters: [{ metric: 'page', label: 'corrections.html' }] },
    { counters: [{ metric: 'page', label: 'faq.html?private=sentinel' }] },
    { counters: [{ metric: 'action', label: 'letter-private-id' }] },
    { counters: [{ metric: '__proto__', label: 'anything' }] },
    { counters: [{ metric: 'constructor', label: 'anything' }] },
    { counters: [{ metric: 'page', label: 'faq.html', time: Date.now() }] },
    { counters: [valid.counters[0], valid.counters[0]] },
    { counters: [] }, { counters: [null] }, null, 'not-json',
  ]) assert.equal((await worker.fetch(request(body), env)).status, 400);
  assert.equal((await worker.fetch(request('x'.repeat(1025)), env)).status, 413);
  assert.equal(env.sql.prepare('SELECT count(*) AS n FROM counts').get().n, 0);
});
test('Origin, privacy signals, HTTP method and content type fail closed', async () => {
  const env = environment();
  for (const extra of [{ Origin: 'https://other.example' }, { DNT: '1' }, { 'Sec-GPC': '1' }]) {
    assert.equal((await worker.fetch(request(valid, extra), env)).status, 403);
  }
  assert.equal((await worker.fetch(request(valid, { 'Content-Type': 'application/json' }), env)).status, 415);
  assert.equal((await worker.fetch(new Request('https://counter.example/count', { headers: { Origin: 'https://savekewriversideprimaryschool.org' } }), env)).status, 405);
  assert.equal(env.sql.prepare('SELECT count(*) AS n FROM counts').get().n, 0);
});
test('A database failure does not return success or queue an event', async () => {
  const env = environment();
  env.COUNTS.batch = async () => { throw new Error('fictional outage'); };
  assert.equal((await worker.fetch(request(valid), env)).status, 503);
  assert.equal(env.sql.prepare('SELECT count(*) AS n FROM counts').get().n, 0);
});
test('Retention deletes expired daily aggregates and keeps recent totals', async () => {
  const env = environment();
  env.sql.exec("INSERT INTO counts VALUES('2020-01-01','page','faq.html',5)");
  await worker.fetch(request(valid), env);
  await worker.scheduled({}, env);
  assert.equal(env.sql.prepare('SELECT count(*) AS n FROM counts').get().n, 2);
  assert.equal(env.sql.prepare("SELECT count(*) AS n FROM counts WHERE day='2020-01-01'").get().n, 0);
});

test('Expanded labels accept fixed aggregates and reject granular or private values', async () => {
  const env = environment();
  for (const [metric, label] of Object.entries({ browser: 'safari', os: 'ios', device: 'mobile', referral: 'richmond-nub', navigation: 'proposal.html>faq.html', active_page: 'faq.html|30', load: 'faq.html|under-1s', ttfb: 'faq.html|unavailable', fcp: 'faq.html|over-4s' })) {
    assert.equal((await worker.fetch(request({ counters: [{ metric, label }] }), env)).status, 200);
  }
  for (const [metric, label] of [ ['browser', 'Safari/18.1'], ['referral', 'private.example'], ['navigation', 'feedback.html>faq.html'], ['navigation', 'proposal.html?name=private>faq.html'], ['active_page', 'letter-person|30'], ['load', 'faq.html|1234'] ]) {
    assert.equal((await worker.fetch(request({ counters: [{ metric, label }] }), env)).status, 400);
  }
  assert.equal(env.sql.prepare('SELECT count(*) AS n FROM counts').get().n, 9);
});

test('Daily browser accepts only an isolated fixed total, retaining no browser identity', async () => {
  const env = environment();
  const one = { metric: 'browser_day', label: 'all' };
  assert.equal((await worker.fetch(request({ counters: [one] }), env)).status, 200);
  for (const counters of [[one, valid.counters[0]], [{ ...one, label: '2026-10-12' }], [{ ...one, id: 'private-token' }]]) {
    assert.equal((await worker.fetch(request({ counters }), env)).status, 400);
  }
  assert.deepEqual({ ...env.sql.prepare('SELECT * FROM counts').get() }, {
    day: new Date().toISOString().slice(0, 10), metric: 'browser_day', label: 'all', total: 1,
  });
});

test('Hourly page opens are isolated all-page receipt buckets, with no client hour or browser identity', async () => {
  const env = environment();
  const hour = { metric: 'page_hour', label: 'all' };
  for (const counters of [[hour, valid.counters[0]], [{ ...hour, label: '18' }], [{ ...hour, time: '18:12' }]]) {
    assert.equal((await worker.fetch(request({ counters }), env)).status, 400);
  }
  for (const extra of [{ DNT: '1' }, { 'Sec-GPC': '1' }]) {
    assert.equal((await worker.fetch(request({ counters: [hour] }, extra), env)).status, 403);
  }
  for (let n=0; n<3; n++) assert.equal((await worker.fetch(request({ counters: [hour] }), env)).status, 200);
  const row = env.sql.prepare('SELECT * FROM counts').get();
  assert.deepEqual({ ...row }, { day: new Date().toISOString().slice(0,10), metric: 'page_hour', label: new Date().toISOString().slice(11,13), total: 3 });
  assert.equal(env.sql.prepare("SELECT COUNT(*) AS n FROM counts WHERE metric='browser_day'").get().n, 0);
});
