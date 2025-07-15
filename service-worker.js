// Nama cache unik untuk setiap versi aplikasi
const CACHE_NAME = 'papera-me-v1';

// Daftar file yang akan di-cache
const urlsToCache = [
  './',
  './index.html',
  './assets/site.webmanifest',
  './assets/favicon-96x96.png',
  './assets/favicon.ico',
  './assets/apple-touch-icon.png',
  // Tambahkan semua file aset yang diperlukan aplikasi di sini
  // misalnya: './assets/image.webp', './assets/audio.mp3', etc.
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/ccapture.js-npmfixed/build/CCapture.all.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Event: install
// Service Worker menginstal dan mengisi cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Event: fetch
// Menayangkan file dari cache saat offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Event: activate
// Mengelola pembersihan cache lama
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});