const CACHE_NAME = '__SW_CACHE_VERSION__';

// Hashed entry JS/CSS bundles that index.html directly references. These are
// REQUIRED for the login page to render offline; if any of them fail to
// cache, install rejects and the browser will retry on the next page load.
// Injected by `swVersionPlugin` in vite.config.ts (empty list in dev).
const CRITICAL_ASSETS = __SW_CRITICAL_ASSETS__;

// Other built JS/CSS/font assets (lazy-loaded chunks). Best-effort: a single
// failure does not abort install; missing items will be lazy-cached on first
// online use via the fetch handler.
const OPTIONAL_ASSETS = __SW_OPTIONAL_ASSETS__;

// HTML shell + static icons + bootstrap config that the login page depends on.
// `/` and `/portal/login` are critical (the SPA needs the cached HTML shell to
// render offline). The icons and bootstrap API response are best-effort.
const CRITICAL_SHELL = ['/', '/portal/login'];
const OPTIONAL_SHELL = [
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/api/firebase-config',
];

self.addEventListener('install', (event) => {
  const required = CRITICAL_SHELL.concat(CRITICAL_ASSETS);
  const optional = OPTIONAL_SHELL.concat(OPTIONAL_ASSETS);

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Strict: cache.addAll is atomic — if any required URL fails to fetch
      // or returns a non-2xx, the whole call rejects, install fails, and the
      // browser retries the SW install on the next page load. This guarantees
      // that an "installed" SW can actually render the login page offline.
      await cache.addAll(required);

      // Best-effort for everything else.
      await Promise.allSettled(
        optional.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  // Do NOT call skipWaiting() here — wait for the user to confirm the update.
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

// Listen for SKIP_WAITING message from the client (sent when user taps "Update now")
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

  // Navigation requests (HTML pages): network-first so users always get fresh HTML.
  // Fall back to the cached app shell when offline.
  const isNavigation = request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html');

  if (isNavigation) {
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
            cache.match(request)
              .then((cached) => cached || cache.match('/'))
          )
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
