const CACHE_NAME = 'familychat-v1';

const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // فقط same-origin و supabase رو کش میکنیم
  // درخواست‌های supabase realtime/websocket رو رد میکنیم
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // فقط موفق بود کش کن
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // آفلاین: از کش برگردون
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // اگه صفحه‌ای نبود، صفحه اصلی رو نشون بده
          if (request.destination === 'document') {
            return caches.match('/');
          }
        });
      })
  );
});