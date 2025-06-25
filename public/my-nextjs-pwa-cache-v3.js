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
// ✅ Activate: Delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// ✅ Skip waiting immediately (optional, forces update)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ✅ Fetch: Cache-first with Clerk/auth safety
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // ✅ Skip sensitive or auth-related requests
  const skipCache = [
    '/api',
    '/auth',
    '/sign-in',
    '/sign-up',
    '/_clerk',
    'clerk',
    'supabase',
    'vercel',
  ].some((skip) => request.url.includes(skip));

  if (
    skipCache ||
    request.credentials === 'include'
  ) {
    return;
  }

  // ✅ Employees: Network-first strategy
  if (url.pathname.startsWith('/view') || url.pathname.includes('employee')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
              return response;
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ✅ Everything else: Cache-first strategy
 event.respondWith(
  caches.match(request).then((cached) => {
    if (cached) return cached;

    return fetch(request)
      .then((response) => {
        // ✅ Must clone before any usage
        const clonedResponse = response.clone();

        // Skip bad responses
        if (
          !response || 
          response.status !== 200 || 
          response.type === 'opaque'
        ) {
          return response;
        }

        // Avoid caching private responses
        const cacheControl = response.headers.get('Cache-Control') || '';
        const isPrivate = cacheControl.includes('no-store') || cacheControl.includes('private');

        if (!isPrivate) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
        }

        return response;
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