const CACHE_NAME = 'my-nextjs-pwa-cache-v1';


const urlsToCache = [
  '/view/page',
  '/view/offices/484f6b4c-b65d-4a73-9b0f-8b2f35a43090',
  '/view/offices/',
  '/f622687f-79c6-44e8-87c6-301a257582b2/employees' 
 
  // Add other specific URLs you want to cache
];
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Save updated response in cache
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // If network fails, use cached version
        return caches.match(event.request);
      })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.includes('/employees')) {
    // Network-first for employee data
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Default: try cache first
    event.respondWith(
      caches.match(event.request).then((response) => {
        return (
          response ||
          fetch(event.request).then((networkResponse) => {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          })
        );
      })
    );
  }
});
