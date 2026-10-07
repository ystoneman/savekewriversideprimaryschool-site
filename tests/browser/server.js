// Serve the real CSP over local HTTPS, including upgrade-insecure-requests.
// Browsers get HTTP/2, as on GitHub Pages. WebKit lost redirected navigations far more
// often over HTTP/1.1, where cancelling a page's in-flight requests closes connections
// (TESTING.md). HTTP/1.1 remains for Playwright's request client and readiness check.
// Test certificates live only in an OS temporary directory and are removed at exit.
const http2 = require('node:http2');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const manifest = fs.readFileSync(path.join(root, '.github/scripts/check_site.py'), 'utf8');
const publicFiles = new Set(manifest.match(/PUBLIC_FILES = frozenset\('''([\s\S]*?)'''\.split\(\)\)/)[1].trim().split(/\s+/));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kew-browser-test-'));
const key = path.join(temporary, 'localhost.key');
const certificate = path.join(temporary, 'localhost.crt');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', certificate, '-days', '1', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
const types = { '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8', '.pdf': 'application/pdf', '.md': 'text/markdown; charset=utf-8', '.ics': 'text/calendar; charset=utf-8' };
const server = http2.createSecureServer({ key: fs.readFileSync(key), cert: fs.readFileSync(certificate), allowHTTP1: true }, (request, response) => {
  let name, url;
  try {
    url = new URL(request.url, 'https://127.0.0.1');
    name = decodeURIComponent(url.pathname).replace(/^\/kew-riverside-website(?=\/|$)/, '').replace(/^\//, '');
  }
  catch { response.writeHead(400).end(); return; }
  if (!['GET', 'HEAD'].includes(request.method) || name.split('/').some(part => part === '..' || part === '.') || name.includes('\\')) {
    response.writeHead(404).end(); return;
  }
  if (name && !name.endsWith('/') && publicFiles.has(name + '/index.html')) {
    response.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return;
  }
  if (!name || name.endsWith('/')) name += 'index.html';
  const extension = path.extname(name);
  if (!publicFiles.has(name) || !types[extension] || !fs.existsSync(path.join(root, name))) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': types[extension], 'Cache-Control': 'no-store' });
  if (request.method === 'HEAD') response.end();
  else fs.createReadStream(path.join(root, name)).pipe(response);
});
function cleanUp() { server.close(); fs.rmSync(temporary, { recursive: true, force: true }); }
process.on('exit', cleanUp);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { cleanUp(); process.exit(0); });
server.listen(Number(process.env.KEW_TEST_PORT || 4173), '127.0.0.1');
