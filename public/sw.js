const CACHE_NAME = 'esantren-chosyiah-cache-v1';
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
  '/',
  '/offline.html',
  '/favicon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache and caching key assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  // Avoid caching browser extensions, firebase auth calls, etc.
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Skip APIs and Firebase calls from caching in sw
  if (url.pathname.startsWith('/__/auth') || url.hostname.includes('firebaseapp.com') || url.hostname.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and fetch updated version in background (stale-while-revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore background fetch failures
          });
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          // Cache successful responses for our domain (exclude APIs, etc.)
          if (response.status === 200 && url.origin === self.location.origin) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fetch fails and requested a document (page navigation), show offline fallback
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});
