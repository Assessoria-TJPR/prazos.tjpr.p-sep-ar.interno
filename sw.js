// Versão do cache - mude este valor para forçar atualização
const CACHE_NAME = 'prazos-tjpr-v8';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './supabase-init.js',
  './contexts.js',
  './utils.js',
  './regrasCNJ.js',
  './regrasCrime.js',
  './regrasCivel.js',
  './minutas-default.js',
  './login.js',
  './components.js',
  './app.js',
  './BugReportsPage.js',
  './CalendarAdminPage.js',
  './MinutasAdminPage.js',
  './Logo.png',
  './manifest.json'
];

// Instalação - cache com tolerância a falhas individuais
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Usa Promise.allSettled para não falhar se um arquivo der 404
      return Promise.allSettled(
        urlsToCache.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] Não foi possível cachear:', url, err);
          })
        )
      );
    })
  );
});

// Ativação - limpa caches antigos automaticamente
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Limpando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
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