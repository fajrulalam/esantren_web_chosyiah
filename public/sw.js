const CACHE_PREFIX = 'esantren-chosyiah-cache-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const OFFLINE_URL = '/offline.html';

// Never precache app pages: their HTML points to a specific deployment's code.
const ASSETS_TO_CACHE = [
  OFFLINE_URL,
  '/favicon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS_TO_CACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) return;

  // A navigation must load the current deployment. When offline, show the
  // offline page rather than an old (possibly authenticated) application page.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request, { cache: 'no-store' });
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(OFFLINE_URL) || new Response('Anda sedang offline.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  // Next.js router/RSC requests and other dynamic responses go straight to
  // the network. Only versioned build assets and the offline shell are cached.
  const staticAsset = url.pathname.startsWith('/_next/static/') || ASSETS_TO_CACHE.includes(url.pathname);
  if (!staticAsset || request.headers.has('RSC') || url.searchParams.has('_rsc')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && !response.redirected) {
      // Storage failure must not prevent a successfully fetched asset loading.
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  })());
});
