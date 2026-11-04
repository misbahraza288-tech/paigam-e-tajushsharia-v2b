
(function () {
  'use strict';
  var A = window.TajApp, St = window.TajStore, I = window.TajIcons, $ = A.$, $$ = A.$$, esc = A.esc, S = A.S;
  var TABS = [['dash', 'Dashboard', 'home'], ['books', 'Books', 'book'], ['paigam', 'Paigham (30 din)', 'sun'], ['updates', 'Updates', 'chat'], ['quiz', 'Quiz & Leaderboard', 'quiz'], ['media', 'Media & Gallery', 'upload'], ['messages', 'Messages', 'mail'], ['comments', 'Comments', 'users'], ['sections', 'Sections (on/off)', 'shelf'], ['texts', 'Texts & Sizes', 'pencil'], ['stats', 'Stats & Ta\'awun', 'star'], ['settings', 'Settings', 'gear']];
  var cur = 'dash', TA = { active: false, cache: {} };
  var CATS = ['Hadees', 'Sharah', 'Tafseer', 'Fatawa', 'Fiqh', 'Namaz', 'Tasawwuf', 'Radd e Batil', 'Naat', 'Lughat', 'Aqaedah', 'Ilm-Al-Nahw', 'Ilm-Al-Meeras', 'Other'];
  function ad(html) { $('#app').innerHTML = '<div class="demo-banner"><b>' + (St.mode === 'demo' ? 'DEMO MODE — not secure' : 'OWNER PANEL') + '</b>' + (St.mode === 'demo' ? ' · user demo / password demo · data is on this phone only' : ' · live') + '</div>' + html; }
  function login() {
    ad('<section style="padding-top:40px"><div class="wrap" style="max-width:440px"><div class="card"><div class="eyebrow">Owner Panel</div><h2 style="margin:6px 0 14px">Login</h2><form class="form" id="lf"><div class="field"><label for="le">Email / user</label><input id="le" required autocomplete="username"></div><div class="field"><label for="lp">Password</label><input id="lp" type="password" required autocomplete="current-password"></div><p class="small" id="lerr" style="color:#9A3B2E" role="alert"></p><button class="btn" type="submit">Login</button></form>' + (St.mode === 'demo' ? '<p class="small muted" style="margin-top:14px">Demo: <code>demo</code> / <code>demo</code>. Live me ye owner ka apna email aur password hoga.</p>' : '') + '</div></div></section>');
    $('#lf').onsubmit = function (e) { e.preventDefault(); St.login($('#le').value.trim(), $('#lp').value).then(function () { show(); }).catch(function (x) { $('#lerr').textContent = x.message; }); };
  }
  function shell(body) {
    return '<section style="padding-top:20px"><div class="wrap" style="display:grid;gap:18px">' +
      '<div class="admin-top"><div><div class="eyebrow">Owner Panel</div><h2 style="font-size:1.8rem">Paighaam control</h2></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-go="#/">' + I.svg('arrow') + 'Site dekhein</button><button class="btn ghost sm" data-logout>' + I.svg('logout') + 'Logout</button></div></div>' +
      '<div class="admin-tabs">' + TABS.map(function (t) { return '<button class="' + (t[0] === cur ? 'on' : '') + '" data-tab="' + t[0] + '">' + I.svg(t[2]) + esc(t[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="admin-body">' + body + '</div></div></section>';
  }
  function show() {
    var data = null; TA.active = true;
    Promise.all([St.list('books'), St.list('paigam'), St.list('updates'), St.list('gallery'), St.list('quiz_questions'), St.list('quiz_entries', { order: 'created', desc: true }), St.list('messages', { order: 'created', desc: true }), St.list('comments', { order: 'created', desc: true }), St.getSite()])
      .then(function (r) { TA.cache = { books: r[0], paigam: r[1], updates: r[2], gallery: r[3], quizQ: r[4], entries: r[5], messages: r[6], comments: r[7], site: r[8] }; draw(); })
      .catch(function (e) { ad('<section class="wrap" style="padding-top:40px"><div class="empty">Admin data nahi aaya: ' + esc(e.message) + '<br><a href="#/">Site par wapas</a></div></section>'); });
  }
  function draw() {
    var c = TA.cache, body = '';
    if (cur === 'dash') body = dash(c);
    else if (cur === 'books') body = books(c);
    else if (cur === 'paigam') body = paigam(c);
    else if (cur === 'updates') body = updates(c);
    else if (cur === 'quiz') body = quiz(c);
    else if (cur === 'media') body = media(c);
    else if (cur === 'messages') body = messages(c);
    else if (cur === 'comments') body = comments(c);
    else if (cur === 'sections') body = sections(c);
    else if (cur === 'texts') body = texts(c);
    else if (cur === 'stats') body = stats(c);
    else body = settings(c);
    ad(shell(body));
    bind();
  }
  function bind() {
    $$('[data-tab]').forEach(function (b) { b.onclick = function () { cur = b.dataset.tab; draw(); window.scrollTo(0, 0); }; });
    $$('[data-go]').forEach(function (b) { b.onclick = function () { TA.active = false; location.hash = b.dataset.go; }; });
    $$('[data-logout]').forEach(function (b) { b.onclick = function () { St.logout(); sessionStorage.removeItem('tajv2b-edit'); TA.active = false; cur = 'dash'; login(); }; });
    $$('[data-act]').forEach(function (b) { b.onclick = function () { handle(b.dataset.act, b); }; });
    $$('form[data-form]').forEach(function (f) { f.onsubmit = function (e) { e.preventDefault(); formSubmit(f); }; });
    $$('[data-rm]').forEach(function (b) { b.onclick = function () { if (!confirm('Delete karein?')) return; St.remove(b.dataset.table, b.dataset.rm).then(function () { A.toast('Delete ho gaya'); reload(); }).catch(function (e) { A.toast(e.message); }); }; });
    $$('[data-save-sec]').forEach(function (b) { b.onchange = function () { var s = Object.assign({}, TA.cache.site.sections); s[b.dataset.saveSec] = b.checked; St.saveSite({ sections: s }).then(function (x) { TA.cache.site = x; A.toast('Save ho gaya: ' + b.dataset.saveSec + (b.checked ? ' on' : ' off')); }); }; });
  }
  function reload() { return show(); }
  function handle(act, el) {
    if (act === 'edit-book') return bookForm(TA.cache.books.find(function (b) { return String(b.id) === el.dataset.id; }));
    if (act === 'new-book') return bookForm(null);
    if (act === 'paigam-save') return paigamSave(el);
    if (act === 'quiz-new') return quizQForm(null);
    if (act === 'quiz-edit') return quizQForm(TA.cache.quizQ.find(function (q) { return q.id === el.dataset.id; }));
    if (act === 'visual') { sessionStorage.setItem('tajv2b-edit', '1'); TA.active = false; location.hash = '#/'; }
    if (act === 'msg-read') return msgToggle(el.dataset.id, el.dataset.to === '1');
    if (act === 'cm') return commentSet(el.dataset.id, el.dataset.status);
    if (act === 'yt') return ytAdd();
    if (act === 'reset-demo') { if (confirm('Demo ka saara data reset hoga. Pakka?')) { St.resetDemo(); location.reload(); } return; }
    if (act === 'quizrules') return saveRules();
  }
  // ---- dashboard
  function dash(c) {
    var unread = c.messages.filter(function (m) { return !m.read; }).length, pend = c.comments.filter(function (x) { return x.status === 'pending'; }).length;
    var today = St.ymd(); var todayQ = c.quizQ.filter(function (q) { return q.date === today; }).length;
    var card = function (n, l, sub) { return '<div class="kcard"><b>' + n + '</b><span>' + esc(l) + '</span>' + (sub ? '<small class="muted">' + esc(sub) + '</small>' : '') + '</div>'; };
    return '<div class="kgrid">' + card(c.books.length, 'Kitabein', c.books.filter(function (b) { return !b.read; }).length + ' bina link') + card(unread, 'Naye messages', c.messages.length + ' total') + card(pend, 'Comments pending', c.comments.length + ' total') + card(c.entries.length, 'Quiz entries', 'sirf admin dekhta hai') + card(todayQ, 'Aaj ke sawal', St.ymd()) + card(c.updates.length, 'Updates') + card(c.gallery.filter(function (g) { return g.kind === 'photo'; }).length, 'Gallery photos') + card(c.paigam.filter(function (p) { return p.date >= today; }).length, 'Paigham aage ke din', 'date-keyed') + '</div>' +
      '<div class="card" style="margin-top:14px"><div class="eyebrow">Aaj</div><p style="margin:8px 0 0">' + (St.mode === 'demo' ? 'Demo mode: sab kuch is phone me save hai. Live jaane ke liye README ke 8 steps dekhein.' : 'Live: data Supabase me save hota hai.') + '</p></div>' +
      '<div class="card" style="margin-top:14px"><div class="eyebrow">Shortcuts</div><div class="btnrow"><button class="btn sm" data-tab="messages">Messages dekhein</button><button class="btn sm ghost" data-tab="comments">Comments approve karein</button><button class="btn sm ghost" data-tab="paigam">30 din ka Paigham</button><button class="btn sm ghost" data-act="visual">Visual editor (pencil)</button></div></div>';
  }
  // ---- books
  function books(c) {
    return '<div class="admin-h"><h3>Kitabein (' + c.books.length + ')</h3><button class="btn sm" data-act="new-book">+ Nayi kitab</button></div><p class="small muted">Titles aur writer ke naam original site se hain. Read link Google Drive preview ka hai.</p>' +
      '<div class="tbl"><div class="th"><span>Kitab</span><span>Category</span><span>Jild</span><span></span></div>' + c.books.slice(0, 400).map(function (b) { return '<div class="tr"><span><b>' + esc(b.title_en) + '</b><small class="muted ur"> ' + esc(b.title_ur) + '</small>' + (b.read ? '' : ' <span class="tag-sample">no link</span>') + (b.featured ? ' <span class="tag-sample" style="background:#E8EEE6;color:#2E4A3D">should read</span>' : '') + '</span><span>' + esc(b.cat) + '</span><span>' + esc(b.jild) + '</span><span class="acts"><button class="btn sm ghost" data-act="edit-book" data-id="' + b.id + '">Edit</button><button class="btn sm danger" data-rm="' + b.id + '" data-table="books">' + I.svg('trash') + '</button></span></div>'; }).join('') + '</div>' + (c.books.length > 400 ? '<p class="small muted">Pehli 400 dikh rahi hain.</p>' : '');
  }
  function bookForm(b) {
    b = b || { id: '', cat: 'Other', title_en: '', title_ur: '', writer_en: '', writer_ur: '', jild: '1', jild_ur: '', cover: '', read: '', featured: false, sort: 9999 };
    A.modal(b.id ? 'Kitab edit karein' : 'Nayi kitab', '<form class="form" id="bf" data-form="book"><input type="hidden" name="id" value="' + esc(b.id) + '"><div class="field"><label>Title (English / Roman)</label><input name="title_en" required value="' + esc(b.title_en) + '"></div><div class="field"><label>Title (Urdu / Arabic)</label><input name="title_ur" value="' + esc(b.title_ur) + '" class="ur"></div><div class="field"><label>Writer (English)</label><input name="writer_en" value="' + esc(b.writer_en) + '"></div><div class="field"><label>Writer (Urdu)</label><input name="writer_ur" value="' + esc(b.writer_ur) + '" class="ur"></div><div class="field"><label>Jild</label><input name="jild" value="' + esc(b.jild) + '"></div><div class="field"><label>Category</label><select name="cat">' + CATS.map(function (c2) { return '<option ' + (c2 === b.cat ? 'selected' : '') + '>' + esc(c2) + '</option>'; }).join('') + '</select></div><div class="field"><label>Cover image link (ya upload Media me)</label><input name="cover" value="' + esc(b.cover) + '"></div><div class="field"><label>Read link (Drive/PDF preview)</label><input name="read" value="' + esc(b.read) + '"></div><label class="small"><input type="checkbox" name="featured" ' + (b.featured ? 'checked' : '') + '> Should Read me dikhayein</label><p class="small" id="bferr" style="color:#9A3B2E"></p><div class="actions"><button class="btn ghost sm" type="button" data-close>Cancel</button><button class="btn sm" type="submit">Save</button></div></form>', '');
    $('#bf').onsubmit = function (e) {
      e.preventDefault(); var f = e.target; var row = { cat: f.cat.value, title_en: f.title_en.value.trim(), title_ur: f.title_ur.value.trim(), writer_en: f.writer_en.value.trim(), writer_ur: f.writer_ur.value.trim(), jild: f.jild.value.trim(), cover: f.cover.value.trim(), read: f.read.value.trim(), featured: f.featured.checked, sort: b.sort || 9999 };
      if (f.id.value) row.id = f.id.value; else row.id = 'b' + Date.now().toString(36);
      St.upsert('books', row).then(function () { $('#modal').classList.remove('on'); A.toast('Kitab save ho gayi'); reload(); }).catch(function (x) { $('#bferr').textContent = x.message; });
    };
  }
  function formSubmit(f) { /* placeholder for generic forms */ }
  // ---- paigham
  function paigam(c) {
    var today = St.ymd(); var days = []; for (var i = 0; i < 30; i++) days.push(St.addDays(i));
    var map = {}; c.paigam.forEach(function (p) { map[p.date] = p; });
    return '<h3>Paigham — 30 din ka schedule</h3><p class="small muted">Har din ka Paigham us date par khud dikhega (raat 12 baje IST se). Abhi sab "sample" hain — owner apna asli text likhega. Quran/Hadees ka text sirf owner ka ho.</p>' +
      days.map(function (d) { var p = map[d] || { date: d, text_ro: '', text_ur: '', source: '' }; return '<form class="card pg" data-form="pg" data-date="' + d + '"><div class="pgh"><b>' + esc(A.fmtDate ? A.fmtDate(d) : d) + '</b>' + (d === today ? ' <span class="tag-sample" style="background:#E8EEE6;color:#2E4A3D">aaj</span>' : '') + (p.sample ? ' <span class="tag-sample">sample</span>' : '') + '</div><div class="field"><label>Text (Roman/English)</label><textarea name="text_ro">' + esc(p.text_ro) + '</textarea></div><div class="field"><label>Urdu/Arabic text (optional)</label><textarea class="ur" name="text_ur">' + esc(p.text_ur) + '</textarea></div><div class="field"><label>Source (kis kitab/hadees se) — owner likhe</label><input name="source" value="' + esc(p.source) + '"></div><div><button class="btn sm" type="submit">Save din</button></div></form>'; }).join('');
  }
  function paigamSave(el) {}
  // ---- updates
  function updates(c) {
    return '<div class="admin-h"><h3>Updates</h3></div><form class="card" data-form="upd" style="display:grid;gap:10px"><div class="field"><label>Date</label><input type="date" name="date" value="' + St.ymd() + '" required></div><div class="field"><label>Title</label><input name="title" required maxlength="120"></div><div class="field"><label>Detail</label><textarea name="body"></textarea></div><div><button class="btn sm" type="submit">Update jodein</button></div></form>' +
      '<div class="tbl" style="margin-top:14px">' + c.updates.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (u) { return '<div class="tr"><span><b>' + esc(u.title) + '</b><br><small class="muted">' + esc(u.date) + ' — ' + esc(u.body) + '</small></span><span></span><span></span><span class="acts"><button class="btn sm danger" data-rm="' + u.id + '" data-table="updates">' + I.svg('trash') + '</button></span></div>'; }).join('') + '</div>';
  }
  // ---- quiz
  function quiz(c) {
    var today = St.ymd(); var qs = c.quizQ.filter(function (q) { return q.date === today; });
    var ent = c.entries.filter(function (x) { return x.date === today; });
    var rules = (S.site.quizRules || []).join('\n');
    return '<div class="admin-h"><h3>Aaj ka quiz (' + esc(today) + ')</h3><button class="btn sm" data-act="quiz-new">+ Sawal</button></div>' +
      '<div class="tbl">' + (qs.length ? qs.map(function (q, i) { return '<div class="tr"><span>' + (i + 1) + '. ' + esc(q.q) + '<br><small class="muted">' + q.options.map(function (o, j) { return (j === q.answer ? '<b>' + esc(o) + '✓</b>' : esc(o)); }).join(' · ') + '</small></span><span></span><span></span><span class="acts"><button class="btn sm ghost" data-act="quiz-edit" data-id="' + q.id + '">Edit</button><button class="btn sm danger" data-rm="' + q.id + '" data-table="quiz_questions">' + I.svg('trash') + '</button></span></div>'; }).join('') : '<div class="tr"><span class="muted">Aaj ka koi sawal nahi — site par "No active quiz" dikhega.</span></div>') + '</div>' +
      '<div class="eyebrow" style="margin-top:22px">Entries (private — sirf admin)</div><div class="tbl">' + (ent.length ? '<div class="th"><span>Naam / phone</span><span>Address</span><span>Score</span><span></span></div>' + ent.map(function (x) { return '<div class="tr"><span><b>' + esc(x.full_name) + '</b><br><small>' + esc(x.phone) + '</small></span><span class="small">' + esc(x.address) + '</span><span><b>' + esc(x.score) + '</b>/' + esc(x.total) + '</span><span class="acts"><button class="btn sm danger" data-rm="' + x.id + '" data-table="quiz_entries">' + I.svg('trash') + '</button></span></div>'; }).join('') : '<div class="tr"><span class="muted">Abhi entry nahi.</span></div>') + '</div>' +
      '<div class="card" style="margin-top:18px"><div class="eyebrow">Leaderboard & rules</div><label class="small" style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" data-lbtoggle ' + (S.site.leaderboardVisible ? 'checked' : '') + '> Leaderboard site par dikhayein (sirf pehla naam + score)</label><div class="field"><label>Rules (ek line me ek rule) — DRAFT, owner badle</label><textarea id="rules">' + esc(rules) + '</textarea></div><div style="margin-top:8px"><button class="btn sm" data-act="quizrules">Rules save</button></div></div>' +
      '<div class="card" style="margin-top:14px"><div class="eyebrow">Quiz ka time</div><p class="small muted" style="margin:6px 0 0">Har din ka quiz date ke hisaab se chalta hai (IST). Agle 30 din ka quiz "Quiz" me har din ka alag sawal set karke daal sakte hain — is version me ek din ka form hai; aage ke din Date badal kar daalein.</p><div class="field" style="margin-top:10px"><label>Date (kis din ka sawal)</label><input type="date" id="qdate" value="' + today + '"></div></div>';
  }
  function quizQForm(q) {
    q = q || { id: '', q: '', options: ['', '', ''], answer: 0, date: St.ymd() };
    A.modal(q.id ? 'Sawal edit' : 'Naya sawal', '<form class="form" data-form="qq"><input type="hidden" name="id" value="' + esc(q.id) + '"><div class="field"><label>Date</label><input type="date" name="date" value="' + esc(q.date) + '" required></div><div class="field"><label>Sawal</label><textarea name="q" required>' + esc(q.q) + '</textarea></div><div class="field"><label>Options (ek line me ek)</label><textarea name="opts" required>' + esc(q.options.join('\n')) + '</textarea></div><div class="field"><label>Sahi jawab (option number, 1 se)</label><input type="number" min="1" max="4" name="ans" value="' + (q.answer + 1) + '" required></div><div class="actions"><button class="btn ghost sm" type="button" data-close>Cancel</button><button class="btn sm" type="submit">Save</button></div></form>', '');
    $('#modal form').onsubmit = function (e) { e.preventDefault(); var f = e.target; var opts = f.opts.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); var ans = (+f.ans.value || 1) - 1; if (opts.length < 2 || ans < 0 || ans >= opts.length) { A.toast('Options aur sahi jawab check karein'); return; }
      var row = { date: f.date.value, q: f.q.value.trim(), options: opts, answer: ans }; if (f.id.value) row.id = f.id.value; else row.id = 'q' + Date.now().toString(36);
      St.upsert('quiz_questions', row).then(function () { $('#modal').classList.remove('on'); A.toast('Sawal save'); reload(); }).catch(function (x) { A.toast(x.message); }); };
  }
  function saveRules() {
    var lines = $('#rules').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var lb = $('[data-lbtoggle]').checked;
    St.saveSite({ quizRules: lines, leaderboardVisible: lb }).then(function (x) { TA.cache.site = x; S.site = x; A.toast('Rules save'); }).catch(function (e) { A.toast(e.message); });
  }
  // ---- media
  function media(c) {
    var vid = c.gallery.find(function (g) { return g.kind === 'video'; }) || {};
    return '<h3>Media manager</h3><p class="small muted">Phone se photo chunein — site par auto chhoti (compress) hokar lag jayegi. Hero, kitab cover ya gallery.</p>' +
      '<form class="card" data-form="up" style="display:grid;gap:12px"><div class="field"><label>Photo</label><input type="file" name="file" accept="image/*" required></div><div class="field"><label>Kahan lagaayein</label><select name="target"><option value="gallery">Gallery</option><option value="hero">Hero (home ki photo)</option><option value="cover">Kitab cover (book ID niche)</option></select></div><div class="field"><label>Kitab ID (sirf cover ke liye)</label><input name="bookid" placeholder="jaise b12"></div><div class="field"><label>Caption</label><input name="caption" maxlength="120"></div><div><button class="btn sm" type="submit">' + I.svg('upload') + 'Upload & place</button></div><p class="small" id="upmsg" role="status"></p></form>' +
      '<div class="card" style="margin-top:16px"><div class="eyebrow">Featured video (YouTube)</div><p class="small muted">YouTube ka link paste karein. Title aur thumbnail apne aap aayenge.</p><div class="field" style="margin-top:8px"><label>YouTube link</label><input id="yturl" placeholder="https://youtu.be/…" value="' + esc(vid.youtube_id ? 'https://youtu.be/' + vid.youtube_id : '') + '"></div><div style="margin-top:8px"><button class="btn sm" data-act="yt">Video lagaayein</button> <span id="ytmsg" class="small muted"></span></div>' + (vid.youtube_id ? '<p class="small" style="margin-top:8px">Abhi lagi: ' + esc(vid.title) + '</p>' : '') + '</div>' +
      '<div class="eyebrow" style="margin-top:22px">Gallery (' + c.gallery.filter(function (g) { return g.kind === 'photo'; }).length + ')</div><div class="tbl">' + c.gallery.filter(function (g) { return g.kind === 'photo'; }).map(function (g) { return '<div class="tr"><span>' + (g.url ? '<img src="' + esc(g.url) + '" style="width:60px;border-radius:8px">' : '<span class="muted">photo slot (abhi khali)</span>') + ' <span class="small">' + esc(g.title) + '</span></span><span></span><span></span><span class="acts"><button class="btn sm danger" data-rm="' + g.id + '" data-table="gallery">' + I.svg('trash') + '</button></span></div>'; }).join('') + '</div>';
  }
  function fileToJpeg(file, maxW, aspect) {
    return new Promise(function (res, rej) {
      var img = new Image(); img.onload = function () {
        var w = img.width, h = img.height, sx = 0, sy = 0;
        if (aspect) { var r = w / h; if (r > aspect) { var nw = h * aspect; sx = (w - nw) / 2; w = nw; } else { var nh = w / aspect; sy = (h - nh) / 2; h = nh; } }
        var scale = Math.min(1, maxW / w); var c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        c.getContext('2d').drawImage(img, sx, sy, w, h, 0, 0, c.width, c.height);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('Photo convert nahi hui')); }, 'image/jpeg', 0.82);
      }; img.onerror = function () { rej(new Error('Ye file photo nahi lag rahi')); }; img.src = URL.createObjectURL(file);
    });
  }
  function ytId(u) { var m = String(u).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : null; }
  function ytAdd() {
    var id = ytId($('#yturl').value); if (!id) { $('#ytmsg').textContent = 'Link sahi nahi lag raha'; return; }
    $('#ytmsg').textContent = 'Title dhoondh rahe hain…';
    fetch('https://noembed.com/embed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id)).then(function (r) { return r.json(); }).then(function (j) { return j.title || 'Featured video'; }).catch(function () { return 'Featured video'; }).then(function (title) {
      return St.upsert('gallery', { id: 'v1', kind: 'video', youtube_id: id, title: title }).then(function () { A.toast('Video laga diya'); reload(); });
    }).catch(function (e) { $('#ytmsg').textContent = e.message; });
  }
  // ---- messages
  function messages(c) {
    if (!c.messages.length) return '<div class="empty">Abhi koi message nahi. Jab koi form bhejega, yahan aayega.</div>';
    return '<div class="admin-h"><h3>Messages (' + c.messages.length + ')</h3><span class="small muted">' + c.messages.filter(function (m) { return !m.read; }).length + ' unread</span></div>' + c.messages.map(function (m) {
      var digits = String(m.phone || '').replace(/[^0-9]/g, ''); if (digits && digits.length === 10) digits = '91' + digits;
      var wa = digits ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/' + digits + '?text=' + encodeURIComponent('Assalamu alaikum ' + m.name + ', aapka message mil gaya. — Paighaam-e-Tajushshariah') + '">' + I.svg('whatsapp') + 'WhatsApp reply</a>' : '<span class="small muted">phone nahi diya</span>';
      return '<div class="card msg ' + (m.read ? '' : 'unread') + '"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>' + esc(m.name) + '</b><span class="small muted">' + esc(String(m.created || '').slice(0, 16).replace('T', ' ')) + '</span></div><div class="small muted">' + esc(m.email || '') + ' ' + esc(m.phone || '') + '</div><p style="margin:10px 0">' + esc(m.message) + '</p><div class="btnrow"><button class="btn sm ' + (m.read ? 'ghost' : '') + '" data-act="msg-read" data-id="' + m.id + '" data-to="' + (m.read ? '0' : '1') + '">' + (m.read ? 'Unread karein' : 'Read ✓') + '</button>' + wa + '<button class="btn sm danger" data-rm="' + m.id + '" data-table="messages">' + I.svg('trash') + '</button></div></div>';
    }).join('');
  }
  function msgToggle(id, read) { St.upsert('messages', { id: id, read: read }).then(function () { reload(); }).catch(function (e) { A.toast(e.message); }); }
  // ---- comments
  function comments(c) {
    if (!c.comments.length) return '<div class="empty">Abhi koi comment nahi.</div>';
    return '<h3>Comments (' + c.comments.length + ')</h3><p class="small muted">Approve karne tak comment public nahi hota.</p>' + c.comments.map(function (m) {
      return '<div class="card" style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(m.name) + '</b><span class="tag-sample" style="' + (m.status === 'approved' ? 'background:#E8EEE6;color:#2E4A3D' : '') + '">' + esc(m.status) + '</span></div><p style="margin:8px 0">' + esc(m.message) + '</p><div class="btnrow">' + (m.status !== 'approved' ? '<button class="btn sm" data-act="cm" data-id="' + m.id + '" data-status="approved">Approve</button>' : '') + (m.status !== 'rejected' ? '<button class="btn sm ghost" data-act="cm" data-id="' + m.id + '" data-status="rejected">Reject</button>' : '') + '<button class="btn sm danger" data-rm="' + m.id + '" data-table="comments">' + I.svg('trash') + '</button></div></div>';
    }).join('');
  }
  function commentSet(id, status) { St.upsert('comments', { id: id, status: status }).then(function () { A.toast(status === 'approved' ? 'Approve ho gaya' : 'Reject ho gaya'); reload(); }).catch(function (e) { A.toast(e.message); }); }
  // ---- sections
  function sections(c) {
    var labels = { stats: 'Stats bar', explore: 'Explore cards (Library/Quiz)', paigham: 'Aaj ka Paigham', scholar: 'Taj Scholar of the Day', updates: 'Latest Updates', media: 'Video & Gallery', about: 'About / Mission', history: 'Our History', taawun_bar: "Ta'awun goal bar", khidmat: 'Hamari Khidmat', contact: 'Share Your Thoughts (form)', comments: 'Comments' };
    return '<h3>Sections on / off</h3><p class="small muted">Switch off karne se section site se turant hat jayega. Layout kharab nahi hoga.</p><div class="card">' + Object.keys(labels).map(function (k) { return '<label class="swrow"><span>' + esc(labels[k]) + '</span><input type="checkbox" data-save-sec="' + k + '" ' + (c.site.sections[k] !== false ? 'checked' : '') + '></label>'; }).join('') + '</div>';
  }
  // ---- texts & sizes
  function texts(c) {
    var sz = c.site.sizes || { mobile: 100, desktop: 100 };
    return '<h3>Text size & visual editor</h3><div class="card" style="display:grid;gap:14px"><div class="field"><label>Mobile text size: <b id="smv">' + sz.mobile + '%</b></label><input type="range" min="80" max="130" value="' + sz.mobile + '" id="smob"></div><div class="field"><label>Desktop text size: <b id="sdv">' + sz.desktop + '%</b></label><input type="range" min="80" max="130" value="' + sz.desktop + '" id="sdes"></div><div><button class="btn sm" data-act="sizes">Size save</button></div></div>' +
      '<div class="card" style="margin-top:16px"><div class="eyebrow">Visual editor</div><p class="small muted">Site ka asli page khulega, har text par pencil ✏️ dikhega. Tap karke text ya link badlein, Save dabayein.</p><div style="margin-top:10px"><button class="btn sm" data-act="visual">Visual editor kholein</button></div></div>';
  }
  // ---- stats & taawun
  function stats(c) {
    var st = c.site.stats || [], t = c.site.taawun || {}, so = c.site.social || {};
    return '<h3>Stats, Ta\'awun aur links</h3><p class="small muted">Stats ke numbers original site ke apne claims hain — unverified. Owner check karke badle.</p>' +
      '<form class="card" data-form="stats" style="display:grid;gap:10px">' + st.map(function (s, i) { return '<div class="field" style="grid-template-columns:1fr 1fr 1fr;display:grid;gap:8px"><input name="n' + i + '" value="' + esc(s.n) + '" type="number"><input name="s' + i + '" value="' + esc(s.suffix) + '"><input name="l' + i + '" value="' + esc(s.label) + '"></div>'; }).join('') +
      '<div class="field"><label>Stats note</label><input name="statsnote" value="' + esc(c.site.stats_note || '') + '"></div><hr style="border:0;border-top:1px solid var(--line)">' +
      '<div class="field"><label>Ta\'awun project ka naam (owner likhe)</label><input name="tt" value="' + esc(t.title || '') + '"></div><div class="field"><label>Goal (₹)</label><input name="tg" type="number" value="' + esc(t.goal || 0) + '"></div><div class="field"><label>Jama hua (₹) — owner update karega</label><input name="tr" type="number" value="' + esc(t.raised || 0) + '"></div><div class="field"><label>Note</label><input name="tn" value="' + esc(t.note || '') + '"></div>' +
      '<hr style="border:0;border-top:1px solid var(--line)"><div class="field"><label>Facebook link</label><input name="fb" value="' + esc(so.facebook || '') + '"></div><div class="field"><label>Instagram link</label><input name="ig" value="' + esc(so.instagram || '') + '"></div><div class="field"><label>YouTube link</label><input name="yt" value="' + esc(so.youtube || '') + '"></div><div class="field"><label>X link</label><input name="x" value="' + esc(so.x || '') + '"></div>' +
      '<div><button class="btn sm" type="submit">Save</button></div></form>';
  }
  // ---- settings
  function settings(c) {
    return '<h3>Settings</h3><div class="card" style="display:grid;gap:12px"><p style="margin:0">Mode: <b>' + (St.mode === 'demo' ? 'DEMO (is phone par)' : 'LIVE (Supabase)') + '</b></p><p class="small muted" style="margin:0">Owner ka login badalna ho to Supabase me Auth → Users. Demo ka data reset karne ke liye neeche.</p>' + (St.mode === 'demo' ? '<div><button class="btn sm danger" data-act="reset-demo">Demo data reset karein</button></div>' : '') + '</div><p class="small muted" style="margin-top:14px">Setup steps: README.md (8 steps) aur docs/KNOWLEDGE.md.</p>';
  }
  // ---- delegated forms
  function generic(f) {}
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f || !f.dataset || !f.dataset.form) return;
    e.preventDefault();
    var k = f.dataset.form;
    if (k === 'upd') { var d = f.date.value, t = f.title.value.trim(); if (!t) return; St.upsert('updates', { date: d, title: t, body: f.body.value.trim() }).then(function () { A.toast('Update jud gaya'); f.reset(); reload(); }); }
    if (k === 'pg') { var row = { id: f.dataset.date, date: f.dataset.date, text_ro: f.text_ro.value.trim(), text_ur: f.text_ur.value.trim(), source: f.source.value.trim(), sample: false }; St.upsert('paigam', row).then(function () { A.toast('Din save: ' + f.dataset.date); }).catch(function (x) { A.toast(x.message); }); }
    if (k === 'stats') {
      var st = (TA.cache.site.stats || []).map(function (s, i) { return { n: +f['n' + i].value || 0, suffix: f['s' + i].value, label: f['l' + i].value }; });
      var taawun = { title: f.tt.value, goal: +f.tg.value || 0, raised: +f.tr.value || 0, note: f.tn.value };
      St.saveSite({ stats: st, stats_note: f.statsnote.value, taawun: taawun, social: { facebook: f.fb.value.trim(), instagram: f.ig.value.trim(), youtube: f.yt.value.trim(), x: f.x.value.trim() } }).then(function (x) { TA.cache.site = x; S.site = x; A.toast('Save ho gaya'); }).catch(function (x) { A.toast(x.message); });
    }
    if (k === 'up') {
      var file = f.file.files[0]; if (!file) return; $('#upmsg').textContent = 'Compress ho raha hai…';
      var target = f.target.value, aspect = target === 'hero' ? 4 / 5 : target === 'cover' ? 3 / 4 : null, maxW = target === 'hero' ? 900 : 1200;
      fileToJpeg(file, maxW, aspect).then(function (blob) {
        var path = target + '/' + Date.now().toString(36) + '.jpg';
        return St.upload(blob, path).then(function (url) {
          if (target === 'gallery') return St.upsert('gallery', { id: 'g' + Date.now().toString(36), kind: 'photo', url: url, title: f.caption.value || 'Photo' });
          if (target === 'hero') return St.saveSite({ hero_url: url });
          if (target === 'cover') { var b = TA.cache.books.find(function (x) { return String(x.id) === f.bookid.value.trim(); }); if (!b) throw new Error('Kitab ID nahi mili'); return St.upsert('books', Object.assign({}, b, { cover: url })); }
        });
      }).then(function () { A.toast('Photo laga diya'); reload(); }).catch(function (x) { $('#upmsg').textContent = x.message; });
    }
    if (k === 'qq') {}
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'smob') $('#smv').textContent = e.target.value + '%'; if (e.target.id === 'sdes') $('#sdv').textContent = e.target.value + '%'; });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act=sizes]'); if (!b) return;
    St.saveSite({ sizes: { mobile: +$('#smob').value, desktop: +$('#sdes').value } }).then(function (x) { TA.cache.site = x; S.site = x; A.applyPrefs(); A.toast('Size save'); });
  });
  window.TajAdmin = {
    active: false,
    open: function () {
      TA.active = true;
      if (!St.session()) { login(); return; }
      cur = cur || 'dash'; show();
    }
  };
})();
