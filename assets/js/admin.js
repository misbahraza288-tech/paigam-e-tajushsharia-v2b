/* Owner panel (hidden). Login (email + password, then 2FA code if enabled), then one place for everything:
   texts (every key, with undo history), images, books, Paigham by date, updates, quiz, media, messages, comments,
   sections, look and stats, history, security. Demo mode uses this browser only. */
(function () {
  'use strict';
  var A = window.TajApp, St = window.TajStore, I = window.TajIcons, $ = A.$, $$ = A.$$, esc = A.esc, S = A.S;
  var ROUTE = (window.TAJ_CONFIG && window.TAJ_CONFIG.adminRoute) || 'tajush-desk';
  var IDLE_MS = St.IDLE_MS;
  var TABS = [
    ['dash', 'Dashboard'], ['edit', 'Edit site'], ['texts', 'Texts'], ['images', 'Images'], ['books', 'Books'], ['paigam', 'Paigham'],
    ['updates', 'Updates'], ['quiz', 'Quiz'], ['media', 'Media'], ['messages', 'Messages'], ['comments', 'Comments'],
    ['sections', 'Sections'], ['look', 'Look & stats'], ['history', 'History'], ['security', 'Security']
  ];
  var CATS = ['Hadees', 'Sharah', 'Tafseer', 'Fatawa', 'Fiqh', 'Namaz', 'Tasawwuf', 'Radd e Batil', 'Naat', 'Lughat', 'Aqaedah', 'Ilm-Al-Nahw', 'Ilm-Al-Meeras', 'Other'];
  var ACCENTS = [['sage', 'Sage', '#4F6F5E'], ['teal', 'Teal', '#3E6B6B'], ['clay', 'Clay', '#9C6B5A'], ['slate', 'Slate', '#5C6F8A'], ['olive', 'Olive', '#6B7A3E'], ['plum', 'Plum', '#7A5C75']];
  var SECTION_NAMES = { stats: 'Stats bar', explore: 'Explore cards', paigham: 'Aaj ka Paigham', scholar: 'Taj Scholar of the Day', updates: 'Updates', media: 'Media (video & gallery)', about: 'About / Mission', history: 'Our History', tawwun: 'Tawwun', khidmat: 'Hamari Khidmat', contact: 'Contact form', comments: 'Comments', taawun_bar: "Ta'awun progress bar" };
  var TA = { cur: 'dash', d: null, seed: null, mfaFactor: null, lastAct: Date.now(), timer: null, open: false };

  function nowMs() { return Date.now(); }
  function ad(html) {
    $('#app').innerHTML = '<div class="demo-banner"><b>' + (St.mode === 'demo' ? 'DEMO MODE — not secure' : 'OWNER PANEL') + '</b>' +
      (St.mode === 'demo' ? ' · user demo / password demo · data sirf is browser me' : ' · live') + '</div>' + html;
  }
  function err(msg) { var e = $('#lerr'); if (e) e.textContent = msg; else A.toast(msg); }

  // ---------- login (email + password, optional 2FA code) ----------
  function loginScreen() {
    TA.open = true;
    var demo = St.mode === 'demo';
    ad('<section style="padding-top:36px"><div class="wrap" style="max-width:440px"><div class="card">' +
      '<div class="eyebrow">Owner panel</div><h2 style="margin:6px 0 14px">Login</h2>' +
      '<form class="form" id="lf"><div class="field"><label for="le">Email (aap ka ID)</label><input id="le" type="text" required autocomplete="username" autocapitalize="none" spellcheck="false"></div>' +
      '<div class="field"><label for="lp">Password</label><input id="lp" type="password" required autocomplete="current-password"></div>' +
      '<button class="btn" type="submit">Login</button><p class="small" id="lerr" style="color:#9A3B2E" role="alert"></p></form>' +
      (demo ? '<p class="small muted" style="margin-top:12px">Demo: user <b>demo</b>, password <b>demo</b>. Live site par ye nahi chalega.</p>' : '<p class="small muted" style="margin-top:12px">Password aap ne khud banaya hai. Ye site kisi ka password nahi jaanti.</p>') +
      '</div></div></section>');
    $('#lf').onsubmit = function (e) {
      e.preventDefault();
      St.login($('#le').value.trim(), $('#lp').value).then(function (r) {
        if (r && r.mfa) { TA.mfaFactor = r.factorId; mfaScreen(); } else startSession();
      }).catch(function (x) { err(x.message); });
    };
  }
  function mfaScreen() {
    ad('<section style="padding-top:36px"><div class="wrap" style="max-width:440px"><div class="card">' +
      '<div class="eyebrow">2-step check</div><h2 style="margin:6px 0 10px">Authenticator code</h2>' +
      '<p class="small muted">Authenticator app (Google Authenticator / Microsoft Authenticator) me abhi ka 6-digit code daalein.</p>' +
      '<form class="form" id="mf"><div class="field"><label for="mc">Code</label><input id="mc" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required></div>' +
      '<button class="btn" type="submit">Verify</button><p class="small" id="lerr" style="color:#9A3B2E" role="alert"></p></form></div></div></section>');
    $('#mf').onsubmit = function (e) { e.preventDefault(); St.verifyMfa(TA.mfaFactor, $('#mc').value).then(function () { startSession(); }).catch(function () { err('Code galat hai ya expire ho gaya. Dobara daalein.'); }); };
  }
  function startSession() {
    TA.open = true; TA.lastAct = nowMs(); watchIdle(); show();
  }
  // Auto-logout after 30 minutes without a tap or key press.
  function watchIdle() {
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) { document.addEventListener(ev, touch, { passive: true }); });
    clearInterval(TA.timer);
    TA.timer = setInterval(function () {
      if (!TA.open) return;
      if (!St.session()) { TA.open = false; return; }
      if (nowMs() - TA.lastAct > IDLE_MS) { St.logout(); TA.open = false; A.toast('Kuch der se koi kaam nahi hua — aap bahar ho gaye. Dobara login karein.'); loginScreen(); }
    }, 15000);
  }
  function touch() { TA.lastAct = nowMs(); }

  // ---------- data for the panels ----------
  function load() {
    var today = St.ymd();
    return Promise.all([
      St.list('books', { order: 'sort' }), St.list('paigam', { order: 'date' }), St.list('updates', { order: 'date', desc: true }),
      St.list('quiz_questions', { order: 'created' }), St.list('quiz_entries', { order: 'created', desc: true, limit: 300 }),
      St.list('gallery'), St.list('messages', { order: 'created', desc: true, limit: 300 }), St.list('comments', { order: 'created', desc: true, limit: 300 }),
      St.getSite(), St.history(150), St.mfaStatus().catch(function () { return { enrolled: false }; }), loadSeed()
    ]).then(function (r) {
      TA.d = { books: r[0], paigam: r[1], updates: r[2], quizQ: r[3], entries: r[4], gallery: r[5], messages: r[6], comments: r[7], site: r[8], history: r[9], mfa: r[10], today: today };
      TA.seed = r[11];
      return TA.d;
    });
  }
  function loadSeed() {
    if (TA.seed) return Promise.resolve(TA.seed);
    return fetch('assets/data/content-seed.json').then(function (r) { return r.json(); }).catch(function () { return {}; });
  }
  function show() {
    if (!St.session()) { loginScreen(); return; }
    ad('<section class="wrap" style="padding-top:30px"><p class="muted">Data load ho raha hai…</p></section>');
    load().then(function () { draw(); }).catch(function (e) {
      ad('<section class="wrap" style="padding-top:30px"><div class="card"><p>Admin data nahi aaya: ' + esc(e.message) + '</p><div class="actions"><button class="btn sm" data-a="retry">Dobara</button> <button class="btn ghost sm" data-a="logout">Logout</button></div></div></section>');
    });
  }
  function draw() {
    var body = '';
    var c = TA.d, cur = TA.cur;
    var map = { dash: dash, edit: editPanel, texts: texts, images: images, books: books, paigam: paigam, updates: updates, quiz: quiz, media: media, messages: messages, comments: comments, sections: sections, look: look, history: history, security: security };
    body = (map[cur] || dash)(c);
    ad('<div class="admin-tabs" role="tablist">' + TABS.map(function (t) { return '<button class="' + (t[0] === cur ? 'on' : '') + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>'; }).join('') + '</div>' +
      '<section class="wrap adm" style="padding-top:18px;padding-bottom:60px">' + body + '</section>');
    window.scrollTo(0, 0);
  }
  function go(t) { TA.cur = t; draw(); }

  // ---------- panels ----------
  function dash(c) {
    var unread = c.messages.filter(function (m) { return !m.read; }).length;
    var pend = c.comments.filter(function (x) { return x.status === 'pending'; }).length;
    var todayQ = c.quizQ.length; var todayE = c.entries.filter(function (x) { return x.date === c.today; }).length;
    var future = c.paigam.filter(function (p) { return p.date >= c.today && !p.sample; }).length;
    var card = function (n, l, sub, tab) { return '<button class="kcard" data-tab="' + tab + '" style="text-align:left"><b>' + esc(n) + '</b><span>' + esc(l) + '</span>' + (sub ? '<small class="muted">' + esc(sub) + '</small>' : '') + '</button>'; };
    return '<h2 style="margin:0 0 6px">Dashboard</h2><p class="small muted">Aaj: ' + esc(c.today) + ' · ' + (St.mode === 'demo' ? 'demo (sirf is browser me)' : 'live (sabko dikhta hai)') + '</p>' +
      '<div class="kgrid">' + card(c.books.length, 'Kitabein', c.books.filter(function (b) { return !b.read; }).length + ' bina Read link', 'books') +
      card(unread, 'Naye messages', c.messages.length + ' total', 'messages') +
      card(pend, 'Comments approval ke liye', c.comments.filter(function (x) { return x.status === 'approved'; }).length + ' approved', 'comments') +
      card(todayQ, 'Aaj ke sawal', todayE + ' entries aaj', 'quiz') +
      card(future, 'Paigham (aage ke din)', 'real text wale', 'paigam') +
      card(c.updates.length, 'Updates', 'timeline', 'updates') +
      card(c.gallery.length, 'Media', c.gallery.filter(function (g) { return g.kind === 'video'; }).length + ' video', 'media') +
      card(c.history.length, 'Badlav (history)', 'undo yahin se', 'history') + '</div>' +
      '<div class="card" style="margin-top:16px"><div class="eyebrow">Jaldi kaam</div><div class="actions" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-a="edit-site">Site kholo aur pencil se edit karein</button><button class="btn ghost sm" data-tab="texts">Saare texts</button><button class="btn ghost sm" data-tab="images">Photos / logo</button></div></div>';
  }
  function editPanel() {
    return '<h2 style="margin:0 0 8px">Site par direct edit</h2><p class="muted">Site khulegi. Har text ke upar pencil dikhega. Pencil par tap karke badlein, Save dabayein. Ye sabko dikhega.</p>' +
      '<div class="actions" style="margin-top:12px"><button class="btn" data-a="edit-site">Site kholo (edit mode)</button></div>' +
      '<p class="small muted" style="margin-top:14px">Tip: Texts tab me saari lambi list hai, wahan se bhi badal sakte hain.</p>';
  }
  var TEXT_KEYS = null;
  function texts(c) {
    var seed = TA.seed || {}; var keys = Object.keys(seed);
    var extra = Object.keys(c.site.texts || {}).filter(function (k) { return k.indexOf('.url') < 0 && keys.indexOf(k) < 0; });
    keys = keys.concat(extra);
    var groups = {};
    keys.forEach(function (k) { var g = k.split('.')[0]; (groups[g] = groups[g] || []).push(k); });
    var cur = function (k) { var t = c.site.texts[k]; return t && t.text != null ? t.text : (seed[k] || ''); };
    var overridden = function (k) { return !!c.site.texts[k]; };
    return '<h2 style="margin:0 0 6px">Saare texts</h2><p class="small muted">Har line ka ek key hai. Jo badlega wo sabko dikhega. "Default" dabane par wapas asli text aa jayega. Kahin bhi undo ke liye: History tab.</p>' +
      '<div class="field"><input id="tfilter" placeholder="Search (jaise hero, quiz, tawwun)"></div>' +
      Object.keys(groups).map(function (g) {
        return '<details class="card tgroup" open data-group="' + esc(g) + '" style="margin-top:12px"><summary style="cursor:pointer;font-weight:600">' + esc(g) + ' <span class="small muted">(' + groups[g].length + ')</span></summary>' +
          groups[g].map(function (k) {
            var isLink = /\.url$/.test(k);
            var val = cur(k);
            return '<form class="trow" data-f="text" data-key="' + esc(k) + '" data-search="' + esc(k + ' ' + (seed[k] || '')) + '" style="margin-top:12px;display:grid;gap:6px">' +
              '<div class="small muted"><code>' + esc(k) + '</code>' + (overridden(k) ? ' · <b>badla hua</b>' : '') + '</div>' +
              '<textarea name="v" rows="' + (val.length > 90 ? 3 : 1) + '" style="width:100%">' + esc(val) + '</textarea>' +
              '<div class="actions" style="gap:8px"><button class="btn sm" type="submit">Save</button>' +
              (overridden(k) ? '<button class="btn ghost sm" type="button" data-a="text-reset" data-key="' + esc(k) + '">Default par wapas</button>' : '') + '</div></form>';
          }).join('') + '</details>';
      }).join('');
  }
  function images(c) {
    var slots = [
      ['logo', 'Logo (top bar par)', 'logo', 512, null],
      ['home.hero.image', 'Hero photo (home ka bada box)', 'hero', 1200, 4 / 5]
    ];
    return '<h2 style="margin:0 0 6px">Photos & logo</h2><p class="small muted">Phone se photo chunein. Site automatically chhoti karke (compress) aur sahi size me crop karke laga degi. Bade photo ki limit 15 MB.</p>' +
      slots.map(function (s) {
        var url = c.site.assets[s[0]] || '';
        return '<div class="card" style="margin-top:12px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
          '<div style="width:110px;height:' + (s[0] === 'logo' ? '110' : '137') + 'px;background:var(--sage-soft);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center">' + (url ? '<img src="' + esc(url) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '<span class="small muted">default</span>') + '</div>' +
          '<div style="flex:1;min-width:160px"><b>' + esc(s[1]) + '</b><div class="small muted">' + (url ? 'Abhi: apni photo' : 'Abhi: default (ornament)') + '</div>' +
          '<div class="actions" style="margin-top:8px;gap:8px"><label class="btn sm" style="cursor:pointer">Change photo<input type="file" accept="image/*" hidden data-akey="' + esc(s[0]) + '" data-kind="' + esc(s[2]) + '" data-w="' + s[3] + '" data-ratio="' + (s[4] || 0) + '"></label>' +
          (url ? '<button class="btn ghost sm" data-a="asset-reset" data-key="' + esc(s[0]) + '">Default par wapas</button>' : '') + '</div></div></div>';
      }).join('') +
      '<p class="small muted" style="margin-top:14px">Gallery photos "Media" tab me, book covers "Books" tab me.</p><p class="small" id="upmsg" role="status"></p>';
  }
  function books(c) {
    var q = TA.bq || '';
    var list = c.books.filter(function (b) { return !q || (b.title_en + ' ' + (b.writer_en || '') + ' ' + (b.cat || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0; });
    return '<div class="admin-h"><h2 style="margin:0">Kitabein (' + c.books.length + ')</h2><button class="btn sm" data-a="book-new">+ Nayi kitab</button></div>' +
      '<div class="field" style="margin-top:10px"><input id="bsearch" placeholder="Kitab ya writer dhundhein" value="' + esc(q) + '"></div>' +
      '<div class="tbl" style="margin-top:10px">' + list.slice(0, 400).map(function (b, i) {
        return '<div class="tr" style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><div><b>' + esc(b.title_en) + '</b><br><small class="muted">' + esc(b.cat || '') + ' · ' + esc(b.jild || '') + ' jild · ' + (b.read ? 'Read link ✓' : 'Read link nahi') + '</small></div>' +
          '<div class="actions" style="gap:6px"><button class="btn ghost sm" data-a="book-up" data-id="' + esc(b.id) + '">↑</button><button class="btn ghost sm" data-a="book-down" data-id="' + esc(b.id) + '">↓</button><button class="btn ghost sm" data-a="book-edit" data-id="' + esc(b.id) + '">Edit</button><button class="btn ghost sm" data-a="book-del" data-id="' + esc(b.id) + '">Delete</button></div></div>';
      }).join('') + '</div>' + (list.length > 400 ? '<p class="small muted">Pehle 400 dikh rahe hain; search se dhundhein.</p>' : '');
  }
  function bookForm(b) {
    b = b || {};
    var opt = function (v) { return '<option' + (b.cat === v ? ' selected' : '') + '>' + esc(v) + '</option>'; };
    A.modal(b.id ? 'Kitab edit karein' : 'Nayi kitab', '<form class="form" id="bf" data-f="book" data-id="' + esc(b.id || '') + '">' +
      '<div class="field"><label>Title (English / Roman)</label><input name="title_en" required value="' + esc(b.title_en || '') + '"></div>' +
      '<div class="field"><label>Title (Urdu / Arabic)</label><input name="title_ur" dir="auto" value="' + esc(b.title_ur || '') + '"></div>' +
      '<div class="field"><label>Writer (English)</label><input name="writer_en" value="' + esc(b.writer_en || '') + '"></div>' +
      '<div class="field"><label>Writer (Urdu)</label><input name="writer_ur" dir="auto" value="' + esc(b.writer_ur || '') + '"></div>' +
      '<div class="field"><label>Category</label><select name="cat">' + CATS.map(opt).join('') + '</select></div>' +
      '<div class="field"><label>Jild</label><input name="jild" value="' + esc(b.jild || '') + '"></div>' +
      '<div class="field"><label>Read link (https://…)</label><input name="read" value="' + esc(b.read || '') + '"></div>' +
      '<div class="field"><label>Cover link (https://… ya photo upload)</label><input name="cover" value="' + esc(b.cover || '') + '"><input type="file" accept="image/*" data-bookcover style="margin-top:6px"></div>' +
      '<label class="small"><input type="checkbox" name="featured"' + (b.featured ? ' checked' : '') + '> Featured</label>' +
      '<p class="small" id="bferr" style="color:#9A3B2E"></p></form>',
      '<button class="btn ghost sm" data-close>Cancel</button><button class="btn sm" form="bf" type="submit">Save</button>');
  }
  function paigam(c) {
    var map = {}; c.paigam.forEach(function (p) { map[p.date] = p; });
    var days = []; for (var i = -2; i <= 30; i++) days.push(St.addDays(i));
    return '<h2 style="margin:0 0 6px">Aaj ka Paigham (date wise)</h2><p class="small muted">Har din ka text us din raat 12 baje (IST) se apne aap aayega. Sample wale "sample" likha dikhega. Asli Quran/Hadees ka text owner khud likhe.</p>' +
      days.map(function (d) {
        var p = map[d] || { text_ro: '', text_ur: '', source: '' };
        return '<form class="card" data-f="pg" data-date="' + esc(d) + '" style="margin-top:10px;display:grid;gap:6px"><b>' + esc(d) + (d === c.today ? ' · aaj' : '') + (p.sample ? ' · sample' : '') + '</b>' +
          '<textarea name="ro" rows="2" placeholder="Roman / English text">' + esc(p.text_ro || '') + '</textarea>' +
          '<textarea name="ur" rows="2" dir="auto" placeholder="Urdu text">' + esc(p.text_ur || '') + '</textarea>' +
          '<input name="source" placeholder="Source (kitab / aayat / hadees ka hawala)" value="' + esc(p.source || '') + '">' +
          '<div class="actions"><button class="btn sm" type="submit">Save</button></div></form>';
      }).join('');
  }
  function updates(c) {
    return '<h2 style="margin:0 0 6px">Updates (timeline)</h2>' +
      '<form class="card" data-f="upd" style="display:grid;gap:8px;margin-top:10px"><input type="date" name="date" value="' + esc(c.today) + '" required><input name="title" placeholder="Title (jaise: Nayi kitab add hui)" required maxlength="200"><textarea name="body" rows="2" placeholder="Thoda detail (optional)" maxlength="2000"></textarea><div class="actions"><button class="btn sm" type="submit">Add update</button></div></form>' +
      '<div class="tbl" style="margin-top:12px">' + c.updates.map(function (u) {
        return '<div class="tr" style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span><b>' + esc(u.title) + '</b><br><small class="muted">' + esc(u.date) + '</small></span><button class="btn ghost sm" data-a="upd-del" data-id="' + esc(u.id) + '">Delete</button></div>';
      }).join('') + '</div>';
  }
  function quiz(c) {
    var qs = c.quizQ.filter(function (q) { return q.date === c.today; });
    var ent = c.entries.filter(function (x) { return x.date === c.today; });
    var lb = ent.slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); }).slice(0, 10);
    return '<h2 style="margin:0 0 6px">Taj Quiz</h2><p class="small muted">Aaj ke sawal. Entries sirf aap dekh sakte hain (phone, address).</p>' +
      '<form class="card" data-f="quiz" style="display:grid;gap:8px;margin-top:10px"><input type="date" name="date" value="' + esc(c.today) + '" required><input name="q" required maxlength="500" placeholder="Sawal"><textarea name="opts" rows="3" required placeholder="Jawab, har line par ek (kam se kam 2)"></textarea><label class="small">Sahi jawab number (1 se) <input name="ans" type="number" min="1" value="1" style="width:80px"></label><div class="actions"><button class="btn sm" type="submit">Sawal add karein</button></div></form>' +
      '<div class="tbl" style="margin-top:12px">' + (qs.length ? qs.map(function (q, i) { return '<div class="tr" style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span>' + (i + 1) + '. ' + esc(q.q) + '<br><small class="muted">' + q.options.map(function (o, j) { return (j === q.answer ? '✓ ' : '') + esc(o); }).join(' · ') + '</small></span><button class="btn ghost sm" data-a="q-del" data-id="' + esc(q.id) + '">Delete</button></div>'; }).join('') : '<div class="tr muted">Aaj ka koi sawal nahi.</div>') + '</div>' +
      '<h3 style="margin:18px 0 6px">Aaj ke entries (' + ent.length + ')</h3><div class="tbl">' + (ent.length ? ent.map(function (x) { return '<div class="tr" style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><span><b>' + esc(x.full_name || x.first_name) + '</b> · ' + esc(x.score) + '/' + esc(x.total) + '<br><small class="muted">' + esc(x.phone || '') + ' · ' + esc(x.address || '') + '</small></span><button class="btn ghost sm" data-a="entry-del" data-id="' + esc(x.id) + '">Hatayein</button></div>'; }).join('') : '<div class="tr muted">Abhi koi entry nahi.</div>') + '</div>' +
      '<p class="small muted" style="margin-top:10px">Leaderboard (sirf naam + score public): ' + (lb.length ? lb.map(function (x) { return esc(x.first_name) + ' ' + esc(x.score); }).join(', ') : 'abhi nahi') + '</p>';
  }
  function media(c) {
    var vids = c.gallery.filter(function (g) { return g.kind === 'video'; });
    var photos = c.gallery.filter(function (g) { return g.kind === 'photo'; });
    return '<h2 style="margin:0 0 6px">Media</h2>' +
      '<div class="card" style="display:grid;gap:8px"><b>YouTube video</b><form data-f="yt" style="display:grid;gap:8px"><input name="link" placeholder="YouTube link paste karein" required><div class="actions"><button class="btn sm" type="submit">Video add karein</button></div><p class="small muted" id="ytmsg"></p></form>' +
      vids.map(function (v) { return '<div class="actions" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><span class="small">' + esc(v.title || v.youtube_id) + ' <code>' + esc(v.youtube_id || '') + '</code></span><button class="btn ghost sm" data-a="gal-del" data-id="' + esc(v.id) + '">Hatayein</button></div>'; }).join('') + '</div>' +
      '<div class="card" style="margin-top:12px"><b>Gallery photo</b><p class="small muted">Phone se chunein. Auto compress ho jayegi.</p><label class="btn sm" style="cursor:pointer;margin-top:8px">Photo chunein<input type="file" accept="image/*" hidden data-gal="photo"></label><p class="small" id="upmsg" role="status"></p></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:12px">' + photos.map(function (g) {
        return '<div class="card" style="padding:6px"><div style="aspect-ratio:1;background:var(--sage-soft);border-radius:10px;overflow:hidden">' + (g.url ? '<img src="' + esc(g.url) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '') + '</div><div class="small muted" style="margin:4px 0">' + esc(g.title || '') + '</div><button class="btn ghost sm" data-a="gal-del" data-id="' + esc(g.id) + '">Hatayein</button></div>';
      }).join('') + '</div>';
  }
  function messages(c) {
    var unread = c.messages.filter(function (m) { return !m.read; }).length;
    return '<div class="admin-h"><h2 style="margin:0">Messages (' + c.messages.length + ')</h2><span class="small muted">' + unread + ' naye</span></div><p class="small muted">Naye message par "Read" dabayein. WhatsApp reply button se seedha reply karein.</p>' +
      '<div class="tbl" style="margin-top:10px">' + (c.messages.length ? c.messages.map(function (m) {
        var digits = String(m.phone || '').replace(/\D/g, '');
        var wa = digits.length >= 10 ? 'https://wa.me/' + (digits.length === 10 ? '91' + digits : digits) + '?text=' + encodeURIComponent('Assalamu alaikum ' + (m.name || '') + ', aap ka message mila.') : '';
        return '<div class="tr" style="display:grid;gap:6px;' + (m.read ? '' : 'border-left:3px solid var(--gold)') + '"><div><b>' + esc(m.name) + '</b> <span class="small muted">' + esc(fmt(m.created)) + (m.read ? '' : ' · naya') + '</span></div>' +
          '<div style="white-space:pre-wrap">' + esc(m.message) + '</div><div class="small muted">' + esc(m.email || '') + ' ' + esc(m.phone || '') + '</div>' +
          '<div class="actions" style="gap:6px;flex-wrap:wrap"><button class="btn ghost sm" data-a="msg-read" data-id="' + esc(m.id) + '" data-v="' + (m.read ? '0' : '1') + '">' + (m.read ? 'Unread karein' : 'Read') + '</button>' +
          (wa ? '<a class="btn ghost sm" href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp reply</a>' : '') +
          '<button class="btn ghost sm" data-a="msg-del" data-id="' + esc(m.id) + '">Delete</button></div></div>';
      }).join('') : '<div class="tr muted">Abhi koi message nahi.</div>') + '</div>';
  }
  function fmt(t) { try { return new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function comments(c) {
    var st = TA.cs || 'pending';
    var list = c.comments.filter(function (x) { return x.status === st; });
    return '<h2 style="margin:0 0 6px">Comments</h2><p class="small muted">Approve karne tak comment public nahi hota.</p>' +
      '<div class="actions" style="gap:8px;margin:10px 0">' + ['pending', 'approved', 'rejected'].map(function (s) { return '<button class="btn ' + (st === s ? '' : 'ghost') + ' sm" data-cs="' + s + '">' + s + ' (' + c.comments.filter(function (x) { return x.status === s; }).length + ')</button>'; }).join('') + '</div>' +
      '<div class="tbl">' + (list.length ? list.map(function (x) {
        return '<div class="tr" style="display:grid;gap:6px"><div><b>' + esc(x.name) + '</b> <span class="small muted">' + esc(fmt(x.created)) + '</span></div><div style="white-space:pre-wrap">' + esc(x.message) + '</div>' +
          '<div class="actions" style="gap:6px">' + (st !== 'approved' ? '<button class="btn sm" data-a="com-set" data-id="' + esc(x.id) + '" data-s="approved">Approve</button>' : '') + (st !== 'rejected' ? '<button class="btn ghost sm" data-a="com-set" data-id="' + esc(x.id) + '" data-s="rejected">Reject</button>' : '') + '<button class="btn ghost sm" data-a="com-del" data-id="' + esc(x.id) + '">Delete</button></div></div>';
      }).join('') : '<div class="tr muted">Is list me kuch nahi.</div>') + '</div>';
  }
  function sections(c) {
    return '<h2 style="margin:0 0 6px">Sections on / off</h2><p class="small muted">Switch off karne se section site se turant hat jayega. Layout kharab nahi hoga.</p>' +
      '<div class="card" style="margin-top:10px">' + Object.keys(SECTION_NAMES).map(function (k) {
        var on = c.site.sections[k] !== false;
        return '<label class="row" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)"><span>' + esc(SECTION_NAMES[k]) + '</span><input type="checkbox" data-sec="' + k + '"' + (on ? ' checked' : '') + '></label>';
      }).join('') + '</div>';
  }
  function look(c) {
    var s = c.site;
    var sizes = s.sizes || { mobile: 100, desktop: 100 };
    return '<h2 style="margin:0 0 6px">Look & stats</h2>' +
      '<div class="card" style="margin-top:10px"><b>Animations (sab visitors ke liye default)</b><p class="small muted">Full: sab motion. Light: sirf fade aur page move. Off: kuch nahi hilta. Visitor Settings me apna choice badal sakta hai.</p><div class="anim-row" style="margin-top:8px">' + ['full', 'light', 'off'].map(function (v) { return '<button class="btn ' + ((s.animations || 'full') === v ? '' : 'ghost') + ' sm" data-a="anim-set" data-v="' + v + '">' + (v === 'full' ? 'Full' : v === 'light' ? 'Light' : 'Off') + '</button>'; }).join('') + '</div></div>' +
      '<div class="card" style="margin-top:10px"><b>Accent rang (light palette)</b><div class="actions" style="gap:8px;margin-top:8px;flex-wrap:wrap">' + ACCENTS.map(function (a) {
        return '<button class="btn ' + (s.accent === a[0] || (!s.accent && a[0] === 'sage') ? '' : 'ghost') + ' sm" data-a="accent" data-v="' + a[0] + '"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + a[2] + ';margin-right:6px"></span>' + esc(a[1]) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="card" style="margin-top:12px;display:grid;gap:10px"><b>Text size (phone / desktop)</b>' +
      '<label class="small">Phone <span id="smv">' + sizes.mobile + '%</span><input type="range" min="80" max="130" value="' + sizes.mobile + '" data-size="mobile" style="width:100%"></label>' +
      '<label class="small">Desktop <span id="sdv">' + sizes.desktop + '%</span><input type="range" min="80" max="130" value="' + sizes.desktop + '" data-size="desktop" style="width:100%"></label>' +
      '<div class="actions"><button class="btn sm" data-a="sizes-save">Size save</button></div></div>' +
      '<form class="card" data-f="stats" style="display:grid;gap:10px;margin-top:12px"><b>Stats (numbers)</b>' + (s.stats || []).map(function (x, i) {
        return '<div style="display:grid;grid-template-columns:1fr 70px 1.4fr;gap:6px"><input type="number" name="n' + i + '" value="' + esc(x.n) + '"><input name="s' + i + '" value="' + esc(x.suffix || '') + '" placeholder="+"><input name="l' + i + '" value="' + esc(x.label || '') + '"></div>';
      }).join('') + '<textarea name="note" rows="2" placeholder="Note (jaise: original site ke claims)">' + esc(s.stats_note || '') + '</textarea><div class="actions"><button class="btn sm" type="submit">Stats save</button></div></form>' +
      '<form class="card" data-f="taawun" style="display:grid;gap:8px;margin-top:12px"><b>Ta\'awun (progress bar)</b><input name="title" placeholder="Project ka naam" value="' + esc((s.taawun || {}).title || '') + '"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><input type="number" name="goal" placeholder="Goal" value="' + esc((s.taawun || {}).goal || 0) + '"><input type="number" name="raised" placeholder="Raised" value="' + esc((s.taawun || {}).raised || 0) + '"></div><textarea name="note" rows="2" placeholder="Note">' + esc((s.taawun || {}).note || '') + '</textarea><p class="small muted">Is site par koi payment nahi hota. Yahan sirf progress number hai.</p><div class="actions"><button class="btn sm" type="submit">Ta\'awun save</button></div></form>' +
      '<form class="card" data-f="social" style="display:grid;gap:8px;margin-top:12px"><b>Follow links (khali chhodein to nahi dikhega)</b>' + ['facebook', 'instagram', 'youtube', 'x'].map(function (k) { return '<input name="' + k + '" placeholder="' + k + ' link (https://…)" value="' + esc((s.social || {})[k] || '') + '">'; }).join('') + '<div class="actions"><button class="btn sm" type="submit">Links save</button></div></form>' +
      '<form class="card" data-f="rules" style="display:grid;gap:8px;margin-top:12px"><b>Quiz rules (ek line ek rule)</b><textarea name="rules" rows="5">' + esc((s.quizRules || []).join('\n')) + '</textarea><label class="small"><input type="checkbox" name="lb"' + (s.leaderboardVisible !== false ? ' checked' : '') + '> Leaderboard public dikhe</label><div class="actions"><button class="btn sm" type="submit">Rules save</button></div></form>';
  }
  function history(c) {
    return '<h2 style="margin:0 0 6px">Badlav ka record</h2><p class="small muted">Har text badlav yahan hai. "Undo" se wo badlav wapas ho jayega (ek tap).</p>' +
      '<div class="tbl" style="margin-top:10px">' + (c.history.length ? c.history.map(function (h) {
        return '<div class="tr" style="display:grid;gap:4px"><div class="small muted">' + esc(fmt(h.changed_at)) + ' · <code>' + esc(h.key) + '</code>' + (h.undo ? ' · (undo)' : '') + '</div>' +
          '<div class="small"><span class="muted">pehle:</span> ' + esc(trunc(h.old_value)) + '<br><span class="muted">ab:</span> ' + esc(trunc(h.new_value)) + '</div>' +
          '<div class="actions"><button class="btn ghost sm" data-a="undo" data-hid="' + esc(String(h.id)) + '">Undo</button></div></div>';
      }).join('') : '<div class="tr muted">Abhi koi badlav nahi.</div>') + '</div>';
  }
  function trunc(v) { if (v === null || v === undefined) return '(default)'; v = String(v); return v.length > 140 ? v.slice(0, 140) + '…' : (v || '(khali)'); }
  function security(c) {
    var s = St.session() || {};
    var live = St.mode === 'live';
    return '<h2 style="margin:0 0 6px">Security</h2>' +
      '<div class="card" style="display:grid;gap:8px"><div>Login: <b>' + esc(s.email || '') + '</b></div><div class="small muted">' + (live ? (c.mfa.enrolled ? '2FA (authenticator) chalu hai.' : '2FA abhi band hai.') : 'Demo: 2FA ka sirf dikhawa hai, asli nahi.') + '</div>' +
      '<div class="small muted">Kuch der (30 min) koi kaam na ho to aap apne aap bahar ho jayenge.</div>' +
      '<div class="actions" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-a="mfa-start">' + (c.mfa.enrolled ? '2FA dobara set karein' : '2FA chalu karein') + '</button><button class="btn ghost sm" data-a="export">Backup (JSON) download</button><button class="btn ghost sm" data-a="logout">Logout</button>' + (live ? '' : '<button class="btn ghost sm" data-a="demo-reset">Demo data reset</button>') + '</div>' +
      '<div id="mfaBox"></div></div>';
  }

  // ---------- actions ----------
  function act(a, el) {
    var c = TA.d;
    if (a === 'retry') return show();
    if (a === 'logout') { St.logout(); TA.open = false; A.toast('Logout ho gaye'); return loginScreen(); }
    if (a === 'edit-site') { sessionStorage.setItem('tajv2b-edit', '1'); TA.open = false; location.hash = '#/'; return; }
    if (a === 'text-reset') return run(St.removeText(el.dataset.key), 'Default par wapas');
    if (a === 'asset-reset') return run(St.removeAsset(el.dataset.key), 'Default laga diya');
    if (a === 'undo') { var h = c.history.filter(function (x) { return String(x.id) === el.dataset.hid; })[0]; if (!h) return; return run(St.undo(h), 'Undo ho gaya'); }
    if (a === 'book-new') return bookForm(null);
    if (a === 'book-edit') return bookForm(c.books.filter(function (b) { return String(b.id) === el.dataset.id; })[0]);
    if (a === 'book-del') { if (!confirm('Ye kitab hata dein?')) return; return run(St.remove('books', el.dataset.id), 'Kitab hat gayi'); }
    if (a === 'book-up' || a === 'book-down') return swapBook(el.dataset.id, a === 'book-up' ? -1 : 1);
    if (a === 'upd-del') return run(St.remove('updates', el.dataset.id), 'Update hata diya');
    if (a === 'q-del') return run(St.remove('quiz_questions', el.dataset.id), 'Sawal hata diya');
    if (a === 'entry-del') { if (!confirm('Ye entry hata dein?')) return; return run(St.remove('quiz_entries', el.dataset.id), 'Entry hat gayi'); }
    if (a === 'gal-del') { if (!confirm('Hata dein?')) return; return run(St.remove('gallery', el.dataset.id), 'Hata diya'); }
    if (a === 'msg-read') return run(St.update('messages', el.dataset.id, { read: el.dataset.v === '1' }), 'Save ho gaya');
    if (a === 'msg-del') { if (!confirm('Ye message hata dein?')) return; return run(St.remove('messages', el.dataset.id), 'Message hata diya'); }
    if (a === 'com-set') return run(St.update('comments', el.dataset.id, { status: el.dataset.s }), el.dataset.s === 'approved' ? 'Approve ho gaya' : 'Reject ho gaya');
    if (a === 'com-del') { if (!confirm('Comment hata dein?')) return; return run(St.remove('comments', el.dataset.id), 'Comment hata diya'); }
    if (a === 'accent') return run(St.saveSite({ accent: el.dataset.v }), 'Rang badal gaya');
    if (a === 'anim-set') return run(St.saveSite({ animations: el.dataset.v }), 'Animation set ho gaya');
    if (a === 'sizes-save') return run(St.saveSite({ sizes: { mobile: +$('[data-size=mobile]').value, desktop: +$('[data-size=desktop]').value } }), 'Size save');
    if (a === 'export') return exportBackup();
    if (a === 'mfa-start') return mfaStart();
    if (a === 'demo-reset') { St.resetDemo(); A.toast('Demo data reset ho gaya'); return show(); }
  }
  function run(p, okMsg) {
    return p.then(function () { A.toast(okMsg); return refresh(); }).catch(function (e) { A.toast('Nahi hua: ' + e.message); });
  }
  function refresh() { return load().then(function () { draw(); }); }
  function swapBook(id, dir) {
    var list = TA.d.books.slice(); var i = list.findIndex(function (b) { return String(b.id) === String(id); });
    var j = i + dir; if (i < 0 || j < 0 || j >= list.length) return;
    var a = list[i], b = list[j]; var sa = a.sort, sb = b.sort;
    if (sa === sb) { sa = i; sb = j; }
    Promise.all([St.update('books', a.id, { sort: sb }), St.update('books', b.id, { sort: sa })]).then(function () { return refresh(); }).catch(function (e) { A.toast(e.message); });
  }
  function exportBackup() {
    St.exportAll().then(function (o) {
      var blob = new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'paighaam-backup-' + St.ymd() + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }).catch(function (e) { A.toast('Backup nahi bana: ' + e.message); });
  }
  function mfaStart() {
    var box = $('#mfaBox'); box.innerHTML = '<p class="small muted">QR bana rahe hain…</p>';
    St.enrollMfa().then(function (f) {
      box.innerHTML = '<div class="card" style="margin-top:10px;display:grid;gap:8px"><b>1. Authenticator app me QR scan karein</b>' +
        (f.qr ? '<img src="' + esc(f.qr) + '" alt="2FA QR code" style="width:200px;height:200px;background:#fff;padding:8px;border-radius:12px">' : '') +
        '<p class="small muted">Scan na ho to ye key daalein: <code>' + esc(f.secret || '') + '</code></p>' +
        '<b>2. App me jo 6-digit code aaye, yahan daalein</b><form data-f="mfa-verify" data-id="' + esc(f.id) + '" class="form"><input name="code" inputmode="numeric" maxlength="8" required placeholder="123456"><div class="actions"><button class="btn sm" type="submit">Chalu karein</button></div></form>' +
        '<p class="small muted">Chalu hone ke baad owner SQL me ye line chalaye (ek baar): <code>update public.owners set require_mfa = true where user_id = (select id from auth.users where email = \'APNA-EMAIL\');</code> — tab se login par 2FA code zaroor maangega.</p></div>';
    }).catch(function (e) { box.innerHTML = '<p class="small" style="color:#9A3B2E">' + esc(e.message) + '</p>'; });
  }

  // ---------- forms (one delegated handler) ----------
  function submit(f) {
    var k = f.dataset.f;
    if (k === 'text') {
      var key = f.dataset.key, v = f.v.value;
      return run(St.setText(key, v), 'Save ho gaya');
    }
    if (k === 'book') {
      var id = f.dataset.id, cur = TA.d.books.filter(function (b) { return String(b.id) === id; })[0] || {};
      var row = { id: id || ('bk' + Date.now().toString(36)), title_en: f.title_en.value.trim(), title_ur: f.title_ur.value.trim(), writer_en: f.writer_en.value.trim(), writer_ur: f.writer_ur.value.trim(), cat: f.cat.value, jild: f.jild.value.trim(), read: f.read.value.trim(), cover: f.cover.value.trim(), featured: f.featured.checked, sort: cur.sort || (TA.d.books.length + 1) };
      if (row.read && !/^https?:\/\//i.test(row.read)) { $('#bferr').textContent = 'Read link https:// se shuru hona chahiye.'; return; }
      if (row.cover && !/^https?:\/\//i.test(row.cover)) { $('#bferr').textContent = 'Cover link https:// se shuru hona chahiye.'; return; }
      return St.upsert('books', row).then(function () { $('#modal').classList.remove('on'); A.toast('Kitab save ho gayi'); return refresh(); }).catch(function (e) { $('#bferr').textContent = e.message; });
    }
    if (k === 'pg') {
      var d = f.dataset.date; var ro = f.ro.value.trim(), ur = f.ur.value.trim();
      return run(St.upsert('paigam', { id: d, date: d, text_ro: ro, text_ur: ur, source: f.source.value.trim(), sample: false }), 'Paigham save ho gaya');
    }
    if (k === 'upd') {
      var t = f.title.value.trim(); if (!t) return;
      return run(St.insert('updates', { date: f.date.value, title: t, body: f.body.value.trim() }), 'Update add ho gaya');
    }
    if (k === 'quiz') {
      var opts = f.opts.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      var ans = (+f.ans.value || 1) - 1;
      if (opts.length < 2 || ans < 0 || ans >= opts.length) { A.toast('Kam se kam 2 jawab, aur sahi number sahi ho'); return; }
      return run(St.insert('quiz_questions', { id: 'q' + Date.now().toString(36), date: f.date.value, q: f.q.value.trim(), options: opts, answer: ans }), 'Sawal add ho gaya');
    }
    if (k === 'yt') return addYouTube(f.link.value.trim());
    if (k === 'stats') {
      var s = (TA.d.site.stats || []).map(function (x, i) { return { n: +f['n' + i].value || 0, suffix: f['s' + i].value, label: f['l' + i].value }; });
      return run(St.saveSite({ stats: s, stats_note: f.note.value }), 'Stats save');
    }
    if (k === 'taawun') return run(St.saveSite({ taawun: { title: f.title.value, goal: +f.goal.value || 0, raised: +f.raised.value || 0, note: f.note.value } }), "Ta'awun save");
    if (k === 'social') return run(St.saveSite({ social: { facebook: safe(f.facebook.value), instagram: safe(f.instagram.value), youtube: safe(f.youtube.value), x: safe(f.x.value) } }), 'Links save');
    if (k === 'rules') return run(St.saveSite({ quizRules: f.rules.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean), leaderboardVisible: f.lb.checked }), 'Rules save');
    if (k === 'mfa-verify') return St.enrollMfaVerify(f.dataset.id, f.code.value).then(function () { A.toast('2FA chalu ho gaya'); show(); }).catch(function () { A.toast('Code galat hai. Dobara try karein.'); });
  }
  function safe(u) { u = String(u || '').trim(); return /^https:\/\//i.test(u) ? u : ''; }
  function addYouTube(link) {
    var m = link.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    var msg = $('#ytmsg'); if (!m) { msg.textContent = 'Ye YouTube link nahi lag raha.'; return; }
    var id = m[1];
    msg.textContent = 'Title dhund rahe hain…';
    fetch('https://noembed.com/embed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id)).then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (j) {
      var title = (j && j.title) || 'YouTube video';
      return run(St.insert('gallery', { id: 'yt-' + id, kind: 'video', youtube_id: id, title: title }), 'Video laga diya');
    });
  }

  // ---------- photo pick: compress + crop, then save ----------
  function prepImage(file, maxW, ratio) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\//.test(file.type)) return rej(new Error('Ye photo nahi lag rahi.'));
      if (file.size > 15 * 1024 * 1024) return rej(new Error('Photo 15 MB se badi hai. Chhoti photo chunein.'));
      var img = new Image();
      img.onload = function () {
        var sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
        if (ratio) { var want = ratio; if (sw / sh > want) { sw = Math.round(sh * want); sx = Math.round((img.naturalWidth - sw) / 2); } else { sh = Math.round(sw / want); sy = Math.round((img.naturalHeight - sh) / 2); } }
        var scale = Math.min(1, maxW / sw);
        var c = document.createElement('canvas'); c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
        var ctx = c.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
        var q = 0.84;
        var tryBlob = function () {
          c.toBlob(function (b) {
            if (!b) return rej(new Error('Photo convert nahi hui.'));
            if (b.size > 700 * 1024 && q > 0.6) { q -= 0.1; return tryBlob(); }
            res(b);
          }, 'image/jpeg', q);
        };
        tryBlob();
      };
      img.onerror = function () { rej(new Error('Ye file photo nahi khul rahi.')); };
      img.src = URL.createObjectURL(file);
    });
  }
  function onFile(input) {
    var file = input.files && input.files[0]; if (!file) return;
    var msg = $('#upmsg');
    if (input.dataset.akey) {
      var w = +input.dataset.w || 1200, ratio = +input.dataset.ratio || 0;
      msg.textContent = 'Photo tayyar ho rahi hai…';
      prepImage(file, w, ratio || 0).then(function (b) { msg.textContent = 'Upload ho raha hai…'; return St.upload(b, input.dataset.kind + '.jpg'); })
        .then(function (url) { return St.setAsset(input.dataset.akey, url); })
        .then(function () { A.toast('Photo laga diya'); return refresh(); })
        .catch(function (e) { msg.textContent = e.message; });
    } else if (input.dataset.gal) {
      msg.textContent = 'Photo tayyar ho rahi hai…';
      prepImage(file, 1280, 0).then(function (b) { return St.upload(b, 'gallery.jpg'); }).then(function (url) {
        return St.insert('gallery', { id: 'p-' + Date.now().toString(36), kind: 'photo', url: url, title: '', tall: false });
      }).then(function () { A.toast('Photo gallery me aa gayi'); return refresh(); }).catch(function (e) { msg.textContent = e.message; });
    } else if (input.dataset.bookcover !== undefined) {
      var bm = $('#bferr'); if (bm) bm.textContent = 'Cover upload ho raha hai…';
      prepImage(file, 600, 3 / 4).then(function (b) { return St.upload(b, 'cover.jpg'); }).then(function (url) {
        var ci = $('#bf [name=cover]'); if (ci) ci.value = url; if (bm) bm.textContent = 'Cover tayyar. Save dabayein.';
      }).catch(function (e) { if (bm) bm.textContent = e.message; });
    }
  }

  // ---------- events ----------
  function bindOnce() {
    if (TA.bound) return; TA.bound = true;
    document.addEventListener('click', function (e) {
      if (!TA.open && !$('#app .admin-tabs')) return;
      var t = e.target.closest('[data-tab],[data-a],[data-cs]');
      if (!t || !$('#app .admin-tabs')) return;
      if (t.dataset.tab) { e.preventDefault(); return go(t.dataset.tab); }
      if (t.dataset.cs) { TA.cs = t.dataset.cs; return draw(); }
      if (t.dataset.a) { e.preventDefault(); return act(t.dataset.a, t); }
    });
    document.addEventListener('submit', function (e) {
      var f = e.target; if (!f.dataset || !f.dataset.f) return;
      if (f.closest('#app') === null && f.id !== 'bf') return;
      e.preventDefault(); submit(f);
    });
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.matches && el.matches('input[type=file]') && (el.dataset.akey || el.dataset.gal || el.dataset.bookcover !== undefined)) return onFile(el);
      if (el.dataset && el.dataset.sec) {
        var s = Object.assign({}, TA.d.site.sections); s[el.dataset.sec] = el.checked;
        return St.saveSite({ sections: s }).then(function () { A.toast((el.checked ? 'Dikhega: ' : 'Chhupa diya: ') + SECTION_NAMES[el.dataset.sec]); return refresh(); }).catch(function (x) { A.toast(x.message); });
      }
    });
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.id === 'tfilter') { var q = el.value.toLowerCase(); $$('.trow').forEach(function (r) { r.style.display = !q || (r.dataset.search || '').toLowerCase().indexOf(q) >= 0 ? '' : 'none'; }); }
      if (el.id === 'bsearch') { TA.bq = el.value; var pos = el.selectionStart; draw(); var n = $('#bsearch'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
      if (el.dataset && el.dataset.size) { var sp = $(el.dataset.size === 'mobile' ? '#smv' : '#sdv'); if (sp) sp.textContent = el.value + '%'; }
    });
  }

  window.TajAdmin = {
    active: false,
    open: function () {
      TA.open = true; bindOnce();
      if (!St.session()) { loginScreen(); return; }
      show();
    }
  };
  Object.defineProperty(window.TajAdmin, 'active', { get: function () { return TA.open; }, set: function (v) { TA.open = !!v; } });
  window.TajAdmin.route = ROUTE;
})();
