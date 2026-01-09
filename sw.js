const CACHE_NAME = 'prazos-tjpr-v4';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './firebase-init.js',
  './contexts.js',
  './utils.js',
  './regrasCNJ.js',
  './regrasCrime.js',
  './regrasCivel.js',
  './minutas-default.js',
  './app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});