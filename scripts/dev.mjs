#!/usr/bin/env node
/**
 * Local static server for dist/
 * Supports optional SITE_BASE_URL prefix (e.g. /Greek3 for GitHub Pages simulation)
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const BASE = (process.env.SITE_BASE_URL ?? '').replace(/\/$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type ?? 'text/plain; charset=utf-8' });
  res.end(body);
}

function tryResolve(filePath) {
  if (!filePath.startsWith(DIST)) return null;

  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) return filePath;
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) return indexPath;
    }
  }

  const withHtml = `${filePath}.html`;
  if (fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) return withHtml;

  return null;
}

function resolveFile(urlPath) {
  let p = urlPath;
  if (BASE && (p === BASE || p === `${BASE}/`)) {
    p = `${BASE}/index.html`;
  }
  if (BASE && p.startsWith(`${BASE}/`)) {
    p = p.slice(BASE.length);
  }
  if (p === '/' || p === '') p = '/index.html';
  if (p.endsWith('/')) p += 'index.html';

  return tryResolve(path.join(DIST, p));
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('❌ dist/index.html not found. Run: npm run build:site');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`).pathname);
  const filePath = resolveFile(urlPath);

  if (!filePath) {
    send(res, 404, `404 Not Found: ${urlPath}`);
    return;
  }

  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 500, '500 Internal Server Error');
      return;
    }
    send(res, 200, data, MIME[ext] ?? 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  const root = BASE ? `http://localhost:${PORT}${BASE}/` : `http://localhost:${PORT}/`;
  console.log(`\n✅ Dev server: ${root}\n`);
});
