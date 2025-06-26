const CACHE_NAME = 'my-nextjs-pwa-cache-v3';

// ✅ Immediately take control
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ✅ Clean up old caches
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

// ✅ Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ✅ Skip non-GET requests
  if (request.method !== 'GET') return;

  // ✅ Never cache Clerk/auth/sensitive routes
  const shouldBypass = [
    '/',
    '/api',
    '/auth',
    '/sign-in',
    '/sign-up',
    '/_clerk',
    'clerk',
    'supabase',
    'vercel',
  ].some((path) => url.pathname.includes(path) || request.url.includes(path));

  if (shouldBypass || request.credentials === 'include') {
    return;
  }

  // ✅ Use network-first for employee-related pages
  if ( url.pathname.includes('/employee')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ✅ Default: cache-first for assets (JS, CSS, images, etc.)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Avoid caching bad or private responses
          const contentType = response.headers.get('Content-Type') || '';
          const cacheControl = response.headers.get('Cache-Control') || '';

          const isHTML = contentType.includes('text/html');
          const isPrivate = cacheControl.includes('no-store') || cacheControl.includes('private');

          if (response.ok && !isHTML && !isPrivate) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
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
