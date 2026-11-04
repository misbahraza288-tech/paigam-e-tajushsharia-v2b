const CACHE = 'tajv2b-v1';
const SHELL = ['./', './index.html', './assets/css/styles.css', './assets/js/config.js', './assets/js/books-data.js', './assets/js/icons.js', './assets/js/data.js', './assets/js/app.js', './assets/js/admin.js', './assets/img/logo-original.jpg', './assets/img/icon-192.png', './assets/img/icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase, YouTube, Drive and image hosts are never cached by the worker
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => hit);
    return hit || net;
  }));
});
