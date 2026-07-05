import fs from 'fs';
import path from 'path';

/** Root-absolute URL with per-segment encoding (matches sitePath). */
export function siteUrl(baseUrl: string, relativePath: string): string {
  const base = baseUrl.replace(/\/$/, '');
  const normalized = relativePath.replace(/^\//, '');
  const encoded = normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return base ? `${base}/${encoded}` : `/${encoded}`;
}

export function pwaScope(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return base ? `${base}/` : '/';
}

function walkDistFiles(dir: string, root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDistFiles(full, root));
    } else {
      files.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
  return files;
}

function precacheUrl(baseUrl: string, relativePath: string, buildId: string): string {
  let url = siteUrl(baseUrl, relativePath);
  if (relativePath.startsWith('assets/js/') || relativePath.startsWith('assets/css/')) {
    url += `?v=${encodeURIComponent(buildId)}`;
  }
  return url;
}

export function writeManifest(distDir: string, baseUrl: string): void {
  const manifest = {
    name: 'Greek3',
    short_name: 'Greek3',
    description: 'Изучение и практика современного греческого языка',
    start_url: siteUrl(baseUrl, 'index.html'),
    scope: pwaScope(baseUrl),
    display: 'standalone',
    background_color: '#f8f7f4',
    theme_color: '#2563eb',
    lang: 'ru',
    icons: [
      {
        src: siteUrl(baseUrl, 'assets/icons/icon-192.png'),
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: siteUrl(baseUrl, 'assets/icons/icon-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };

  fs.writeFileSync(
    path.join(distDir, 'manifest.webmanifest'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf-8',
  );
}

export function writeServiceWorker(
  distDir: string,
  baseUrl: string,
  buildId: string,
): void {
  const relativeFiles = walkDistFiles(distDir, distDir)
    .filter((file) => file !== 'sw.js')
    .sort();

  const precache = relativeFiles.map((file) => precacheUrl(baseUrl, file, buildId));
  const cacheName = `greek3-${buildId}`;

  const sw = `/* Greek3 service worker — generated at build */
const CACHE = ${JSON.stringify(cacheName)};
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') return response;
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request));
    }),
  );
});
`;

  fs.writeFileSync(path.join(distDir, 'sw.js'), sw, 'utf-8');
}
