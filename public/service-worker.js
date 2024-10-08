const CACHE_NAME = 'my-nextjs-pwa-cache-v1';


const urlsToCache = [
  '/view/page',
  '/view/offices/484f6b4c-b65d-4a73-9b0f-8b2f35a43090',
  '/view/offices/'
 
  // Add other specific URLs you want to cache
];
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      // You can pre-cache specific URLs here if needed
      cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  console.log('Service worker fetching...');
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