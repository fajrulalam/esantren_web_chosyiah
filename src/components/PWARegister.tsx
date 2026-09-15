"use client";

import { useEffect } from 'react';

const APP_CACHE_PREFIX = 'esantren-chosyiah-cache-';

export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;

    if (process.env.NODE_ENV !== 'production') {
      // Merely skipping registration leaves any previously installed worker
      // controlling localhost. Remove this app's worker and cached pages too.
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter((item) => {
          const worker = item.active || item.waiting || item.installing;
          return worker && new URL(worker.scriptURL).origin === window.location.origin &&
            new URL(worker.scriptURL).pathname === '/sw.js';
        }).map((item) => item.unregister()));
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.filter((name) => name.startsWith(APP_CACHE_PREFIX))
            .map((name) => caches.delete(name)));
        }
      })().catch((error) => console.error('Failed to remove development PWA cache:', error));
      return;
    }

    const checkForUpdate = () => {
      if (!disposed && document.visibilityState === 'visible') {
        void registration?.update().catch((error) => console.warn('PWA update check failed:', error));
      }
    };
    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then((result) => {
          if (disposed) return;
          registration = result;
          checkForUpdate();
        })
        .catch((error) => console.error('PWA Service Worker registration failed:', error));
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
    document.addEventListener('visibilitychange', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
    return () => {
      disposed = true;
      window.removeEventListener('load', register);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.removeEventListener('online', checkForUpdate);
    };
  }, []);

  return null;
}
