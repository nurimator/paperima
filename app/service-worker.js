const CACHE_NAME = 'papera-v1.0.0';
const urlsToCache = [
  './app/',
  './app/index.html',
  './app/assets/site.webmanifest',
  './app/assets/icon/favicon-96x96.png',
  './app/assets/icon/favicon.ico',
  './app/assets/icon/apple-touch-icon.png',
  './app/assets/texture/paper_overlay_0.webp',
  './app/assets/texture/paper_overlay_1.webp',
  './app/assets/texture/paper_overlay_2.webp',
  './app/assets/texture/paper_overlay_3.webp',
  './app/assets/texture/paper_fold_0.webp',
  './app/assets/texture/paper_fold_1.webp',
  './app/assets/texture/paper_fold_2.webp',
  './app/assets/texture/paper_fold_3.webp',
  './app/assets/texture/paper_fold_4.webp',
  './app/assets/texture/paper_fold_5.webp',
  './app/assets/texture/paper_mask_0.webp',
  './app/assets/texture/paper_mask_1.webp',
  './app/assets/texture/paper_mask_2.webp',
  './app/assets/texture/paper_mask_3.webp',
  './app/assets/texture/paper_mask_4.webp',
  './app/assets/texture/paper_mask_5.webp',
  './app/assets/icon/web-app-manifest-any.png',
  './app/assets/icon/web-app-manifest-192x192.png',
  './app/assets/icon/web-app-manifest-512x512.png',
  './app/assets/tailwind.css',
  './app/assets/CCapture.all.min.js',
  './app/assets/font/Inter-VariableFont_opsz,wght.ttf'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const clonedResponse = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clonedResponse);
        });

        return networkResponse;
      }).catch(() => {
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
