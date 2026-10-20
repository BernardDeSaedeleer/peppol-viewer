import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { syncVersion } from './version.mjs';
const root = new URL('../', import.meta.url);
const version = await syncVersion(root);
const allowed = new Set(['index.html', 'styles.css', 'parser.js', 'app.js', 'favicon.svg', 'mascot.png']);
const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', svg: 'image/svg+xml', png: 'image/png' };
const server = http.createServer(async (req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!allowed.has(name)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(new URL(name, root));
    res.writeHead(200, { 'Content-Type': types[name.split('.').pop()], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(500); res.end('Unable to read file'); }
});
server.listen(4173, '127.0.0.1', () => console.log(`Peppol Viewer v${version}: http://127.0.0.1:4173`));
