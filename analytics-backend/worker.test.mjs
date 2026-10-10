import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.mjs';

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
