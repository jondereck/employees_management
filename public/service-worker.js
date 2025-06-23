const CACHE_NAME = 'my-nextjs-pwa-cache-v2';

const BASE_PATH = '/f622687f-79c6-44e8-87c6-301a257582b2';

const urlsToCache = [
  `${self.location.origin}${BASE_PATH}`,
   `${self.location.origin}${BASE_PATH}/view`,
   `${self.location.origin}${BASE_PATH}/employees`,
];

// ✅ Install: pre-cache
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate new worker immediately

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn(`❌ Failed to cache: ${url}`, err);
        }
      }
    })
  );
});

// ✅ Activate: take control of all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ✅ Fetch handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);

  if (url.pathname.includes('/employees')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            try {
              cache.put(request, response.clone());
            } catch (err) {
              console.warn('⚠️ Failed to cache /employees request:', err);
            }
            return response;
          });
        })
        .catch(() => caches.match(request))
    );
  } else {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            try {
              cache.put(request, response.clone());
            } catch (err) {
              console.warn('⚠️ Failed to cache request:', err);
            }
            return response;
          });
        });
      })
    );
  }
});
