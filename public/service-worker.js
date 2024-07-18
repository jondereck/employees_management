const CACHE_NAME = 'my-nextjs-pwa-cache-v1';

self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      // You can pre-cache specific URLs here if needed
      // cache.addAll([ '/', '/index.html', '/styles.css', '/script.js', '/images/logo.png' ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  console.log('Service worker fetching...');

  // Define URLs or patterns to exclude from caching
  const excludedUrls = ['sign-in', 'sign-up'];

  // Check if the request URL contains any of the excluded patterns
  const shouldExclude = excludedUrls.some(urlPattern => event.request.url.includes(urlPattern));

  if (shouldExclude) {
    // If the request should be excluded, just fetch it from the network
    event.respondWith(fetch(event.request));
  } else {
    // Otherwise, follow the caching strategy
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return response || fetchPromise;
        });
      })
    );
  }
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
