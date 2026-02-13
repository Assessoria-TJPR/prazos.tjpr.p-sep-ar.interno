// Versão do cache - mude este valor para forçar atualização
const CACHE_NAME = 'prazos-tjpr-v7';
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

// Instalação - atualiza cache imediatamente
self.addEventListener('install', event => {
  // Force o SW a ativar imediatamente, substituindo o antigo
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Ativação - limpa caches antigos automaticamente
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Limpando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Toma controle de todas as páginas imediatamente
      return self.clients.claim();
    })
  );
});

// Fetch - Estratégia Network First (sempre busca a versão mais recente)
self.addEventListener('fetch', event => {
  // Ignora requisições que não sejam http/https (ex: chrome-extension)
  if (!event.request.url.startsWith('http')) return;
  // Ignora requisições que não sejam GET (POST não pode ser cacheado)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se conseguiu buscar da rede, atualiza o cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Se falhou (offline), tenta o cache
        return caches.match(event.request);
      })
  );
});