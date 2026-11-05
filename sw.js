const CACHE = 'tajv2b-real-v3';
const SHELL = ['./', './index.html', './assets/css/styles.css', './assets/css/motion.css', './assets/js/config.js', './assets/js/books-data.js', './assets/js/icons.js', './assets/js/data.js', './assets/js/app.js', './assets/js/admin.js', './assets/data/content-seed.json', './assets/img/icon-192.png', './assets/img/icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Network first, so a change the owner saves (or a new config.js after going live) reaches visitors at once.
// The cache is only the fallback for when the phone is offline. Supabase and other hosts are never cached.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => caches.match(req)));
});
