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
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      // Update the cache with the latest network response
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      });
    }).catch(() => {
      // If the network is unavailable, fall back to the cache
      return caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      });
    })
  );
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
