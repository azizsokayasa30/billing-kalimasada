// Service Worker v3 - Minimal caching, NO admin/api route caching
const CACHE_NAME = 'pwa-static-v3';
const STATIC_ASSETS = ['/css/pwa.css'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
  // Force activation immediately - skip waiting
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      // Delete ALL old caches
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW v3] Deleting old cache:', k);
        return caches.delete(k);
      }))
    )
  );
  // Take control of all pages immediately
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // CRITICAL: Let ALL non-GET and ALL dynamic routes go straight to network
  if (
    req.method !== 'GET' ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/customer') ||
    url.pathname.startsWith('/technician') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/logout') ||
    url.pathname.startsWith('/voucher')
  ) {
    return;
  }

  // Only cache whitelisted static assets
  if (STATIC_ASSETS.some(asset => url.pathname === asset)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
    return;
  }

  // Everything else: network only, no caching
});
