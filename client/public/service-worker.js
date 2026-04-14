const CACHE_NAME = 'sowa-v5'; // IMPORTANT: Keep in sync with client/src/lib/constants.ts SW_CACHE_NAME
const APP_SHELL = [
  '/',
  '/portal/login',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        APP_SHELL.map(url =>
          cache.add(url).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http(s) schemes (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Non-GET: try network, return offline stub if unavailable
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ queued: true, offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico');

  // Static assets: cache-first, update in background
  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // API calls: network-first, fall back to cached response
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() =>
            cache.match(request).then((cached) =>
              cached ||
              new Response(JSON.stringify({ error: 'offline', cached: false }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              })
            )
          )
      )
    );
    return;
  }

  // Navigation requests (HTML pages): cache-first (app shell), then network.
  // Always serve the cached app shell so the SPA loads even when offline.
  const isNavigation = request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        Promise.all([cache.match(request), cache.match('/')])
          .then(([cachedRoute, cachedShell]) => {
            const appShell = cachedRoute || cachedShell;
            // Background-refresh the cache for next visit
            fetch(request)
              .then((response) => {
                if (response && response.status === 200) {
                  cache.put(request, response.clone());
                }
              })
              .catch(() => {});
            // Serve cached shell immediately if available
            if (appShell) return appShell;
            // First visit (nothing cached yet) — go to network
            return fetch(request).then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            });
          })
      )
    );
    return;
  }

  // Everything else: network-first with cache fallback
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cache.match(request).then((cached) => cached || cache.match('/')))
    )
  );
});
