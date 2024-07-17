const CACHE_NAME = 'my-nextjs-pwa-cache-v1';
let CURRENT_CACHE_VERSION = 1; // Initialize with a default version
let LAST_UPDATED = 0; // Initialize with a default timestamp

self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((response) => {
        return response || fetchAndUpdate(event.request);
      });
    })
  );
});

async function fetchAndUpdate(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Fetch failed; returning cached response.', error);
    return caches.match(request);
  }
}

self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('my-nextjs-pwa-cache-') && cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Periodically check for updates in the version or timestamp
  setInterval(() => {
    fetch('/api/version') // Replace with your endpoint to fetch version info
      .then((response) => response.json())
      .then((data) => {
        if (data.version > CURRENT_CACHE_VERSION || data.lastUpdated > LAST_UPDATED) {
          // Update the service worker's version information
          CURRENT_CACHE_VERSION = data.version;
          LAST_UPDATED = data.lastUpdated;

          // Clear old cache and fetch updated data
          caches.delete(CACHE_NAME).then(() => {
            caches.open(CACHE_NAME).then((cache) => {
              console.log('Cache updated with new version:', CURRENT_CACHE_VERSION);
              // Optionally, pre-cache specific URLs here
              // cache.addAll([ '/', '/index.html', '/styles.css', '/script.js', '/images/logo.png' ]);
            });
          });
        }
      })
      .catch((error) => {
        console.error('Error checking for updates:', error);
      });
  }, 60 * 60 * 1000); // Check every hour (adjust as needed)
});
