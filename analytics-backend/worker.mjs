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
  return value.counters;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
    const day = new Date().toISOString().slice(0, 10);
    try {
      // One atomic batch directly increments totals. No raw event is retained.
      await env.COUNTS.batch(counters.map(({ metric, label }) => env.COUNTS.prepare(
        'INSERT INTO counts(day,metric,label,total) VALUES(?,?,?,1) ON CONFLICT(day,metric,label) DO UPDATE SET total=total+1'
      ).bind(day, metric, label)));
      return reply(200, { accepted: true });
    } catch (_) { return reply(503, { accepted: false }); }
  },
  async scheduled(_event, env) {
    await env.COUNTS.prepare("DELETE FROM counts WHERE day < date('now','-365 days')").run();
  },
};
