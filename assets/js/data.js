/* Data layer — one API, two back-ends.
   DEMO  (config.js has no URL/key): everything lives in THIS browser (localStorage). Demo login: demo / demo.
   LIVE  (config.js has URL + anon key): REST calls to the owner's own Supabase project.
         Visitors read published content; only the owner's signed-in session can write (row-level security).
   Secrets: only the anon (public) key lives in the browser. Never a service_role key. Tokens live in sessionStorage
   and are never logged. */
(function () {
  'use strict';
  var C = window.TAJ_CONFIG || {};
  var LIVE = !!(C.supabaseUrl && C.supabaseAnonKey && /^https:\/\/[^\s]+$/.test(C.supabaseUrl));
  var DKEY = 'tajv2b-demo-v2';
  var SESS = 'taj-sess';
  var CACHE = 'taj-cache-v2-';
  var IDLE_MS = 30 * 60 * 1000;
  var TIMEOUT_MS = 7000;

  var ist = function (d) { return new Date((d || new Date()).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })); };
  function ymd(d) { var x = ist(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function addDays(n) { var x = ist(); x.setDate(x.getDate() + n); return ymd(x); }
  function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function newId() { try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {} var b = []; for (var i = 0; i < 16; i++) b.push(Math.floor(Math.random() * 256)); return b.map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function nowIso() { return new Date().toISOString(); }

  // Defaults for site settings. Visible text lives in site_content (keys), never here.
  var SITE_DEFAULTS = {
    sections: { stats: true, explore: true, paigham: true, scholar: true, updates: true, media: true, about: true, history: true, tawwun: true, khidmat: true, contact: true, comments: true, taawun_bar: true },
    sizes: { mobile: 100, desktop: 100 },
    accent: 'sage',
    animations: 'full',
    stats: [{ n: 1000, suffix: '+', label: 'Resources' }, { n: 50, suffix: 'K+', label: 'Readers' }, { n: 700, suffix: '+', label: 'Quiz Questions' }, { n: 24, suffix: '/7', label: 'Access' }],
    stats_note: 'Original site ke apne claims — owner check karke badle.',
    taawun: { goal: 100000, raised: 0, title: 'Welfare project (owner naam likhega)', note: 'Placeholder goal — owner set karega. Is site par koi payment nahi hota.' },
    social: { facebook: '', instagram: '', youtube: '', x: '' },
    quizRules: [
      'DRAFT: Har sawal ka ek hi jawab chunein.',
      'DRAFT: Naam aur phone sahi likhein — sirf admin ko dikhega.',
      'DRAFT: Score naye din ke leaderboard par first name ke saath aayega.',
      'DRAFT: Quiz ka waqt owner set karega.'
    ],
    leaderboardVisible: true,
    version: '1.0.2'
  };

  function seedTables() {
    var today = ymd();
    var paigam = [];
    for (var i = -2; i <= 30; i++) {
      var d = addDays(i);
      paigam.push({ id: d, date: d, text_ur: '', text_ro: 'SAMPLE: Yahan is din ka Paigham aayega. Owner apna asli text yahan likhega.', source: 'sample — owner to replace', sample: true });
    }
    var quiz = [
      { id: 'q1', date: today, q: 'SAMPLE: Is website par kaun si library hai?', options: ['Taj Library', 'Railway Library', 'Koi library nahi'], answer: 0 },
      { id: 'q2', date: today, q: 'SAMPLE: Taj Quiz har din kab badalta hai?', options: ['Har din naya', 'Har hafte', 'Kabhi nahi'], answer: 0 },
      { id: 'q3', date: today, q: 'SAMPLE: Yeh sample quiz kiska hai?', options: ['Owner ka', 'Kisi ka nahi', 'Tab ka'], answer: 0 }
    ];
    var updates = [
      { id: 'u1', date: addDays(-1), title: 'New knowledge resource added', body: 'SAMPLE update — owner replace karein.' },
      { id: 'u2', date: addDays(-6), title: 'Taj Quiz ka naya round', body: 'SAMPLE update — owner replace karein.' },
      { id: 'u3', date: addDays(-14), title: 'Website ka naya version', body: 'SAMPLE update — owner replace karein.' }
    ];
    var gallery = [];
    for (var g = 1; g <= 6; g++) gallery.push({ id: 'g' + g, kind: 'photo', url: '', title: 'Photo slot ' + g + ' (owner photo upload kare)', tall: g % 3 === 0 });
    gallery.push({ id: 'v1', kind: 'video', youtube_id: '', title: 'Featured video (YouTube link Admin me paste karein)' });
    return { paigam: paigam, quiz_questions: quiz, updates: updates, gallery: gallery };
  }

  // ---------- DEMO storage (this browser only) ----------
  function demoAll() {
    var raw = null; try { raw = localStorage.getItem(DKEY); } catch (e) {}
    var d = raw ? JSON.parse(raw) : null;
    if (!d) {
      var s = seedTables();
      d = { books: window.TAJ_BOOKS.map(function (b) { return Object.assign({}, b); }), paigam: s.paigam, quiz_questions: s.quiz_questions,
        updates: s.updates, gallery: s.gallery, quiz_entries: [], messages: [], comments: [], site: {}, content: {}, assets: {}, history: [] };
    }
    d.site = d.site || {}; d.content = d.content || {}; d.assets = d.assets || {}; d.history = d.history || [];
    return d;
  }
  function demoSave(d) {
    try { localStorage.setItem(DKEY, JSON.stringify(d)); }
    catch (e) { throw new Error('Is phone/browser me jagah kam hai. Kuch purani photos hatayein.'); }
  }
  function applyQuery(rows, o) {
    o = o || {};
    if (o.eq) rows = rows.filter(function (r) { return Object.keys(o.eq).every(function (k) { return String(r[k]) === String(o.eq[k]); }); });
    if (o.approvedOnly) rows = rows.filter(function (r) { return r.status === 'approved'; });
    if (o.order) rows = rows.slice().sort(function (a, b) { var x = a[o.order], y = b[o.order]; return (x > y ? 1 : x < y ? -1 : 0) * (o.desc ? -1 : 1); });
    if (o.limit) rows = rows.slice(0, o.limit);
    return rows;
  }

  // ---------- LIVE helpers ----------
  function session() { try { return JSON.parse(sessionStorage.getItem(SESS) || 'null'); } catch (e) { return null; } }
  function saveSession(s) { sessionStorage.setItem(SESS, JSON.stringify(s)); }
  function jwtClaims(t) {
    try { var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(p)))); } catch (e) { return {}; }
  }
  function fetchT(url, opts) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : null;
    opts = opts || {}; opts.signal = ctl ? ctl.signal : undefined;
    return fetch(url, opts).finally(function () { if (timer) clearTimeout(timer); });
  }
  function readJson(r) {
    return r.text().then(function (t) {
      var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
      if (!r.ok) {
        var msg = (j && (j.message || j.msg || j.error_description || j.error)) || ('HTTP ' + r.status);
        var err = new Error(friendly(msg, r.status)); err.status = r.status; throw err;
      }
      return j;
    });
  }
  function friendly(msg, status) {
    if (status === 401 || status === 403) return 'Aapko ye karne ki ijazat nahi (login check karein).';
    if (/row-level|policy/i.test(msg)) return 'Ye change save nahi hua (ijazat nahi).';
    if (/rate limit|bahut zyada/i.test(msg)) return msg;
    return 'Kuch gadbad hui. Dobara try karein.';
  }
  function headers(extra) {
    var s = session();
    var h = { apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + (s && s.access_token ? s.access_token : C.supabaseAnonKey), 'Content-Type': 'application/json' };
    return Object.assign(h, extra || {});
  }
  function refreshIfNeeded() {
    var s = session();
    if (!s || !s.refresh_token || !s.expires_at || Date.now() < (s.expires_at - 60) * 1000) return Promise.resolve();
    return fetchT(C.supabaseUrl + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: C.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
      .then(readJson).then(function (j) { setTokens(j, s.email); }).catch(function () { sessionStorage.removeItem(SESS); });
  }
  function setTokens(j, email) {
    var claims = jwtClaims(j.access_token || '');
    saveSession({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)), email: email || (j.user && j.user.email) || (session() || {}).email, aal: claims.aal || 'aal1' });
  }
  function qsOf(o) {
    var p = [];
    if (o.eq) Object.keys(o.eq).forEach(function (k) { p.push(k + '=eq.' + encodeURIComponent(o.eq[k])); });
    if (o.order) p.push('order=' + o.order + (o.desc ? '.desc' : '.asc'));
    if (o.limit) p.push('limit=' + o.limit);
    p.push('select=*');
    return p.join('&');
  }
  function live(method, path, body, extra) {
    return refreshIfNeeded().then(function () {
      return fetchT(C.supabaseUrl + path, { method: method, headers: headers(extra), body: body !== undefined && body !== null ? JSON.stringify(body) : undefined }).then(readJson);
    });
  }
  // Read-cache: remember the last good answer per table so the site still shows content offline or if the backend is down.
  function cacheGet(name) { try { return JSON.parse(localStorage.getItem(CACHE + name) || 'null'); } catch (e) { return null; } }
  function cacheSet(name, v) { try { localStorage.setItem(CACHE + name, JSON.stringify(v)); } catch (e) {} }

  var VIEW = { leaderboard: 'public_leaderboard' };
  var PUBLIC_TABLES = { books: 1, paigam: 1, updates: 1, quiz_questions: 1, gallery: 1 };

  function sitePatchFromRows(settings, contentRows, assetRows) {
    var site = Object.assign({}, SITE_DEFAULTS, settings || {});
    site.texts = {}; site.assets = {};
    (contentRows || []).forEach(function (r) { site.texts[r.key] = { text: r.value }; });
    (assetRows || []).forEach(function (r) { site.assets[r.key] = r.url; });
    site.hero_url = site.assets['home.hero.image'] || '';
    site.logo_url = site.assets['logo'] || '';
    return site;
  }

  var Store = {
    mode: LIVE ? 'live' : 'demo',
    live: LIVE,

    // ----- public site (content + settings + assets) with cached fallback -----
    getSite: function () {
      if (!LIVE) {
        var d = demoAll();
        var texts = Object.keys(d.content).map(function (k) { return { key: k, value: d.content[k] }; });
        var assets = Object.keys(d.assets).map(function (k) { return { key: k, url: d.assets[k] }; });
        return Promise.resolve(sitePatchFromRows(d.site, texts, assets));
      }
      return Promise.all([
        fetchT(C.supabaseUrl + '/rest/v1/site_settings?id=eq.site&select=value').then(readJson),
        fetchT(C.supabaseUrl + '/rest/v1/site_content?select=key,value').then(readJson),
        fetchT(C.supabaseUrl + '/rest/v1/site_assets?select=key,url').then(readJson)
      ]).then(function (r) {
        var site = sitePatchFromRows(r[0][0] && r[0][0].value, r[1], r[2]);
        cacheSet('site', { settings: r[0][0] && r[0][0].value, content: r[1], assets: r[2], at: nowIso() });
        return site;
      }).catch(function () {
        var c = cacheGet('site');
        var site = c ? sitePatchFromRows(c.settings, c.content, c.assets) : sitePatchFromRows({}, [], []);
        site.offline = true; site.cached_at = c && c.at;
        return site;
      });
    },

    // ----- tables -----
    list: function (table, o) {
      o = o || {};
      if (!LIVE) {
        var d = demoAll();
        if (table === 'leaderboard') {
          var rows = applyQuery(d.quiz_entries, { eq: o.eq, order: 'score', desc: true, limit: o.limit || 10 });
          return Promise.resolve(rows.map(function (r) { return { id: r.id, first_name: r.first_name, score: r.score, date: r.date }; }));
        }
        return Promise.resolve(applyQuery(d[table] || [], o));
      }
      var t = VIEW[table] || table;
      var path = '/rest/v1/' + t + '?' + qsOf(o);
      if (PUBLIC_TABLES[table] || table === 'leaderboard') {
        var key = table + JSON.stringify(o);
        return live('GET', path).then(function (rows) { cacheSet(key, rows); return rows; })
          .catch(function (e) { var c = cacheGet(key); if (c) return c; throw e; });
      }
      return live('GET', path);
    },
    // Insert one row. The id is made here (visitors cannot read back what they wrote, so no RETURNING).
    insert: function (table, row) {
      row = Object.assign({}, row);
      if (!LIVE) {
        var d = demoAll(); row.id = row.id || uid(); row.created = row.created || nowIso();
        d[table].push(row); demoSave(d); return Promise.resolve(row);
      }
      row.id = row.id || newId();
      return live('POST', '/rest/v1/' + table, row, { Prefer: 'return=minimal' }).then(function () { return row; });
    },
    // Upsert by primary key (owner tables with a full-access policy).
    upsert: function (table, row) {
      row = Object.assign({}, row);
      if (!LIVE) {
        var d = demoAll(); row.id = row.id || uid();
        var i = d[table].findIndex(function (x) { return String(x.id) === String(row.id); });
        if (i >= 0) d[table][i] = Object.assign({}, d[table][i], row); else { row.created = row.created || nowIso(); d[table].push(row); }
        demoSave(d); return Promise.resolve(row);
      }
      return live('POST', '/rest/v1/' + table + '?on_conflict=id', row, { Prefer: 'resolution=merge-duplicates,return=representation' }).then(function (r) { return r && r[0]; });
    },
    // Patch one row by id (used for visitor-inserted rows that the owner only moderates).
    update: function (table, id, patch) {
      if (!LIVE) {
        var d = demoAll(); var i = d[table].findIndex(function (x) { return String(x.id) === String(id); });
        if (i >= 0) { d[table][i] = Object.assign({}, d[table][i], patch); demoSave(d); }
        return Promise.resolve(true);
      }
      return live('PATCH', '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), patch, { Prefer: 'return=minimal' });
    },
    remove: function (table, id) {
      if (!LIVE) { var d = demoAll(); d[table] = d[table].filter(function (x) { return String(x.id) !== String(id); }); demoSave(d); return Promise.resolve(true); }
      return live('DELETE', '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), null, { Prefer: 'return=minimal' });
    },

    // ----- content (every visible text, keyed) -----
    setText: function (key, value) {
      if (!LIVE) {
        var d = demoAll(); var old = Object.prototype.hasOwnProperty.call(d.content, key) ? d.content[key] : null;
        d.content[key] = value;
        d.history.unshift({ id: uid(), key: key, old_value: old, new_value: value, changed_at: nowIso() });
        d.history = d.history.slice(0, 300); demoSave(d); return Promise.resolve(true);
      }
      return live('POST', '/rest/v1/site_content?on_conflict=key', { key: key, value: String(value == null ? '' : value) }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    },
    removeText: function (key) {
      if (!LIVE) {
        var d = demoAll(); var had = Object.prototype.hasOwnProperty.call(d.content, key);
        if (had) { var old = d.content[key]; delete d.content[key]; d.history.unshift({ id: uid(), key: key, old_value: old, new_value: null, changed_at: nowIso() }); demoSave(d); }
        return Promise.resolve(true);
      }
      return live('DELETE', '/rest/v1/site_content?key=eq.' + encodeURIComponent(key), null, { Prefer: 'return=minimal' });
    },
    setAsset: function (key, url) {
      if (!LIVE) { var d = demoAll(); d.assets[key] = url; demoSave(d); return Promise.resolve(true); }
      return live('POST', '/rest/v1/site_assets?on_conflict=key', { key: key, url: url }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    },
    removeAsset: function (key) {
      if (!LIVE) { var d = demoAll(); delete d.assets[key]; demoSave(d); return Promise.resolve(true); }
      return live('DELETE', '/rest/v1/site_assets?key=eq.' + encodeURIComponent(key), null, { Prefer: 'return=minimal' });
    },
    // Change history (newest first) and one-tap undo of a single change.
    history: function (limit) {
      if (!LIVE) return Promise.resolve(demoAll().history.slice(0, limit || 100));
      return live('GET', '/rest/v1/content_history?select=*&order=changed_at.desc&limit=' + (limit || 100));
    },
    undo: function (h) {
      if (!LIVE) {
        var d = demoAll(); var key = h.key;
        if (h.old_value === null || h.old_value === undefined) delete d.content[key]; else d.content[key] = h.old_value;
        d.history.unshift({ id: uid(), key: key, old_value: h.new_value, new_value: h.old_value, changed_at: nowIso(), undo: true });
        demoSave(d); return Promise.resolve(true);
      }
      var p = (h.old_value === null || h.old_value === undefined)
        ? live('DELETE', '/rest/v1/site_content?key=eq.' + encodeURIComponent(h.key), null, { Prefer: 'return=minimal' })
        : live('POST', '/rest/v1/site_content?on_conflict=key', { key: h.key, value: h.old_value }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
      return p;
    },

    // ----- site settings (sections, accent, stats, ta'awun, social, rules, sizes) -----
    saveSite: function (patch) {
      return Store.getSite().then(function (cur) {
        var base = {}; Object.keys(SITE_DEFAULTS).forEach(function (k) { base[k] = cur[k]; });
        var next = Object.assign(base, patch);
        if (!LIVE) { var d = demoAll(); d.site = Object.assign({}, d.site, patch); demoSave(d); return Object.assign(cur, next); }
        return live('POST', '/rest/v1/site_settings?on_conflict=id', { id: 'site', value: next }, { Prefer: 'resolution=merge-duplicates,return=minimal' })
          .then(function () { return Object.assign(cur, next); });
      });
    },

    // ----- owner login (email = the owner's ID; password set by the owner) -----
    // Resolves { ok:true } or { mfa:true, factorId } when a 2FA code is needed.
    login: function (email, password) {
      if (!LIVE) {
        if (email === 'demo' && password === 'demo') { saveSession({ access_token: 'demo', email: 'demo', demo: true, aal: 'aal1', expires_at: 9999999999 }); return Promise.resolve({ ok: true }); }
        return Promise.reject(new Error('Demo login: user "demo", password "demo".'));
      }
      return fetchT(C.supabaseUrl + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: C.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: password }) })
        .then(function (r) { return readJson(r); })
        .then(function (j) {
          var tmp = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600), email: email, aal: 'aal1' };
          return fetchT(C.supabaseUrl + '/auth/v1/user', { headers: { apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + j.access_token } }).then(readJson).then(function (u) {
            var f = (u.factors || []).filter(function (x) { return x.status === 'verified'; })[0];
            if (f) { saveSession(tmp); return { mfa: true, factorId: f.id }; }
            saveSession(tmp); return { ok: true };
          });
        }, function () { throw new Error('Email ya password galat hai.'); });
    },
    // 2FA: challenge + verify with the 6-digit code from the authenticator app.
    verifyMfa: function (factorId, code) {
      if (!LIVE) return Promise.resolve({ ok: true });
      var s = session();
      return fetchT(C.supabaseUrl + '/auth/v1/factors/' + factorId + '/challenge', { method: 'POST', headers: headers(), body: '{}' }).then(readJson).then(function (c) {
        return fetchT(C.supabaseUrl + '/auth/v1/factors/' + factorId + '/verify', { method: 'POST', headers: headers(), body: JSON.stringify({ challenge_id: c.id, code: String(code).replace(/\s/g, '') }) }).then(readJson);
      }).then(function (j) { setTokens(j, s && s.email); return { ok: true }; });
    },
    // 2FA enrolment: returns { id, qr (data URL), secret }.
    enrollMfa: function () {
      if (!LIVE) return Promise.resolve({ id: 'demo', qr: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/><rect x="1" y="1" width="3" height="3"/><rect x="6" y="6" width="3" height="3"/></svg>'), secret: 'DEMO-ONLY-NO-SECRET' });
      return refreshIfNeeded().then(function () {
        return fetchT(C.supabaseUrl + '/auth/v1/factors', { method: 'POST', headers: headers(), body: JSON.stringify({ factor_type: 'totp', friendly_name: 'owner-' + Date.now().toString(36) }) }).then(readJson).then(function (j) {
          var qr = j.totp && j.totp.qr_code ? j.totp.qr_code : '';
          return { id: j.id, qr: qr.indexOf('<svg') === 0 ? 'data:image/svg+xml;utf8,' + encodeURIComponent(qr) : qr, secret: j.totp && j.totp.secret };
        });
      });
    },
    enrollMfaVerify: function (factorId, code) {
      if (!LIVE) return Promise.resolve(true);
      return fetchT(C.supabaseUrl + '/auth/v1/factors/' + factorId + '/challenge', { method: 'POST', headers: headers(), body: '{}' }).then(readJson).then(function (c) {
        return fetchT(C.supabaseUrl + '/auth/v1/factors/' + factorId + '/verify', { method: 'POST', headers: headers(), body: JSON.stringify({ challenge_id: c.id, code: String(code).replace(/\s/g, '') }) }).then(readJson);
      }).then(function (j) { var s = session(); setTokens(j, s && s.email); return true; });
    },
    mfaStatus: function () {
      if (!LIVE) return Promise.resolve({ enrolled: false, demo: true });
      return live('GET', '/auth/v1/user').then(function (u) { return { enrolled: (u.factors || []).some(function (f) { return f.status === 'verified'; }) }; });
    },
    logout: function () {
      var s = session();
      if (LIVE && s && s.access_token) { fetchT(C.supabaseUrl + '/auth/v1/logout', { method: 'POST', headers: headers() }).catch(function () {}); }
      sessionStorage.removeItem(SESS);
    },
    session: function () { return session(); },

    // ----- media -----
    // Compressed JPEG/PNG/WebP blob -> public URL. Demo: a data URL kept in this browser.
    upload: function (blob, name) {
      if (!LIVE) return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { rej(new Error('File nahi padhi gayi')); }; fr.readAsDataURL(blob); });
      var path = 'site/' + Date.now().toString(36) + '-' + String(name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) + '.jpg';
      return refreshIfNeeded().then(function () {
        return fetchT(C.supabaseUrl + '/storage/v1/object/media/' + path, { method: 'POST', headers: { apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + (session() || {}).access_token, 'Content-Type': blob.type || 'image/jpeg' }, body: blob })
          .then(function (r) { if (!r.ok) throw new Error('Photo upload nahi hua (ijazat ya size check karein).'); return C.supabaseUrl + '/storage/v1/object/public/media/' + path; });
      });
    },

    // Whole-site export for backup (owner only in live mode).
    exportAll: function () {
      var tables = ['books', 'paigam', 'updates', 'quiz_questions', 'gallery'];
      var owner = { exported_at: nowIso(), mode: LIVE ? 'live' : 'demo' };
      if (!LIVE) { var d = demoAll(); tables.forEach(function (t) { owner[t] = d[t]; }); owner.site = d.site; owner.content = d.content; owner.assets = d.assets; return Promise.resolve(owner); }
      return Promise.all([Store.getSite(), Store.list('books'), Store.list('paigam'), Store.list('updates'), Store.list('quiz_questions'), Store.list('gallery')]).then(function (r) {
        owner.site_settings = r[0]; owner.books = r[1]; owner.paigam = r[2]; owner.updates = r[3]; owner.quiz_questions = r[4]; owner.gallery = r[5];
        return owner;
      });
    },
    resetDemo: function () { localStorage.removeItem(DKEY); },
    SITE_DEFAULTS: SITE_DEFAULTS,
    IDLE_MS: IDLE_MS,
    ymd: ymd, addDays: addDays, uid: uid
  };
  window.TajStore = Store;
})();
