const CACHE_NAME = 'sowa-v1.1';
// Only cache assets that exist in both development and production
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Opened cache');
        // Cache basic assets, ignore failures for flexibility
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => console.log('SW: Failed to cache:', url))
          )
        );
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request).then((response) => {
          // Only cache successful responses
          if (!response || response.status !== 200) {
            return response;
          }
          
          // Cache static assets (JS, CSS, images, fonts)
          const url = new URL(event.request.url);
          const shouldCache = 
            url.origin === location.origin && (
              event.request.url.includes('/assets/') ||
              event.request.url.endsWith('.js') ||
              event.request.url.endsWith('.css') ||
              event.request.url.endsWith('.png') ||
              event.request.url.endsWith('.jpg') ||
              event.request.url.endsWith('.woff2')
            );
          
          if (shouldCache) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          
          return response;
        }).catch(() => {
          // Return offline page if available
          return caches.match('/');
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
