"use client";

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleRegister = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('PWA Service Worker registered with scope: ', registration.scope);
          })
          .catch((err) => {
            console.error('PWA Service Worker registration failed: ', err);
          });
      };

      if (document.readyState === 'complete') {
        handleRegister();
      } else {
        window.addEventListener('load', handleRegister);
        return () => window.removeEventListener('load', handleRegister);
      }
    }
  }, []);

  return null;
}
