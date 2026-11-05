const CACHE = 'tajv2b-real-v4';
const SHELL = ['./', './index.html', './assets/css/styles.css', './assets/css/motion.css', './assets/js/config.js', './assets/js/books-data.js', './assets/js/icons.js', './assets/js/data.js', './assets/js/app.js', './assets/js/admin.js', './assets/js/quiz.js', './assets/js/notify.js', './assets/js/quiz-admin.js', './assets/css/quiz.css', './assets/data/content-seed.json', './assets/img/icon-192.png', './assets/img/icon-512.png', './manifest.webmanifest'];
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

// Web Push (optional; needs the owner's live setup and the VAPID key in config.js). Shows a phone notification
// with the owner's text. Works on Android/desktop browsers; on iPhone only for a site added to the Home Screen.
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (x) { data = { title: 'Paighaam-e-Tajushshariah', body: e.data ? e.data.text() : '' }; }
  const title = String(data.title || 'Paighaam-e-Tajushshariah').slice(0, 120);
  const body = String(data.body || '').slice(0, 240);
  const link = String(data.link || '#/');
  e.waitUntil(self.registration.showNotification(title, { body, icon: 'assets/img/icon-192.png', badge: 'assets/img/icon-192.png', tag: 'taj-' + (data.tag || 'note'), data: { link } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '#/';
  const url = /^https:\/\//.test(link) ? link : new URL(link, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate && c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
