const CACHE_NAME = 'winter-arc-shell-v1';
const APP_SHELL = [
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const indexResponse = await fetch('/index.html');
      const indexHtml = await indexResponse.clone().text();
      const builtAssets = [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)]
        .map((match) => match[1]);

      await cache.put('/index.html', indexResponse);
      await cache.addAll([
        ...APP_SHELL.filter((path) => path !== '/index.html'),
        ...builtAssets,
      ]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('winter-arc-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (
        await caches.match('/index.html') || Response.error()
      )),
    );
    return;
  }

  // Cache the built app bundle and app icons only. API responses and user data
  // are intentionally left to the browser's normal network handling.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
  }
});
