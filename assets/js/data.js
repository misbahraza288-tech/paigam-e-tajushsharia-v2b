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
    // Quiz PRO switches (owner sets them in Admin > Quiz). Server enforces them too.
    quiz_enabled: true,
    leaderboard_public: true,
    leaderboard_live: false,
    leaderboard_top: 10,
    leaderboard_show_city: false,
    // Which events create a bell notification by themselves (Admin > Alerts).
    auto: { quiz_scheduled: true, quiz_soon: true, quiz_started: true, update: true, paigam: false, book: false },
    version: '1.0.2'
  };
  var DEMO_TABLES = { quiz_rounds: [], quiz_items: [], quiz_keys: [], quiz_attempts: [], notifications: [], push_subscriptions: [] };

  function seedTables() {
    var today = ymd();
    var paigam = [];
    for (var i = -2; i <= 30; i++) {
      var d = addDays(i);
      paigam.push({ id: d, date: d, text_ur: '', text_ro: 'SAMPLE: Yahan is din ka Paigham aayega. Owner apna asli text yahan likhega.', source: 'sample — owner to replace', sample: true });
    }
    // One SAMPLE round (starts tomorrow, 1 hour). Every question says SAMPLE — the owner replaces them.
    var roundId = 'demo-round-1';
    var start = new Date(Date.now() + 24 * 3600 * 1000); var end = new Date(start.getTime() + 3600 * 1000);
    var rounds = [{ id: roundId, title: 'SAMPLE round — owner replace', starts_at: start.toISOString(), ends_at: end.toISOString(), published: true, show_leaderboard: true }];
    var items = [
      { id: 'demo-q1', round_id: roundId, sort: 1, q: 'SAMPLE: Is website par kaun si library hai?', options: ['Taj Library', 'Railway Library', 'Koi library nahi', 'Kuch aur'] },
      { id: 'demo-q2', round_id: roundId, sort: 2, q: 'SAMPLE: Taj Quiz har din kab badalta hai?', options: ['Har din naya', 'Har hafte', 'Kabhi nahi', 'Pata nahi'] },
      { id: 'demo-q3', round_id: roundId, sort: 3, q: 'SAMPLE: Yeh sample quiz kiska hai?', options: ['Owner ka', 'Kisi ka nahi', 'Tab ka', 'Koi aur'] }
    ];
    var keys = [
      { item_id: 'demo-q1', correct: 0, explanation: 'SAMPLE — owner to replace' },
      { item_id: 'demo-q2', correct: 0, explanation: 'SAMPLE — owner to replace' },
      { item_id: 'demo-q3', correct: 0, explanation: 'SAMPLE — owner to replace' }
    ];
    var notes = [{ id: 'demo-n1', kind: 'custom', title: 'SAMPLE notification — owner replace', body: 'Yeh bell ka demo hai.', link: '#/quiz', publish_at: new Date(Date.now() - 3600 * 1000).toISOString(), created: nowIso() }];
    var updates = [
      { id: 'u1', date: addDays(-1), title: 'New knowledge resource added', body: 'SAMPLE update — owner replace karein.' },
      { id: 'u2', date: addDays(-6), title: 'Taj Quiz ka naya round', body: 'SAMPLE update — owner replace karein.' },
      { id: 'u3', date: addDays(-14), title: 'Website ka naya version', body: 'SAMPLE update — owner replace karein.' }
    ];
    var gallery = [];
    for (var g = 1; g <= 6; g++) gallery.push({ id: 'g' + g, kind: 'photo', url: '', title: 'Photo slot ' + g + ' (owner photo upload kare)', tall: g % 3 === 0 });
    gallery.push({ id: 'v1', kind: 'video', youtube_id: '', title: 'Featured video (YouTube link Admin me paste karein)' });
    return { paigam: paigam, updates: updates, gallery: gallery, quiz_rounds: rounds, quiz_items: items, quiz_keys: keys, notifications: notes };
  }

  // Demo mirror of the database triggers in schema.sql: which events make a bell notification by themselves.
  function demoAutoSettings(d) { return Object.assign({ quiz_scheduled: true, quiz_soon: true, quiz_started: true, update: true, paigam: false, book: false }, (d.site && d.site.auto) || {}); }
  function demoPutNote(d, key, n, setPublish) {
    var i = d.notifications.findIndex(function (x) { return x.source_key === key; });
    if (i >= 0) { d.notifications[i] = Object.assign({}, d.notifications[i], { title: n.title, body: n.body || '', link: n.link }); if (setPublish) d.notifications[i].publish_at = n.publish_at; return; }
    d.notifications.push({ id: uid(), kind: n.kind, title: n.title, body: n.body || '', link: n.link, publish_at: n.publish_at, source_key: key, created: nowIso() });
  }
  function demoAutoNotes(d, table, row) {
    var auto = demoAutoSettings(d);
    if (table === 'updates' && auto.update) demoPutNote(d, 'update:' + row.id, { kind: 'update', title: 'Naya update: ' + row.title, body: String(row.body || '').slice(0, 300), link: '#/updates', publish_at: nowIso() });
    if (table === 'books' && auto.book) demoPutNote(d, 'book:' + row.id, { kind: 'book', title: 'Nayi kitab: ' + row.title_en, body: row.writer_en || '', link: '#/library', publish_at: nowIso() });
    if (table === 'paigam' && !row.sample && auto.paigam) demoPutNote(d, 'paigam:' + row.date, { kind: 'paigham', title: 'Aaj ka Paigham aa gaya', body: String(row.text_ro || '').slice(0, 300), link: '#/paigham', publish_at: new Date(row.date + 'T00:00:00+05:30').toISOString() }, true);
    if (table === 'quiz_rounds') demoRoundNotes(d, row);
  }
  function demoRoundNotes(d, r) {
    var auto = demoAutoSettings(d); var pre = 'quiz:' + r.id + ':';
    if (!r.published) { d.notifications = d.notifications.filter(function (x) { return String(x.source_key || '').indexOf(pre) !== 0; }); return; }
    var t0 = parseTs(r.starts_at); var when = 'Shuru: ' + new Date(t0 + IST_OFF_MS).toISOString().slice(0, 16).replace('T', ' ') + ' IST';
    if (auto.quiz_scheduled) demoPutNote(d, pre + 'scheduled', { kind: 'quiz', title: 'Naya Taj Quiz: ' + r.title, body: when, link: '#/quiz', publish_at: nowIso() });
    if (auto.quiz_soon) demoPutNote(d, pre + 'soon', { kind: 'quiz', title: 'Quiz thodi der me shuru: ' + r.title, body: 'Round 10 minute me shuru hoga. Tayyar rahein.', link: '#/quiz', publish_at: new Date(t0 - 600000).toISOString() }, true);
    if (auto.quiz_started) demoPutNote(d, pre + 'started', { kind: 'quiz', title: 'Quiz shuru ho gaya: ' + r.title, body: 'Abhi jawab dein. Ek hi baar mauka hai.', link: '#/quiz', publish_at: new Date(t0).toISOString() }, true);
  }
  var IST_OFF_MS = 19800000;

  // ---------- DEMO storage (this browser only) ----------
  function demoAll() {
    var raw = null; try { raw = localStorage.getItem(DKEY); } catch (e) {}
    var d = raw ? JSON.parse(raw) : null;
    if (!d) {
      var s = seedTables();
      d = { books: window.TAJ_BOOKS.map(function (b) { return Object.assign({}, b); }), paigam: s.paigam,
        updates: s.updates, gallery: s.gallery, quiz_rounds: s.quiz_rounds, quiz_items: s.quiz_items, quiz_keys: s.quiz_keys,
        quiz_attempts: [], notifications: s.notifications, push_subscriptions: [], messages: [], comments: [], site: {}, content: {}, assets: {}, history: [] };
    }
    // Older demo data (before quiz PRO) gets the new collections added once, without losing anything.
    Object.keys(DEMO_TABLES).forEach(function (k) { if (!d[k]) d[k] = JSON.parse(JSON.stringify(DEMO_TABLES[k])); });
    if (!raw) { try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch (e) {} }   // first visit keeps its sample data

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
        var err = new Error(friendly(msg, r.status)); err.status = r.status; err.raw = String(msg); throw err;
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

  var VIEW = {};
  var PUBLIC_TABLES = { books: 1, paigam: 1, updates: 1, gallery: 1, quiz_rounds: 1, quiz_items: 1, notifications: 1 };

  // ----- clock: the server's clock in live mode; in demo mode an injectable offset (tests and previews only) -----
  var serverOffset = 0;
  function demoOffset() { try { return +localStorage.getItem('taj-demo-offset') || 0; } catch (e) { return 0; } }
  function parseTs(s) { return Date.parse(String(s).replace(/(\.\d{3})\d+/, '$1')); }
  // The quiz refusals come back as short codes; the UI maps them to Hinglish lines.
  function codeError(code) { var e = new Error(code); e.raw = code; return e; }
  function isOwnerDemo() { var s = session(); return !!(s && s.demo); }
  var QUIZ_SETTING_KEYS = ['quiz_enabled', 'leaderboard_public', 'leaderboard_live', 'leaderboard_top', 'leaderboard_show_city'];
  function roundStatus(r, now) {
    if (!r.published) return 'draft';
    if (now < parseTs(r.starts_at)) return 'scheduled';
    if (now < parseTs(r.ends_at)) return 'live';
    return 'ended';
  }
  function demoSettings(d) { var s = {}; Object.keys(SITE_DEFAULTS).forEach(function (k) { s[k] = SITE_DEFAULTS[k]; }); Object.keys(d.site || {}).forEach(function (k) { s[k] = d.site[k]; }); return s; }
  // Demo stand-ins for the database functions (same rules as schema.sql, checked by the same tests in spirit).
  function demoRpc(name, a, d) {
    var now = Store.now(); var st = demoSettings(d);
    if (name === 'quiz_state') {
      return { server_now: new Date(now).toISOString(), enabled: st.quiz_enabled !== false, leaderboard_public: st.leaderboard_public !== false,
        leaderboard_live: !!st.leaderboard_live, leaderboard_top: +st.leaderboard_top || 10, leaderboard_show_city: !!st.leaderboard_show_city,
        rounds: d.quiz_rounds.filter(function (r) { return r.published; }).sort(function (x, y) { return parseTs(x.starts_at) - parseTs(y.starts_at); }).map(function (r) {
          return { id: r.id, title: r.title, starts_at: r.starts_at, ends_at: r.ends_at, status: roundStatus(r, now), show_leaderboard: r.show_leaderboard !== false,
            items: d.quiz_items.filter(function (i) { return i.round_id === r.id; }).length };
        }) };
    }
    var r = d.quiz_rounds.filter(function (x) { return x.id === a.p_round || x.id === a.round_id; })[0];
    if (name === 'quiz_submit') {
      if (a.p_hp) throw codeError('bot');
      if (st.quiz_enabled === false) throw codeError('quiz_off');
      if (!r || !r.published) throw codeError('round_missing');
      if (now < parseTs(r.starts_at)) throw codeError('not_open_yet');
      if (now >= parseTs(r.ends_at)) throw codeError('quiz_ended');
      var name2 = String(a.p_name || '').replace(/\s+/g, ' ').trim();
      if (name2.length < 2 || name2.length > 80) throw codeError('bad_name');
      var addr = String(a.p_address || '').trim();
      if (addr.length < 5 || addr.length > 300) throw codeError('bad_address');
      var phone = String(a.p_phone || '').replace(/\D/g, '');
      if (phone.length === 12 && phone.slice(0, 2) === '91') phone = phone.slice(2);
      if (phone.length === 11 && phone[0] === '0') phone = phone.slice(1);
      if (phone.length !== 10) throw codeError('bad_phone');
      var items = d.quiz_items.filter(function (i) { return i.round_id === r.id; }).sort(function (x, y) { return x.sort - y.sort; });
      var ans = a.p_answers || [];
      if (!items.length || ans.length !== items.length || ans.some(function (x) { return !(x >= 0 && x <= 3); })) throw codeError('bad_answers');
      if (d.quiz_attempts.some(function (x) { return x.round_id === r.id && x.phone_norm === phone; })) throw codeError('already_submitted');
      var score = 0; items.forEach(function (it, i) { var k = d.quiz_keys.filter(function (kk) { return kk.item_id === it.id; })[0]; if (k && ans[i] === k.correct) score++; });
      var row = { id: uid(), round_id: r.id, phone_norm: phone, name: name2, address: addr, city: String(a.p_city || '').trim().slice(0, 60) || null,
        answers: ans.slice(), score: score, total: items.length, winner: false, pinned: false, hidden: false, submitted_at: new Date(now).toISOString() };
      d.quiz_attempts.push(row); demoSave(d);
      return { ok: true, score: score, total: items.length };
    }
    if (name === 'quiz_reveal') {
      if (!r || !r.published) throw codeError('round_missing');
      if (!(isOwnerDemo() || now >= parseTs(r.ends_at))) throw codeError('not_ended');
      return { round: r.title, items: d.quiz_items.filter(function (i) { return i.round_id === r.id; }).sort(function (x, y) { return x.sort - y.sort; }).map(function (i) {
        var k = d.quiz_keys.filter(function (kk) { return kk.item_id === i.id; })[0] || {};
        return { id: i.id, q: i.q, options: i.options, correct: k.correct, explanation: k.explanation || null }; }) };
    }
    if (name === 'quiz_leaderboard') {
      if (!r || !r.published) return [];
      var owner = isOwnerDemo();
      if (!owner) {
        if (r.show_leaderboard === false || st.leaderboard_public === false) return [];
        if (now < parseTs(r.ends_at) && !st.leaderboard_live) return [];
      }
      var rows = d.quiz_attempts.filter(function (x) { return x.round_id === r.id && (owner || !x.hidden); })
        .sort(function (x, y) { return (y.pinned - x.pinned) || (y.score - x.score) || (parseTs(x.submitted_at) - parseTs(y.submitted_at)); });
      return rows.slice(0, +st.leaderboard_top || 10).map(function (x, i) { return { rank: i + 1, first_name: x.name.split(' ')[0], city: st.leaderboard_show_city ? (x.city || null) : null, score: x.score, total: x.total, winner: !!x.winner, pinned: !!x.pinned }; });
    }
    throw codeError('unknown_function');
  }
  var Store;

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
        d[table].push(row); demoAutoNotes(d, table, row); demoSave(d); return Promise.resolve(row);
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
        demoAutoNotes(d, table, row.date ? row : row); demoSave(d); return Promise.resolve(row);
      }
      return live('POST', '/rest/v1/' + table + '?on_conflict=id', row, { Prefer: 'resolution=merge-duplicates,return=representation' }).then(function (r) { return r && r[0]; });
    },
    // Patch one row by id (used for visitor-inserted rows that the owner only moderates).
    update: function (table, id, patch) {
      if (!LIVE) {
        var d = demoAll(); var i = d[table].findIndex(function (x) { return String(x.id) === String(id); });
        if (i >= 0) { d[table][i] = Object.assign({}, d[table][i], patch); if (table === 'quiz_rounds') demoRoundNotes(d, d[table][i]); demoSave(d); }
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
      var tables = ['books', 'paigam', 'updates', 'gallery', 'quiz_rounds', 'quiz_items', 'quiz_attempts', 'notifications'];
      var owner = { exported_at: nowIso(), mode: LIVE ? 'live' : 'demo' };
      if (!LIVE) { var d = demoAll(); tables.forEach(function (t) { owner[t] = d[t]; }); owner.site = d.site; owner.content = d.content; owner.assets = d.assets; owner.quiz_keys = d.quiz_keys; return Promise.resolve(owner); }
      return Promise.all([Store.getSite(), Store.list('books'), Store.list('paigam'), Store.list('updates'), Store.list('gallery'),
        Store.list('quiz_rounds'), Store.list('quiz_items'), Store.list('quiz_keys'), Store.list('quiz_attempts'), Store.list('notifications')]).then(function (r) {
        owner.site_settings = r[0]; owner.books = r[1]; owner.paigam = r[2]; owner.updates = r[3]; owner.gallery = r[4];
        owner.quiz_rounds = r[5]; owner.quiz_items = r[6]; owner.quiz_keys = r[7]; owner.quiz_attempts = r[8]; owner.notifications = r[9];
        return owner;
      });
    },
    // ----- clock and Quiz PRO (rounds, questions, answer key, attempts) -----
    // Store.now(): the server's clock in live mode (set by quizState); in demo mode the real clock plus an
    // offset the tests (or a demo preview) may set in localStorage 'taj-demo-offset' (ms). Not used in live mode.
    now: function () { return Date.now() + (LIVE ? serverOffset : demoOffset()); },
    // Calls a database function (live) or its demo stand-in. Refusals come back with .raw = the short code.
    rpc: function (name, args) {
      if (!LIVE) return Promise.resolve().then(function () { return demoRpc(name, args || {}, demoAll()); });
      return live('POST', '/rest/v1/rpc/' + name, args || {});
    },
    quizState: function () {
      return Store.rpc('quiz_state', {}).then(function (s) {
        if (LIVE && s && s.server_now) serverOffset = parseTs(s.server_now) - Date.now();
        return s;
      });
    },
    // Owner: save one round and (optionally) its questions + answer key. items/keys carry their own ids.
    quizSaveRound: function (round, items, keys) {
      round = Object.assign({}, round); round.id = round.id || newId();
      if (!LIVE) {
        var d = demoAll();
        var i = d.quiz_rounds.findIndex(function (x) { return x.id === round.id; });
        if (i >= 0) d.quiz_rounds[i] = Object.assign({}, d.quiz_rounds[i], round); else { round.created = nowIso(); d.quiz_rounds.push(round); }
        if (items) {
          var old = d.quiz_items.filter(function (x) { return x.round_id === round.id; }).map(function (x) { return x.id; });
          d.quiz_items = d.quiz_items.filter(function (x) { return x.round_id !== round.id; });
          d.quiz_keys = d.quiz_keys.filter(function (k) { return old.indexOf(k.item_id) < 0; });
          items.forEach(function (it) { d.quiz_items.push(Object.assign({}, it, { round_id: round.id })); });
          (keys || []).forEach(function (k) { d.quiz_keys.push(Object.assign({}, k)); });
        }
        demoRoundNotes(d, d.quiz_rounds[d.quiz_rounds.findIndex(function (x) { return x.id === round.id; })]);
        demoSave(d); return Promise.resolve(round);
      }
      var p = live('POST', '/rest/v1/quiz_rounds?on_conflict=id', round, { Prefer: 'resolution=merge-duplicates,return=minimal' });
      if (items) {
        p = p.then(function () { return live('DELETE', '/rest/v1/quiz_items?round_id=eq.' + encodeURIComponent(round.id), null, { Prefer: 'return=minimal' }); })
          .then(function () { return items.length ? live('POST', '/rest/v1/quiz_items', items.map(function (it) { return Object.assign({}, it, { round_id: round.id }); }), { Prefer: 'return=minimal' }) : null; })
          .then(function () { return keys && keys.length ? live('POST', '/rest/v1/quiz_keys?on_conflict=item_id', keys, { Prefer: 'resolution=merge-duplicates,return=minimal' }) : null; });
      }
      return p.then(function () { return round; });
    },
    // Owner: delete a round with its questions, key and attempts (the database cascades; demo does it here).
    quizDeleteRound: function (id) {
      if (!LIVE) {
        var d = demoAll(); var items = d.quiz_items.filter(function (x) { return x.round_id === id; }).map(function (x) { return x.id; });
        d.quiz_rounds = d.quiz_rounds.filter(function (x) { return x.id !== id; });
        d.quiz_items = d.quiz_items.filter(function (x) { return x.round_id !== id; });
        d.quiz_keys = d.quiz_keys.filter(function (k) { return items.indexOf(k.item_id) < 0; });
        d.quiz_attempts = d.quiz_attempts.filter(function (x) { return x.round_id !== id; });
        demoSave(d); return Promise.resolve(true);
      }
      return live('DELETE', '/rest/v1/quiz_rounds?id=eq.' + encodeURIComponent(id), null, { Prefer: 'return=minimal' });
    },
    // Owner: a visitor's answers are never edited here; this only changes the owner's marks (winner, pinned, hidden).
    attemptMark: function (id, patch) { return Store.update('quiz_attempts', id, patch); },
    attemptsWipe: function (roundId) {
      if (!LIVE) { var d = demoAll(); d.quiz_attempts = d.quiz_attempts.filter(function (x) { return x.round_id !== roundId; }); demoSave(d); return Promise.resolve(true); }
      return live('DELETE', '/rest/v1/quiz_attempts?round_id=eq.' + encodeURIComponent(roundId), null, { Prefer: 'return=minimal' });
    },
    attemptsReset: function (roundId) {
      var patch = { winner: false, pinned: false, hidden: false };
      if (!LIVE) { var d = demoAll(); d.quiz_attempts.forEach(function (x) { if (x.round_id === roundId) Object.assign(x, patch); }); demoSave(d); return Promise.resolve(true); }
      return live('PATCH', '/rest/v1/quiz_attempts?round_id=eq.' + encodeURIComponent(roundId), patch, { Prefer: 'return=minimal' });
    },
    // Notifications (bell). The owner writes; visitors read those whose time has come.
    notify: function (row) { return Store.insert('notifications', Object.assign({ kind: 'custom', publish_at: nowIso() }, row)); },
    // Web Push: a visitor's browser subscription (insert only; the owner later reads it through the sender).
    pushSubscribe: function (sub) {
      var k = (sub && sub.keys) || {};
      var row = { endpoint: sub.endpoint, p256dh: k.p256dh, auth: k.auth };
      if (!LIVE) { var d = demoAll(); if (!d.push_subscriptions.some(function (x) { return x.endpoint === row.endpoint; })) { row.id = uid(); row.created = nowIso(); d.push_subscriptions.push(row); demoSave(d); } return Promise.resolve(true); }
      return live('POST', '/rest/v1/push_subscriptions', row, { Prefer: 'return=minimal' }).catch(function (e) { if (e.status === 409) return true; throw e; });
    },
    // Owner: send a Web Push for one notification through the Edge Function the owner deploys (see docs).
    sendPush: function (notificationId) {
      if (!LIVE) return Promise.reject(codeError('push_needs_live'));
      return refreshIfNeeded().then(function () {
        return fetchT(C.supabaseUrl + '/functions/v1/' + (C.pushFunction || 'send-push'), { method: 'POST', headers: headers(), body: JSON.stringify({ notification_id: notificationId }) }).then(readJson);
      });
    },
    vapidKey: function () { return C.vapidPublicKey || ''; },
    pushReady: function () { return !!(LIVE && C.vapidPublicKey && 'serviceWorker' in navigator && 'PushManager' in window); },
    DEMO_TABLES: DEMO_TABLES,
    resetDemo: function () { localStorage.removeItem(DKEY); },
    SITE_DEFAULTS: SITE_DEFAULTS,
    IDLE_MS: IDLE_MS,
    ymd: ymd, addDays: addDays, uid: uid
  };
  window.TajStore = Store;
})();
