
/* Store: one API, two back-ends.
   DEMO (no Supabase keys in config.js): everything lives in this browser's localStorage.
   LIVE (Supabase keys set): REST calls to your own project; writes need the owner's login (row-level security). */
(function () {
  var C = window.TAJ_CONFIG || {};
  var LIVE = !!(C.supabaseUrl && C.supabaseAnonKey);
  var DKEY = 'tajv2b-demo-v1';
  var SESS = 'tajv2b-session';
  var ist = function (d) { return new Date((d || new Date()).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })); };
  function ymd(d) { var x = ist(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function addDays(n) { var x = ist(); x.setDate(x.getDate() + n); return ymd(x); }
  function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function seed() {
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
    return {
      books: window.TAJ_BOOKS.map(function (b) { return Object.assign({}, b); }),
      paigam: paigam, quiz_questions: quiz, updates: updates, gallery: gallery,
      quiz_entries: [], messages: [], comments: [], site: null
    };
  }
  function defaultSite() {
    return {
      sections: { stats: true, explore: true, paigham: true, scholar: true, updates: true, media: true, about: true, history: true, tawwun: true, khidmat: true, contact: true, comments: true, taawun_bar: true },
      sizes: { mobile: 100, desktop: 100 },
      texts: {},
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
  }

  // ---------- DEMO back-end ----------
  function demoAll() {
    var raw = localStorage.getItem(DKEY);
    if (!raw) { var s = seed(); s.site = defaultSite(); localStorage.setItem(DKEY, JSON.stringify(s)); return s; }
    var d = JSON.parse(raw);
    if (!d.site) d.site = defaultSite();
    return d;
  }
  function demoSave(d) { localStorage.setItem(DKEY, JSON.stringify(d)); }
  function applyQuery(rows, o) {
    o = o || {};
    if (o.eq) rows = rows.filter(function (r) { return Object.keys(o.eq).every(function (k) { return String(r[k]) === String(o.eq[k]); }); });
    if (o.approvedOnly) rows = rows.filter(function (r) { return r.status === 'approved'; });
    if (o.order) rows = rows.slice().sort(function (a, b) { var x = a[o.order], y = b[o.order]; return (x > y ? 1 : x < y ? -1 : 0) * (o.desc ? -1 : 1); });
    if (o.limit) rows = rows.slice(0, o.limit);
    return rows;
  }

  // ---------- LIVE back-end ----------
  function token() { try { var s = JSON.parse(sessionStorage.getItem(SESS) || 'null'); return s && s.access_token; } catch (e) { return null; } }
  function headers(extra) {
    var h = { apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + (token() || C.supabaseAnonKey), 'Content-Type': 'application/json' };
    return Object.assign(h, extra || {});
  }
  function qs(o) {
    var p = [];
    if (o.eq) Object.keys(o.eq).forEach(function (k) { p.push(k + '=eq.' + encodeURIComponent(o.eq[k])); });
    if (o.approvedOnly) p.push('status=eq.approved');
    if (o.order) p.push('order=' + o.order + (o.desc ? '.desc' : '.asc'));
    if (o.limit) p.push('limit=' + o.limit);
    p.push('select=*');
    return p.join('&');
  }
  var TABLE_MAP = { leaderboard: 'public_leaderboard', site: 'site_settings' };
  function liveFetch(method, path, body, extra) {
    return fetch(C.supabaseUrl + path, { method: method, headers: headers(extra), body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.text().then(function (t) { var j = t ? JSON.parse(t) : null; if (!r.ok) throw new Error((j && (j.message || j.msg || j.error_description)) || ('HTTP ' + r.status)); return j; }); });
  }

  var Store = {
    mode: LIVE ? 'live' : 'demo',
    list: function (table, o) {
      o = o || {};
      if (!LIVE) {
        var d = demoAll();
        if (table === 'leaderboard') {
          var rows = applyQuery(d.quiz_entries, { eq: o.eq, order: 'score', desc: true, limit: o.limit || 10 });
          return Promise.resolve(rows.map(function (r) { return { first_name: r.first_name, score: r.score, date: r.date }; }));
        }
        return Promise.resolve(applyQuery(d[table] || [], o));
      }
      var t = TABLE_MAP[table] || table;
      return liveFetch('GET', '/rest/v1/' + t + '?' + qs(o));
    },
    get: function (table, id) { return Store.list(table, { eq: { id: id } }).then(function (r) { return r[0] || null; }); },
    upsert: function (table, row) {
      row = Object.assign({}, row);
      if (!LIVE) {
        var d = demoAll(); row.id = row.id || uid();
        var i = d[table].findIndex(function (x) { return String(x.id) === String(row.id); });
        if (i >= 0) d[table][i] = Object.assign({}, d[table][i], row); else { row.created = row.created || new Date().toISOString(); d[table].push(row); }
        demoSave(d); return Promise.resolve(row);
      }
      return liveFetch('POST', '/rest/v1/' + table + '?on_conflict=id', row, { Prefer: 'resolution=merge-duplicates,return=representation' })
        .then(function (r) { return r && r[0]; });
    },
    insert: function (table, row) { return Store.upsert(table, row); },
    remove: function (table, id) {
      if (!LIVE) { var d = demoAll(); d[table] = d[table].filter(function (x) { return String(x.id) !== String(id); }); demoSave(d); return Promise.resolve(true); }
      return liveFetch('DELETE', '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), null, { Prefer: 'return=minimal' });
    },
    getSite: function () {
      if (!LIVE) return Promise.resolve(demoAll().site);
      return liveFetch('GET', '/rest/v1/site_settings?id=eq.site&select=value').then(function (r) {
        var v = r && r[0] && r[0].value; var base = defaultSite();
        return Object.assign(base, v || {});
      }).catch(function () { return defaultSite(); });
    },
    saveSite: function (patch) {
      return Store.getSite().then(function (cur) {
        var next = Object.assign({}, cur, patch);
        if (window.TajApp) window.TajApp.S.site = next;
        if (!LIVE) { var d = demoAll(); d.site = next; demoSave(d); return next; }
        return liveFetch('POST', '/rest/v1/site_settings?on_conflict=id', { id: 'site', value: next }, { Prefer: 'resolution=merge-duplicates,return=minimal' }).then(function () { return next; });
      });
    },
    login: function (email, password) {
      if (!LIVE) {
        if (email === 'demo' && password === 'demo') { sessionStorage.setItem(SESS, JSON.stringify({ access_token: 'demo', email: 'demo', demo: true })); return Promise.resolve({ email: 'demo' }); }
        return Promise.reject(new Error('Demo login: user "demo", password "demo".'));
      }
      return fetch(C.supabaseUrl + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: C.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: password }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error_description || j.msg || 'Login nahi hua'); sessionStorage.setItem(SESS, JSON.stringify({ access_token: j.access_token, email: j.user && j.user.email })); return { email: j.user && j.user.email }; }); });
    },
    logout: function () { sessionStorage.removeItem(SESS); },
    session: function () { try { return JSON.parse(sessionStorage.getItem(SESS) || 'null'); } catch (e) { return null; } },
    upload: function (blob, path) {
      if (!LIVE) return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(blob); });
      return fetch(C.supabaseUrl + '/storage/v1/object/media/' + path, { method: 'POST', headers: { apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + token(), 'Content-Type': blob.type || 'image/jpeg', 'x-upsert': 'true' }, body: blob })
        .then(function (r) { if (!r.ok) throw new Error('Upload nahi hua (' + r.status + ')'); return C.supabaseUrl + '/storage/v1/object/public/media/' + path; });
    },
    resetDemo: function () { localStorage.removeItem(DKEY); },
    ymd: ymd, addDays: addDays, uid: uid
  };
  window.TajStore = Store;
})();
