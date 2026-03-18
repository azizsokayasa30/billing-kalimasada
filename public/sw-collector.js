const CACHE_NAME = 'gembok-collector-v1';
const urlsToCache = [
  '/collector/dashboard',
  '/collector/payment',
  '/collector/customers',
  '/collector/payments',
  '/collector/history',
  '/collector/profile',
  '/css/agent-pwa.css',
  '/js/agent-pwa.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// Install event
self.addEventListener('install', function(event) {
  console.log('Collector Service Worker: Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Collector Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.log('Collector Service Worker: Cache failed', error);
      })
  );
});

// Fetch event
self.addEventListener('fetch', function(event) {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) return;
  
  // Network-first strategy for collector routes
  if (event.request.url.includes('/collector/')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(response) {
            if (response) return response;
            if (event.request.mode === 'navigate') return caches.match('/collector/dashboard');
          });
        })
    );
  } else {
    // Cache-first for static assets
    event.respondWith(
      caches.match(event.request).then(function(response) {
        if (response) return response;
        return fetch(event.request).then(function(response) {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
    );
  }
});

// Activate event
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push notification handling
self.addEventListener('push', function(event) {
  const options = {
    body: event.data ? event.data.text() : 'Tugas penagihan baru tersedia',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: { dateOfArrival: Date.now(), primaryKey: 1 }
  };
  event.waitUntil(
    self.registration.showNotification('Gembok Collector', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/collector/dashboard'));
});
