const CACHE_NAME = 'paperima-v1.0.0';
const urlsToCache = [
  './public/',
  './public/index.html',
  './public/assets/site.webmanifest',
  './public/assets/icon/favicon-96x96.png',
  './public/assets/icon/favicon.ico',
  './public/assets/icon/apple-touch-icon.png',
  './public/assets/texture/paper_overlay_0.webp',
  './public/assets/texture/paper_overlay_1.webp',
  './public/assets/texture/paper_overlay_2.webp',
  './public/assets/texture/paper_overlay_3.webp',
  './public/assets/texture/paper_fold_0.webp',
  './public/assets/texture/paper_fold_1.webp',
  './public/assets/texture/paper_fold_2.webp',
  './public/assets/texture/paper_fold_3.webp',
  './public/assets/texture/paper_fold_4.webp',
  './public/assets/texture/paper_fold_5.webp',
  './public/assets/texture/paper_mask_0.webp',
  './public/assets/texture/paper_mask_1.webp',
  './public/assets/texture/paper_mask_2.webp',
  './public/assets/texture/paper_mask_3.webp',
  './public/assets/texture/paper_mask_4.webp',
  './public/assets/texture/paper_mask_5.webp',
  './public/assets/icon/web-app-manifest-any.png',
  './public/assets/icon/web-app-manifest-192x192.png',
  './public/assets/icon/web-app-manifest-512x512.png',
  './public/assets/tailwind.css',
  './public/assets/font/Inter-VariableFont_opsz,wght.ttf',
  './public/assets/export-module.js',
  './public/assets/pwa-module.js',
  './public/assets/CCapture.all.min.js'
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
