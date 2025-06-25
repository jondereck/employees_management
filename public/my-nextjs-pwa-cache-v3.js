const CACHE_NAME = 'my-nextjs-pwa-cache-v3'; // ⬅️ bump version when changing URLs


// const urlsToCache = [
//   `${self.location.origin}/`,
  
// ];

// // ✅ Install: Pre-cache essential assets
// self.addEventListener('install', (event) => {
//   self.skipWaiting();

//   event.waitUntil(
//     caches.open(CACHE_NAME).then(async (cache) => {
//       for (const url of urlsToCache) {
//         try {
//           await cache.add(url);
//         } catch (err) {
//           console.warn(`❌ Failed to cache: ${url}`, err);
//         }
//       }
//     })
//   );
// });

// ✅ Activate: Take control and delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🗑 Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// ✅ Fetch: Cache-first with network fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);


  if (
    request.method !== 'GET' ||
    url.protocol !== 'http:' && url.protocol !== 'https:'
  ) {
    return;
  }


  // Optionally: Skip caching API or auth routes
   if (
    request.url.includes('/api') ||
    request.url.includes('clerk') ||
    request.credentials === 'include'
  ) {
    return;
  }

  // Employees: network-first
if (url.pathname.startsWith('/view') || url.pathname.includes('employee')) {
  event.respondWith(
    fetch(request)
      .then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, response.clone());
          return response;
        });
      })
      .catch(() => caches.match(request))
  );
  return;
}


  // Everything else: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        })
        .catch(() => {
          return new Response('⚠️ Offline or not cached', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
    })
  );
});
