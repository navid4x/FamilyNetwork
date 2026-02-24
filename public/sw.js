// ── نسخه رو اینجا عوض کن تا همه منابع دوباره دانلود بشن ──
const APP_VERSION = '1.1.0';
const CACHE_NAME = `familychat-${APP_VERSION}`;

// منابع استاتیکی که حتماً باید کش بشن
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some static assets failed to cache:', err);
      });
    })
  );
  // فوری اکتیو بشه — منتظر بستن تب‌های قدیمی نمونه
  self.skipWaiting();
});

// ── Activate: حذف کش‌های قدیمی ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('familychat-') && k !== CACHE_NAME)
          .map((k) => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      console.log('[SW] Activated v' + APP_VERSION);
      return self.clients.claim();
    })
  );
});

// ── Helper: آیا URL باید کش بشه؟ ──────────────────────────────────────────
function shouldCache(url) {
  const u = new URL(url);

  // Supabase realtime / auth / storage رو کش نکن
  if (u.hostname.includes('supabase.co')) return false;

  // فقط GET بشه
  return true;
}

function isStaticAsset(url) {
  const u = new URL(url);
  return (
    u.pathname.startsWith('/_next/static/') ||
    u.pathname.startsWith('/_next/image') ||
    u.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf|css|js)$/)
  );
}

// ── Fetch strategy ─────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!shouldCache(request.url)) return;

  const url = new URL(request.url);

  // استاتیک‌ها: Cache First (خیلی سریع‌تر)
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // صفحات و بقیه: Network First با fallback به کش
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // اگر صفحه‌ای بود که کش نشده، صفحه اصلی رو برگردون
          if (request.destination === 'document') {
            return caches.match('/');
          }
          // برای فونت‌ها از گوگل — اگر کش نشده null برگردون
          return undefined;
        })
      )
  );
});

// ── Message: force update از client ───────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});