import labels from './labels.json' with { type: 'json' };

const ORIGIN = 'https://savekewriversideprimaryschool.org';
const allowed = Object.fromEntries(Object.entries(labels).map(([metric, values]) => [metric, new Set(values)]));
const headers = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
};
const reply = (status, value) => new Response(JSON.stringify(value), { status, headers });
export const PETITION_SOURCE = 'https://www2.richmond.gov.uk/Account/ePetitionDetails.aspx?ID=249';
const petitionHeaders = { ...headers, 'Access-Control-Allow-Methods': 'GET', 'Cache-Control': 'public, max-age=900' };
const petitionReply = (status, value) => new Response(JSON.stringify(value), { status,
  headers: { ...petitionHeaders, ...(status === 200 ? {} : {'Cache-Control':'no-store'}) } });

export function parsePetition(html) {
  if (!/<h1>\s*Keep Kew Riverside Primary School open\.?\s*<\/h1>/i.test(html) ||
      !/This petition runs from 13\/10\/2026 to 13\/01\/2027\./.test(html)) return null;
  const matches = [...html.matchAll(/<p>\s*(0|[1-9]\d{0,6}|[1-9]\d{0,2}(?:,\d{3}){1,2})\s+people have signed this petition\.\s*<\/p>/gi)];
  if (matches.length !== 1) return null;
  const count = Number(matches[0][1].replaceAll(',', ''));
  return Number.isSafeInteger(count) && count >= 0 && count <= 1000000 ? count : null;
}

export async function petitionResponse(request, { fetchPage = fetch, cache = globalThis.caches?.default, now = () => new Date() } = {}) {
  if (request.method !== 'GET') return petitionReply(405, { unavailable: true });
  const origin = request.headers.get('Origin');
  if (origin && origin !== ORIGIN) return petitionReply(403, { unavailable: true });
  // Fixed cache key and upstream: visitor queries, headers and cookies never travel upstream.
  const key = new Request(new URL('/petition', request.url));
  try {
    const cached = await cache?.match(key);
    if (cached) return cached;
    // Workers supports manual/follow, not Fetch's error mode. Reject 3xx below.
    const response = await fetchPage(PETITION_SOURCE, { headers: {'Accept':'text/html'},
      redirect:'manual', signal:AbortSignal.timeout(6000), cf:{cacheTtl:0} });
    if (!response.ok || !/^text\/html\b/i.test(response.headers.get('Content-Type') || '')) throw new Error('Unavailable');
    const reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65536) { await reader.cancel(); throw new Error('Oversize'); }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    const count = parsePetition(new TextDecoder().decode(body));
    if (count === null) throw new Error('Unavailable');
    const result = petitionReply(200, { onlineSignatures:count, checkedAt:now().toISOString(), source:PETITION_SOURCE });
    // Only the sanitized aggregate enters the edge cache. No HTML or signer data is retained.
    await cache?.put(key, result.clone());
    return result;
  } catch (_) { return petitionReply(503, { unavailable: true }); }
}

export function validate(value) {
  if (!value || Object.keys(value).join() !== 'counters' || !Array.isArray(value.counters) ||
      value.counters.length < 1 || value.counters.length > 3) return null;
  const seen = new Set();
  for (const row of value.counters) {
    if (!row || Object.keys(row).sort().join() !== 'label,metric' ||
        typeof row.metric !== 'string' || typeof row.label !== 'string' ||
        !Object.hasOwn(allowed, row.metric) || !allowed[row.metric].has(row.label)) return null;
    const key = row.metric + ':' + row.label;
    if (seen.has(key)) return null;
    seen.add(key);
  }
  // Browser estimate is a standalone total, never combined with dimensions.
  if (value.counters.some(row => ['browser_day', 'page_hour'].includes(row.metric)) && value.counters.length !== 1) return null;
  return value.counters;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/petition' && !url.search) return petitionResponse(request);
    if (url.pathname !== '/count' || url.search) return reply(404, { accepted: false });
    if (request.headers.get('Origin') !== ORIGIN) return reply(403, { accepted: false });
    // Honour signals server-side too. No IP, UA, cookie, session or fingerprint
    // is read, written, logged, or used to deduplicate people.
    if (request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1') return reply(403, { accepted: false });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { accepted: false });
    if (!/^text\/plain(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return reply(415, { accepted: false });
    let counters;
    try {
      // Bound the stream before parsing, including requests without Content-Length.
      const reader = request.body?.getReader();
      if (!reader) return reply(400, { accepted: false });
      let bytes = 0;
      const chunks = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1024) { await reader.cancel(); return reply(413, { accepted: false }); }
        chunks.push(value);
      }
      const body = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      counters = validate(JSON.parse(new TextDecoder().decode(body)));
    } catch (_) { return reply(400, { accepted: false }); }
    if (!counters) return reply(400, { accepted: false });
    const receipt = new Date().toISOString();
    const day = receipt.slice(0, 10);
    const hour = receipt.slice(11, 13);
    try {
      // One atomic batch directly increments totals. No raw event is retained.
      await env.COUNTS.batch(counters.map(({ metric, label }) => env.COUNTS.prepare(
        'INSERT INTO counts(day,metric,label,total) VALUES(?,?,?,1) ON CONFLICT(day,metric,label) DO UPDATE SET total=total+1'
      ).bind(day, metric, metric === 'page_hour' ? hour : label)));
      return reply(200, { accepted: true });
    } catch (_) { return reply(503, { accepted: false }); }
  },
  async scheduled(_event, env) {
    await env.COUNTS.prepare("DELETE FROM counts WHERE day < date('now','-365 days')").run();
  },
};
