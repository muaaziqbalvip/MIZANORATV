/* Mizanora TV — service worker (app shell + offline fallback) */
const CACHE = 'mizanora-v1';
const SHELL = ['/', '/assets/css/app.css', '/assets/js/store.js', '/assets/js/demo-data.js', '/assets/img/logo.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Streams / API ko kabhi cache nahi karte
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/s/') || url.pathname.startsWith('/p/')) return;
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
            return res;
          })
          .catch(() => caches.match('/'))
    )
  );
});
