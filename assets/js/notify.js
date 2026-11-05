/* Notifications: the in-site bell (works with no setup) and an optional Web Push opt-in (live mode with a VAPID key).
   Visitors read notifications whose time has come (the database filters it in live mode). Unread = newer than the
   last time this phone opened the bell. Everything from the database goes through esc(). */
(function () {
  'use strict';
  var St = window.TajStore;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var SEEN = 'taj-notes-seen';
  var LIST = [];
  var $ = function (s) { return document.querySelector(s); };
  function nowMs() { return St.now(); }
  function ts(s) { return Date.parse(String(s).replace(/(\.\d{3})\d+/, '$1')); }
  function visible() {
    var t = nowMs();
    return LIST.filter(function (n) { return ts(n.publish_at) <= t; }).sort(function (a, b) { return ts(b.publish_at) - ts(a.publish_at); }).slice(0, 40);
  }
  function unreadCount() {
    var seen = +(localStorage.getItem(SEEN) || 0);
    return visible().filter(function (n) { return ts(n.publish_at) > seen; }).length;
  }
  function badge() {
    var n = unreadCount(); var b = $('#bell-count'); if (!b) return;
    b.textContent = n > 9 ? '9+' : String(n); b.hidden = !n;
    var btn = $('#bell-btn'); if (btn) btn.setAttribute('aria-label', 'Notifications' + (n ? ', ' + n + ' naye' : ''));
  }
  function load() {
    return St.list('notifications', { order: 'publish_at', desc: true, limit: 60 }).then(function (rows) { LIST = rows || []; badge(); }).catch(function () { badge(); });
  }
  function fmt(s) { try { return new Date(ts(s)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function safeLink(u) { u = String(u || '').trim(); if (/^#\//.test(u)) return u; if (/^https:\/\//i.test(u)) return u; return ''; }
  function listHtml() {
    var v = visible();
    if (!v.length) return '<div class="empty">Abhi koi notification nahi. Quiz, Paigham ya update aate hi yahan dikhega.</div>';
    return '<ul class="notes-list">' + v.map(function (n) {
      var l = safeLink(n.link);
      return '<li class="note ' + esc(n.kind || '') + '"><span class="note-k">' + esc(n.kind || 'site') + '</span><b>' + esc(n.title) + '</b>' +
        (n.body ? '<p>' + esc(n.body) + '</p>' : '') + '<div class="note-foot"><small class="muted">' + esc(fmt(n.publish_at)) + '</small>' +
        (l ? '<a class="btn ghost sm" href="' + esc(l) + '" data-note-go>Dekhein</a>' : '') + '</div></li>';
    }).join('') + '</ul>';
  }
  function pushHtml() {
    if (St.pushReady && St.pushReady()) {
      return '<div class="notes-push"><button class="btn ghost sm" id="push-on" type="button">Phone par alert chahiye</button><p class="small muted" id="push-msg">iPhone par ye tabhi chalega jab site Home Screen par Add ho.</p></div>';
    }
    return '<p class="small muted notes-push">Phone par alert (push) live setup ke baad milega. Bell ye sab bina setup ke dikhata hai.</p>';
  }
  function open() {
    var p = $('#notes'); if (!p) return;
    p.querySelector('.notes-body').innerHTML = listHtml() + pushHtml();
    p.hidden = false; requestAnimationFrame(function () { p.classList.add('on'); });
    localStorage.setItem(SEEN, String(nowMs()));
    badge();
    var po = $('#push-on'); if (po) po.onclick = enablePush;
    p.querySelectorAll('[data-note-go]').forEach(function (a) { a.onclick = function () { close(); }; });
  }
  function close() { var p = $('#notes'); if (!p) return; p.classList.remove('on'); setTimeout(function () { p.hidden = true; }, 220); }
  function b64ToU8(b64) { var pad = '='.repeat((4 - b64.length % 4) % 4); var s = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); var out = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
  function enablePush() {
    var msg = $('#push-msg');
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) { msg.textContent = 'Is phone/browser par push nahi chalta. iPhone par pehle Home Screen par Add karein.'; return; }
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { msg.textContent = 'Permission nahi mili. Phone ki settings me site ki notification on karein.'; return null; }
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription().then(function (old) {
          return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(St.vapidKey()) });
        });
      }).then(function (sub) { return St.pushSubscribe(sub.toJSON()); })
        .then(function () { msg.textContent = 'Alert on ho gaya. Owner jab bhejega, aapke phone par aayega.'; })
        .catch(function () { msg.textContent = 'Alert on nahi ho paya. Thodi der baad dobara try karein.'; });
    });
  }
  function init() {
    var b = $('#bell-btn'); if (!b) return;
    b.onclick = function () { open(); };
    var c = $('#notes-close'); if (c) c.onclick = close;
    var p = $('#notes'); if (p) p.addEventListener('click', function (e) { if (e.target === p) close(); });
    load();
    setInterval(function () { load(); }, 60000);
    setInterval(badge, 20000);
    window.addEventListener('hashchange', function () { close(); });
  }
  window.TajNotify = { init: init, load: load, open: open, close: close, unread: unreadCount, visible: visible };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
