
(function () {
  'use strict';
  var I = window.TajIcons, St = window.TajStore;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var SVG = function (n, c) { return I.svg(n, c); };
  var S = { site: null, books: [], paigam: [], updates: [], gallery: [], quizQ: [], comments: [], lb: [], scholar: null, today: St.ymd(), ready: false };
  var ACCENTS = { sage: ['#4F6F5E', '#2E4A3D'], teal: ['#3E6B6B', '#274A4A'], clay: ['#9C6B5A', '#6E4536'], slate: ['#5C6F8A', '#3D4D66'], olive: ['#6B7A3E', '#4A5628'], plum: ['#7A5C75', '#533C50'] };
  var PREF = { theme: localStorage.getItem('taj-theme') || 'light', uscale: parseFloat(localStorage.getItem('taj-uscale') || '1'), anim: localStorage.getItem('taj-anim') || '' };
  function shakeEl(el) { var f = (el && el.closest && el.closest('form')) || el; if (!f) return; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
  var IMG_FALLBACK = '';
  var ADMIN_ROUTE = (window.TAJ_CONFIG && window.TAJ_CONFIG.adminRoute) || 'tajush-desk';
  var openBook = null;

  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600); }
  function T(k, def) { var o = S.site && S.site.texts && S.site.texts[k]; return esc(o && o.text != null && o.text !== '' ? o.text : def); }
  function TL(k) { return safeUrl(T_raw(k + '.url')); }
  function T_raw(k) { var o = S.site && S.site.texts && S.site.texts[k]; return o && o.text != null ? o.text : null; }
  // Only https, http, mailto, tel and in-site links ever reach an href.
  function safeUrl(u) { u = String(u == null ? '' : u).trim(); if (!u) return ''; if (/^(https?:|mailto:|tel:)/i.test(u) || /^#\//.test(u) || /^assets\//.test(u)) return u; return ''; }
  function on(sec) { return !S.site || !S.site.sections || S.site.sections[sec] !== false; }
  function hijri(d) { try { return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d || new Date()); } catch (e) { return ''; } }
  function fmtDate(ymd) { var p = ymd.split('-'); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
  function nextMidnightMs() { var now = new Date(); var ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })); var diff = ist.getTime() - now.getTime(); var m = new Date(ist); m.setHours(24, 0, 0, 0); return m.getTime() - ist.getTime(); }
  function bookCover(b) { return b.cover ? '<img loading="lazy" src="' + esc(b.cover) + '" alt="Cover: ' + esc(b.title_en) + '">' : '<div class="ph" style="display:flex;align-items:center;justify-content:center;height:100%">' + I.ornament('') + '</div>'; }

  // ----- theme, size, sheet, drawer -----
  function applyPrefs() {
    document.body.classList.toggle('dark', PREF.theme === 'dark');
    var lvl = PREF.anim || (S.site && S.site.animations) || 'full';
    document.body.classList.remove('anim-full', 'anim-light', 'anim-off'); document.body.classList.add('anim-' + (['full', 'light', 'off'].indexOf(lvl) >= 0 ? lvl : 'full'));
    var mobile = window.innerWidth < 700;
    var owner = S.site && S.site.sizes ? (mobile ? S.site.sizes.mobile : S.site.sizes.desktop) / 100 : 1;
    document.documentElement.style.setProperty('--scale', (owner * PREF.uscale).toFixed(3));
    var acc = ACCENTS[(S.site && S.site.accent) || 'sage'] || ACCENTS.sage;
    if (PREF.theme !== 'dark') { document.documentElement.style.setProperty('--sage', acc[0]); document.documentElement.style.setProperty('--sage-deep', acc[1]); } else { document.documentElement.style.removeProperty('--sage'); document.documentElement.style.removeProperty('--sage-deep'); }
    var m = $('meta[name=theme-color]'); if (m) m.setAttribute('content', PREF.theme === 'dark' ? '#141A17' : '#FBF8F1');
  }
  function openDrawer(v) { $('#drawer').classList.toggle('on', v); $('#scrim').classList.toggle('on', v); }
  function openSheet(v) { $('#sheet').classList.toggle('on', v); $('#scrim').classList.toggle('on', v); }
  function closeAll() { openDrawer(false); openSheet(false); }
  function modal(title, html, actions) {
    var m = $('#modal'); m.innerHTML = '<div class="box" role="dialog" aria-modal="true"><h3>' + title + '</h3>' + html + '<div class="actions">' + (actions || '<button class="btn ghost sm" data-close>Band karein</button>') + '</div></div>';
    m.classList.add('on'); m.onclick = function (e) { if (e.target === m || e.target.hasAttribute('data-close')) m.classList.remove('on'); };
    return m;
  }
  var LEGAL = {
    privacy: ['Privacy Policy', 'DRAFT — owner to review. Hum sirf wahi data rakhte hain jo aap form me khud bharte hain (naam, email/phone, message). Quiz ka naam, phone aur address sirf admin dekh sakta hai, public nahi hota.'],
    terms: ['Terms of Use', 'DRAFT — owner to review. Is site ka content padhne aur seekhne ke liye hai. Kitab ke links owner ke diye hue hain. Site par koi online payment nahi hota.'],
    taawun: ["Ta'awun Rules", "DRAFT — owner to review. Ta'awun ki details owner share karega. Is site par koi payment ya bank/UPI detail nahi likhi gayi. Progress bar owner khud update karega."]
  };
  function openLegal(k) { var l = LEGAL[k]; modal(l[0], '<p class="muted">' + esc(l[1]) + '</p>'); }

  // ----- chrome -----
  function chrome() {
    $('#drawer').innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="eyebrow">Menu</span><button class="iconbtn" data-act="closeall" aria-label="Band karein">' + SVG('close') + '</button></div>' +
      '<nav>' + [['#/', 'home', 'Home'], ['#/library', 'shelf', 'Taj Library'], ['#/quiz', 'quiz', 'Taj Quiz'], ['#/paigham', 'sun', 'Aaj ka Paigham'], ['#/updates', 'chat', 'Updates'], ['#/media', 'play', 'Videos & Gallery'], ['#/about', 'users', 'About / Mission'], ['#/tawwun', 'heart', 'Tawwun'], ['#/khidmat', 'school', 'Hamari Khidmat'], ['#/contact', 'mail', 'Contact'], ['#/comments', 'chat', 'Comments']].map(function (x) { return '<a href="' + x[0] + '" data-close-drawer>' + SVG(x[1]) + esc(x[2]) + '</a>'; }).join('') + '</nav>' +
      '<div class="legal"><button class="btn ghost sm" data-legal="privacy">Privacy Policy</button><button class="btn ghost sm" data-legal="terms">Terms of Use</button><button class="btn ghost sm" data-legal="taawun">Ta\'awun Rules</button></div>' +
      '<p class="small muted" style="margin-top:18px">Version ' + esc(S.site && S.site.version || '1.0.2') + ' · Powered by QENLYX</p>';
    $('#sheet').innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span class="eyebrow">Settings</span><button class="iconbtn" data-act="closeall" aria-label="Band karein">' + SVG('close') + '</button></div>' +
      '<div class="row"><span>Theme</span><div class="seg" id="seg-theme"><button data-theme="light" class="' + (PREF.theme === 'light' ? 'on' : '') + '">Day</button><button data-theme="dark" class="' + (PREF.theme === 'dark' ? 'on' : '') + '">Night</button></div></div>' +
      '<div class="row"><span>Text size</span><div class="seg"><button data-uscale="0.9">A−</button><button data-uscale="1">A</button><button data-uscale="1.12">A+</button></div></div>' +
      '<div class="row"><span>Animations</span><div class="seg" id="seg-anim"><button data-anim="full" class="' + ((PREF.anim || (S.site && S.site.animations) || 'full') === 'full' ? 'on' : '') + '">Full</button><button data-anim="light" class="' + ((PREF.anim || (S.site && S.site.animations) || 'full') === 'light' ? 'on' : '') + '">Light</button><button data-anim="off" class="' + ((PREF.anim || (S.site && S.site.animations) || 'full') === 'off' ? 'on' : '') + '">Off</button></div></div>' +
      '<div class="row"><span>Install app</span><button class="btn ghost sm" id="install-btn" hidden>' + SVG('install') + 'Install</button></div>' +
      '<div class="row"><span>Offline paigham</span><span class="small muted">Saved on this phone</span></div>' +
      '<p class="ver">Version ' + esc(S.site && S.site.version || '1.0.2') + ' — Powered by QENLYX</p>';
    var path = currentPath();
    var brand = $('.brand');
    if (brand && S.site && S.site.logo_url && !brand.querySelector('img')) { var lg = document.createElement('img'); lg.className = 'brand-logo'; lg.alt = ''; lg.src = S.site.logo_url; lg.onerror = function () { lg.remove(); }; brand.insertBefore(lg, brand.firstChild); }
    var top = [['#/', 'Home'], ['#/library', 'Taj Library'], ['#/quiz', 'Taj Quiz'], ['#/paigham', 'Paigham'], ['#/about', 'About'], ['#/tawwun', 'Tawwun'], ['#/contact', 'Contact']];
    $('#topnav').innerHTML = top.map(function (x) { return '<a href="' + x[0] + '" class="' + (x[0] === '#/' + path.split('/')[0] || (x[0] === '#/' && path === '') ? 'on' : '') + '">' + esc(x[1]) + '</a>'; }).join('');
    var tabs = [['#/', 'home', 'Home', ''], ['#/library', 'book', 'Library', 'library'], ['#/quiz', 'quiz', 'Quiz', 'quiz'], ['#/paigham', 'sun', 'Paigham', 'paigham']];
    $('#tabbar').innerHTML = tabs.map(function (x) { var act = (x[3] && path.indexOf(x[3]) === 0) || (x[3] === '' && path === ''); return '<a href="' + x[0] + '" class="' + (act ? 'on' : '') + '">' + SVG(x[1]) + '<span>' + x[2] + '</span></a>'; }).join('') +
      '<button data-act="more">' + SVG('more') + '<span>More</span></button>';
    applyPrefs();
  }
  function currentPath() { return (location.hash || '#/').replace(/^#\/?/, '').split('?')[0]; }

  // ----- sections -----
  function reveal(root) {
    var els = $$('.rv,.orn-draw,.xcard,.stat b', root || document);
    var io = new IntersectionObserver(function (ents) { ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); if (e.target.hasAttribute('data-n')) countUp(e.target); io.unobserve(e.target); } }); }, { threshold: 0.18 });
    els.forEach(function (el) { io.observe(el); });
  }
  function countUp(el) {
    if (el.dataset.done) return; el.dataset.done = '1';
    var to = +el.dataset.n, suf = el.dataset.suffix || '', t0 = performance.now(), dur = 1600;
    function step(t) { var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(to * e).toLocaleString('en-IN') + suf; if (p < 1) requestAnimationFrame(step); }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) el.textContent = to.toLocaleString('en-IN') + suf; else requestAnimationFrame(step);
  }
  function statsHtml() {
    var st = S.site.stats || [];
    return '<div class="stats rv">' + st.map(function (s) { return '<div class="stat"><b data-n="' + (+s.n || 0) + '" data-suffix="' + esc(s.suffix || '') + '">0</b><span>' + esc(s.label) + '</span></div>'; }).join('') + '</div>' +
      '<p class="small muted center" style="margin-top:8px">' + esc(S.site.stats_note || '') + '</p>';
  }
  function paigamToday() { return S.paigam.find(function (p) { return p.date === S.today; }); }
  function paigamCard(p, withTools) {
    if (!p) return '<div class="empty">Aaj ka Paigham abhi nahi aaya. Roz naya Paigham khud aata hai (date ke hisaab se).</div>';
    var txt = p.text_ro || '';
    var ur = p.text_ur ? '<div class="ur" style="font-size:1.25rem;margin:8px 0">' + esc(p.text_ur) + '</div>' : '';
    return '<div class="paper rv" id="paigam-card" data-text="' + esc(txt) + '">' +
      '<div class="date"><span>' + esc(fmtDate(p.date)) + '</span><span class="hijri">' + esc(hijri()) + '</span></div>' +
      ur + '<div class="text">' + esc(txt) + (p.sample ? '<span class="tag-sample">sample</span>' : '') + '</div>' +
      '<div class="src">' + esc(p.source || '') + '</div>' +
      (withTools ? '<div class="tools"><button class="btn ghost sm" data-act="listen">' + SVG('play') + '<span>Listen</span></button><button class="btn sm" data-act="status">' + SVG('whatsapp') + '<span>WhatsApp Status par share</span></button></div><p class="small muted center" id="listen-note" hidden>Browser ki awaaz — yeh Quran ki tilawat nahi hai.</p>' : '') + '</div>';
  }
  function updatesHtml(limit) {
    var list = S.updates.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, limit || 99);
    if (!list.length) return '<div class="empty">Abhi koi update nahi.</div>';
    var cut = St.addDays(-3);
    return '<ol class="timeline" style="padding:0;margin:0 0 0 6px">' + list.map(function (u) { var isNew = u.date >= cut; return '<li class="rv ' + (isNew ? 'new' : '') + '"><div class="d">' + esc(fmtDate(u.date)) + (isNew ? '<span class="pulse" title="Naya update"></span>' : '') + '</div><h3>' + esc(u.title) + '</h3><p class="muted">' + esc(u.body) + '</p></li>'; }).join('') + '</ol>';
  }
  function featuredVideo() { return S.gallery.find(function (g) { return g.kind === 'video' && g.youtube_id; }); }
  function videoHtml() {
    var v = featuredVideo();
    return '<div class="video-frame rv"><div class="inner">' + (v ? '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(v.youtube_id) + '" title="' + esc(v.title) + '" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>' : '<div class="ph"><div><div style="margin-bottom:8px">' + SVG('play', '') + '</div>Featured video yahan chalegi.<br><span class="small">Owner Admin me YouTube link paste karega.</span></div></div>') + '</div>' + (v ? '<p class="small muted" style="margin:10px 4px 0">' + esc(v.title) + '</p>' : '') + '</div>';
  }
  function galleryHtml(limit) {
    var photos = S.gallery.filter(function (g) { return g.kind === 'photo'; }).slice(0, limit || 99);
    if (!photos.length) return '<div class="empty">Gallery abhi khali hai.</div>';
    return '<div class="masonry">' + photos.map(function (g, i) { return '<button class="rv" data-lb="' + i + '" aria-label="Photo kholein">' + (g.url ? '<img loading="lazy" src="' + esc(g.url) + '" alt="' + esc(g.title) + '">' : '<div class="ph ' + (g.tall ? 'tall' : '') + '">' + I.ornament('') + '</div>') + '</button>'; }).join('') + '</div>';
  }
  function lightboxOpen(i) {
    var photos = S.gallery.filter(function (g) { return g.kind === 'photo'; });
    var g = photos[i]; if (!g) return;
    var lb = $('#lightbox');
    lb.innerHTML = '<button class="x" data-act="lbclose" aria-label="Band karein">' + SVG('close') + '</button><div class="big">' + (g.url ? '<img src="' + esc(g.url) + '" alt="' + esc(g.title) + '">' : '<div style="aspect-ratio:4/3;display:flex;align-items:center;justify-content:center">' + I.ornament('') + '</div>') + '<div class="cap">' + esc(g.title) + '</div></div>';
    lb.classList.add('on');
  }
  function scholarHtml() {
    if (!S.site.leaderboardVisible) return '';
    var s = S.scholar;
    return '<div class="scholar rv">' + I.ornament('') + '<div><div class="eyebrow" data-k="scholar.eyebrow">' + T('scholar.eyebrow', 'Taj Scholar of the Day') + '</div>' + (s ? '<h3 style="margin-top:4px">' + esc(s.first_name) + ' — ' + esc(s.score) + ' score</h3><p class="small muted" style="margin:0">Kal ke quiz ka result. Sirf pehla naam dikhta hai.</p>' : '<p style="margin:4px 0 0" class="muted">Kal ke quiz ka result yahan chamkega.</p>') + '</div></div>';
  }
  function resumeHtml() {
    var r = null; try { r = JSON.parse(localStorage.getItem('taj-last-read') || 'null'); } catch (e) {}
    if (!r) return '';
    return '<div class="resume rv"><div><span class="eyebrow">Continue Reading</span><div style="font-family:var(--serif);font-size:1.2rem">' + esc(r.title) + '</div></div><a class="btn sm" href="#/book/' + r.id + '">' + SVG('arrow') + 'Resume</a></div>';
  }

  // ----- pages -----
  function pageHome() {
    var s = S.site;
    var h = '';
    h += '<section style="padding-top:34px" class="hero"><div class="wrap hero-grid">' +
      '<div class="rv"><div class="eyebrow" data-k="hero.eyebrow">' + T('hero.eyebrow', 'Taj Library · Taj Quiz · Paigham') + '</div>' +
      '<h1 style="margin-top:12px" data-k="hero.title">' + T('hero.title', 'Paighaam-e-Tajushshariah') + '<span class="ur">پیغام تاج الشریعہ</span></h1>' +
      '<p class="tagline" data-k="hero.tagline">' + T('hero.tagline', 'Ilm ko samjhiye, adab ke saath') + '</p>' +
      '<p class="sub" data-k="hero.sub">' + T('hero.sub', 'Kitabein, roz ka Paigham, quiz aur updates — ek saaf, sukoon wali jagah par.') + '</p>' +
      '<div class="ctas"><a class="btn" href="#/library">' + SVG('shelf') + 'Explore Library</a><a class="btn ghost" href="#/quiz">' + SVG('quiz') + "Today's Quiz</a></div>" +
      '<a class="linkline" href="#/about" data-k="hero.learn" data-link>' + T('hero.learn', 'Learn more') + ' ' + SVG('arrow') + '</a></div>' +
      '<div class="rv"><div class="photo-slot">' + (S.site.hero_url ? '<img src="' + esc(S.site.hero_url) + '" alt="" data-hide-broken>' : '') + '<div class="orn">' + I.ornament('') + '</div></div></div>' +
      '</div></section>';
    if (on('stats')) h += '<section style="padding:0 0 40px;border:0"><div class="wrap">' + statsHtml() + '</div></section>';
    if (on('explore')) h += '<section style="padding-top:20px"><div class="wrap"><div class="sec-head rv"><div class="eyebrow">Explore</div><h2 data-k="explore.heading">' + T('explore.heading', 'Do jagah, ek sukoon') + '</h2></div><div class="explore">' +
      '<a class="xcard" href="#/library"><span class="spine"></span>' + SVG('shelf') + '<h3 data-k="explore.library.title">' + T('explore.library.title', 'Taj Library') + '</h3><div class="ur">تاج لائبریری</div><p class="muted" data-k="explore.library.body">' + T('explore.library.body', 'Kitabon ki list, search aur category ke saath. Har kitaab ka apna page.') + '</p><span class="arrow">Library kholein ' + SVG('arrow') + '</span></a>' +
      '<a class="xcard" href="#/quiz"><span class="spine"></span>' + SVG('quiz') + '<h3 data-k="explore.quiz.title">' + T('explore.quiz.title', 'Taj Quiz') + '</h3><div class="ur">تاج کوئز</div><p class="muted" data-k="explore.quiz.body">' + T('explore.quiz.body', 'Roz ka quiz, countdown aur leaderboard. Naam sirf pehla dikhega.') + '</p><span class="arrow">Quiz kholein ' + SVG('arrow') + '</span></a>' +
      '</div></div></section>';
    if (on('paigham')) h += '<section><div class="wrap" style="max-width:820px"><div class="sec-head rv center"><div class="eyebrow">Aaj ka Paigham</div><h2 data-k="paigham.heading">' + T('paigham.heading', 'Aaj ka Paigham') + '</h2></div>' + paigamCard(paigamToday(), true) + '<p class="center" style="margin-top:20px"><a class="linkline" href="#/paigham">Purane Paigham dekhein ' + SVG('arrow') + '</a></p></div></section>';
    if (on('scholar') && S.site.leaderboardVisible) h += '<section style="padding:44px 0"><div class="wrap" style="max-width:820px">' + scholarHtml() + resumeHtml() + '</div></section>';
    else if (on('continue')) h += '<section style="padding:30px 0"><div class="wrap" style="max-width:820px">' + resumeHtml() + '</div></section>';
    if (on('updates')) h += '<section><div class="wrap" style="max-width:820px"><div class="sec-head rv"><div class="eyebrow" data-k="updates.eyebrow">' + T('updates.eyebrow', 'Latest Updates & Announcements') + '</div><h2 data-k="updates.heading">' + T('updates.heading', 'Naye updates') + '</h2></div>' + updatesHtml(4) + '</div></section>';
    if (on('media')) h += '<section><div class="wrap"><div class="sec-head rv"><div class="eyebrow" data-k="media.eyebrow">' + T('media.eyebrow', 'Media') + '</div><h2 data-k="media.heading">' + T('media.heading', 'Video aur Gallery') + '</h2></div>' + videoHtml() + '<div style="height:28px"></div>' + galleryHtml(6) + '<p class="center" style="margin-top:18px"><a class="linkline" href="#/media">Poori gallery ' + SVG('arrow') + '</a></p></div></section>';
    if (on('about')) h += '<section><div class="wrap" style="max-width:820px"><div class="sec-head rv center"><div class="eyebrow" data-k="about.eyebrow">' + T('about.eyebrow', 'About') + '</div><h2 data-k="about.heading">' + T('about.heading', 'Hamara Mission') + '</h2></div><p class="center muted rv" data-k="about.body" style="font-size:1.05rem">' + T('about.body', 'Ye site Paighaam-e-Tajushshariah ki taraf se ek digital library aur quiz ki jagah hai. Mission aur details owner khud likhega.') + '</p><p class="center rv"><a class="linkline" href="#/about">Aur jaane ' + SVG('arrow') + '</a></p></div></section>';
    if (on('history')) h += '<section style="padding-top:20px"><div class="wrap"><div class="sec-head rv"><div class="eyebrow" data-k="history.eyebrow">' + T('history.eyebrow', 'Our History') + '</div><h2 data-k="history.heading">' + T('history.heading', 'Safar') + '</h2><p class="small">Sample timeline — owner asli tareekh daalega.</p></div>' + historyHtml() + '</div></section>';
    if (on('taawun_bar')) h += '<section style="padding-top:20px"><div class="wrap" style="max-width:820px">' + taawunHtml() + '</div></section>';
    if (on('khidmat')) h += '<section><div class="wrap"><div class="sec-head rv"><div class="eyebrow" data-k="khidmat.eyebrow">' + T('khidmat.eyebrow', 'Hamari Khidmat') + '</div><h2 data-k="khidmat.heading">' + T('khidmat.heading', 'Khidmat ke kaam') + '</h2></div>' + khidmatHtml() + '</div></section>';
    if (on('contact')) h += '<section><div class="wrap" style="max-width:720px" id="contact">' + contactHtml() + '</div></section>';
    if (on('comments')) h += '<section id="comments"><div class="wrap" style="max-width:720px">' + commentsHtml() + '</div></section>';
    return h;
  }
  function historyHtml() {
    var items = [['Shuru', 'Pehla qadam', 'SAMPLE — owner likhega.'], ['Library', 'Kitabon ka silsila', 'SAMPLE — owner likhega.'], ['Quiz', 'Roz ka quiz', 'SAMPLE — owner likhega.'], ['Aaj', 'Digital safar', 'SAMPLE — owner likhega.']];
    return '<div class="hscroll rv">' + items.map(function (x) { return '<div class="hcard"><div class="yr">' + esc(x[0]) + '</div><h3 style="margin:10px 0 4px">' + esc(x[1]) + '</h3><p class="small muted" style="margin:0">' + esc(x[2]) + '</p></div>'; }).join('') + '</div>';
  }
  function taawunHtml() {
    var t = S.site.taawun || {}; var goal = +t.goal || 0, raised = +t.raised || 0; var pct = goal ? Math.min(100, Math.round(raised / goal * 100)) : 0;
    return '<div class="card rv"><div class="eyebrow">Ta\'awun Goal</div><h3 style="margin:6px 0 4px" data-k="taawun.title">' + T('taawun.title', esc(t.title || '')) + '</h3><p class="small muted">' + esc(t.note || '') + '</p><div class="bar" style="margin-top:14px"><i data-w="' + pct + '"></i></div><div class="nums"><span>₹' + raised.toLocaleString('en-IN') + ' jama</span><span>Goal ₹' + goal.toLocaleString('en-IN') + ' · ' + pct + '%</span></div></div>';
  }
  function khidmatHtml() {
    return '<div class="grid2">' +
      '<div class="card rv">' + SVG('school', 'khidmat-ico') + '<h3 data-k="khidmat.school">' + T('khidmat.school', 'Muslim Bachhiyon ke liye School') + '</h3><p class="muted" style="margin-top:8px">Details owner likhega: jagah, waqt, aur kaise jud sakte hain.</p></div>' +
      '<div class="card rv">' + SVG('shelf', 'khidmat-ico') + '<h3 data-k="khidmat.library">' + T('khidmat.library', 'Deeni Library Bareilly me') + '</h3><p class="muted" style="margin-top:8px">Details owner likhega: pata, timing aur kitabon ki list.</p></div></div>';
  }
  function contactHtml() {
    return '<div class="card rv" id="contact-card"><div class="eyebrow" data-k="contact.eyebrow">' + T('contact.eyebrow', 'Connect') + '</div><h2 style="margin:6px 0 8px" data-k="contact.heading">' + T('contact.heading', 'Apne khayal share karein') + '</h2><p class="muted" data-k="contact.intro">' + T('contact.intro', 'Message owner tak pahunchega. Owner approve/read karega.') + '</p>' +
      '<form class="form" id="contact-form" novalidate><div class="hp"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<div class="field"><label for="c-name">Naam</label><input id="c-name" name="name" required maxlength="80" autocomplete="name"></div>' +
      '<div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" maxlength="120" autocomplete="email"></div>' +
      '<div class="field"><label for="c-phone">Phone (optional, WhatsApp reply ke liye)</label><input id="c-phone" name="phone" inputmode="tel" maxlength="20"></div>' +
      '<div class="field"><label for="c-msg">Message</label><textarea id="c-msg" name="message" required maxlength="1200"></textarea></div>' +
      '<div><button class="btn" type="submit">Bhejein ' + SVG('mail') + '</button></div><p class="small muted" id="c-err" role="alert"></p></form></div>';
  }
  function commentsHtml() {
    var list = S.comments.filter(function (c) { return c.status === 'approved'; });
    return '<div class="sec-head rv"><div class="eyebrow" data-k="comments.eyebrow">' + T('comments.eyebrow', 'Comments') + '</div><h2 data-k="comments.heading">' + T('comments.heading', 'Comment karein') + '</h2><p class="small">Comment owner approve karega, phir yahan dikhega.</p></div>' +
      '<div class="rv">' + (list.length ? list.map(function (c) { return '<div class="comment"><b>' + esc(c.name) + '</b> <span class="d">· ' + esc(fmtDate(String(c.created || S.today).slice(0, 10))) + '</span><p style="margin:8px 0 0">' + esc(c.message) + '</p></div>'; }).join('') : '<div class="empty" style="margin-bottom:14px">Abhi koi approved comment nahi. Pehla comment aap likh sakte hain.</div>') + '</div>' +
      '<form class="form card rv" id="comment-form" novalidate><div class="hp"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><div class="field"><label for="m-name">Naam</label><input id="m-name" name="name" required maxlength="60"></div><div class="field"><label for="m-msg">Comment</label><textarea id="m-msg" name="message" required maxlength="500"></textarea></div><div><button class="btn" type="submit">Comment bhejein</button></div><p class="small muted" id="m-err" role="alert"></p></form>';
  }
  function footerHtml() {
    var so = S.site.social || {};
    var links = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['x', 'X']].filter(function (x) { return so[x[0]]; });
    return '<footer><div class="wrap"><div class="eyebrow" data-k="footer.follow">' + T('footer.follow', 'Follow Us') + '</div><div class="socials">' + (links.length ? links.map(function (x) { return '<a href="' + esc(safeUrl(so[x[0]])) + '" target="_blank" rel="noopener">' + SVG(x[0]) + esc(x[1]) + '</a>'; }).join('') : ['facebook', 'instagram', 'youtube', 'x'].map(function (n) { return '<span class="small muted" style="display:inline-flex;gap:8px;align-items:center;padding:9px 14px;border:1px dashed var(--line);border-radius:999px">' + SVG(n) + ' link owner add karega</span>'; }).join('')) + '</div>' +
      '<p class="muted small" data-k="footer.note" style="max-width:520px;margin:0 auto">' + T('footer.note', 'Paighaam-e-Tajushshariah — Ilm ko samjhiye, adab ke saath.') + '</p>' +
      '<div class="legal"><a href="#/about">About</a><a href="#/contact">Contact</a><button data-legal="privacy">Privacy Policy</button><button data-legal="terms">Terms of Use</button><button data-legal="taawun">Ta\'awun Rules</button></div>' +
      '<p class="copy" id="copy" title="">© ' + new Date().getFullYear() + ' Paighaam-e-Tajushshariah' + (St.mode === 'demo' ? ' · DEMO' : '') + '</p></div></footer>';
  }
  function pageLibrary(q) {
    var cat = q.cat || 'All';
    var cats = ['All'].concat(Array.from(new Set(S.books.map(function (b) { return b.cat; }))).filter(Boolean));
    var list = S.books.filter(function (b) { return cat === 'All' || b.cat === cat; });
    var term = (q.q || '').trim().toLowerCase();
    if (term) list = list.filter(function (b) { return (b.title_en + ' ' + b.title_ur + ' ' + b.writer_en + ' ' + b.writer_ur).toLowerCase().indexOf(term) >= 0; });
    var feat = S.books.filter(function (b) { return b.featured; });
    var h = '<section style="padding-top:34px"><div class="wrap"><div class="sec-head rv"><div class="eyebrow" data-k="library.eyebrow">' + T('library.eyebrow', 'Taj Library') + '</div><h1 style="font-size:clamp(2rem,5vw,3rem)" data-k="library.heading">' + T('library.heading', 'Kitabein') + '</h1><p>Kitab par tap karein — Read Now se seedha padh sakte hain.</p></div>' +
      resumeHtml() +
      '<div class="toolbar"><label class="search">' + SVG('search') + '<input id="lib-q" type="search" placeholder="Search Books" value="' + esc(q.q || '') + '" aria-label="Search Books"></label></div>' +
      '<div class="chips" role="tablist">' + cats.map(function (c) { return '<button class="chip ' + (c === cat ? 'on' : '') + '" data-cat="' + esc(c) + '">' + esc(c === 'All' ? 'Sab' : c) + '</button>'; }).join('') + '</div>';
    if (!term && cat === 'All' && feat.length) h += '<div class="eyebrow" style="margin:14px 0 8px">Should Read</div><div class="featured-row">' + feat.map(bookCard).join('') + '</div>';
    h += '<div class="eyebrow" style="margin:18px 0 10px">' + (term ? 'Results: ' + list.length : esc(cat === 'All' ? 'Sab kitabein' : cat)) + ' · ' + list.length + '</div>';
    h += list.length ? '<div class="shelf" id="shelf">' + list.slice(0, 120).map(bookCard).join('') + '</div>' : '<div class="empty">Is search par koi kitab nahi mili.</div>';
    if (list.length > 120) h += '<p class="center small muted" style="margin-top:14px">Pehli 120 kitabein dikh rahi hain — search karke aur dhoondhein.</p>';
    return h + '</div></section>';
  }
  function bookCard(b) {
    return '<article class="bk rv" style="--d:0"><a href="#/book/' + b.id + '" class="cov" style="display:block" aria-label="' + esc(b.title_en) + '">' + bookCover(b) + '</a><div class="meta"><div class="ttl">' + esc(b.title_en) + '</div><div class="ttl-ur">' + esc(b.title_ur) + '</div><div class="wr">' + esc(b.writer_en) + ' · Jild ' + esc(b.jild) + '</div><a class="btn" href="#/book/' + b.id + '">Read Now</a></div></article>';
  }
  function pageBook(id) {
    var b = S.books.find(function (x) { return String(x.id) === String(id); });
    if (!b) return '<section class="wrap" style="padding-top:60px"><div class="empty">Kitab nahi mili. <a href="#/library">Library par wapas</a></div></section>';
    return '<section style="padding-top:34px"><div class="wrap"><a class="linkline small" href="#/library">' + SVG('back') + ' Library</a><div class="bookpage" style="margin-top:20px"><div class="cover rv">' + bookCover(b) + '</div><div class="rv"><div class="eyebrow">' + esc(b.cat) + '</div><h1 style="margin:8px 0 4px">' + esc(b.title_en) + '</h1><div class="ur" style="font-size:1.4rem;color:var(--gold)">' + esc(b.title_ur) + '</div>' +
      '<dl class="kv"><dt>Writer</dt><dd>' + esc(b.writer_en) + '</dd><dt>مصنف</dt><dd class="ur" style="text-align:right">' + esc(b.writer_ur) + '</dd><dt>Jild</dt><dd>' + esc(b.jild) + '</dd></dl>' +
      (b.read ? '<div class="ctas" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-act="read" data-id="' + b.id + '">' + SVG('book') + 'Read Now</button><a class="btn ghost" href="' + esc(safeUrl(b.read)) + '" target="_blank" rel="noopener">Naye tab me kholein</a></div><div class="viewer" id="viewer" hidden><iframe title="' + esc(b.title_en) + '" src="" allow="autoplay" loading="lazy"></iframe></div>' : '<p class="muted">Is kitab ka link abhi owner ne nahi dala. Jald aayega.</p>') +
      '</div></div></div></section>';
  }
  function quizState() { return { done: localStorage.getItem('taj-quiz-done-' + S.today) }; }
  function pageQuiz() {
    var qs = S.quizQ, open = qs.length > 0, done = quizState().done;
    var rules = (S.site.quizRules || []).map(function (r, i) { return '<li><b>' + (i + 1) + '</b><span>' + esc(r) + '</span></li>'; }).join('');
    var h = '<section style="padding-top:34px"><div class="wrap"><div class="sec-head rv"><div class="eyebrow" data-k="quiz.eyebrow">' + T('quiz.eyebrow', 'Taj Quiz') + '</div><h1 style="font-size:clamp(2rem,5vw,3rem)" data-k="quiz.heading">' + T('quiz.heading', 'Taj Quiz') + '</h1><p>' + esc(fmtDate(S.today)) + '</p></div>' +
      '<div class="quiz-grid"><div class="rv"><span class="status ' + (open ? '' : 'closed') + '">' + (open ? 'Quiz open hai' : 'Abhi koi active quiz nahi') + '</span>' +
      '<div style="margin-top:18px"><div class="eyebrow" data-k="quiz.next">' + T('quiz.next', 'Agla Quiz Aane Mein') + '</div><div class="countdown" id="cd"><div><b id="cd-h">00</b><span>Ghante</span></div><div><b id="cd-m">00</b><span>Minute</span></div><div><b id="cd-s">00</b><span>Second</span></div></div></div>';
    if (!open) h += '<div class="empty" style="margin-top:14px">No active quiz found. Owner aaj ka quiz add karega to yahan form aayega.</div>';
    h += '<div class="card" style="margin-top:20px"><div class="eyebrow" data-k="quiz.rules">' + T('quiz.rules', 'Rules') + '</div><ul class="rules" style="margin-top:10px">' + rules + '</ul></div></div>';
    h += '<div class="rv">';
    if (open && !done) {
      h += '<form class="form card" id="quiz-form" novalidate><div class="hp"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><div class="field"><label for="qn">Naam</label><input id="qn" name="name" required maxlength="60" autocomplete="name"></div><div class="field"><label for="qp">Phone (sirf admin dekhega)</label><input id="qp" name="phone" inputmode="tel" required maxlength="20"></div><div class="field"><label for="qa">Address (sirf admin dekhega)</label><input id="qa" name="address" required maxlength="160"></div>' +
        qs.map(function (q, i) { return '<div class="qcard" data-qi="' + i + '"><h3>' + (i + 1) + '. ' + esc(q.q) + '</h3>' + q.options.map(function (o, j) { return '<button type="button" class="opt" data-q="' + i + '" data-o="' + j + '"><i></i>' + esc(o) + '</button>'; }).join('') + '</div>'; }).join('') +
        '<button class="btn" type="submit">Quiz submit karein</button><p class="small muted" id="q-err" role="alert"></p></form>';
    } else if (open && done) {
      h += '<div class="card center"><div class="okmsg">' + '<svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="30"/><path d="M22 37l9 9 19-20"/></svg><h3>Aap aaj ka quiz de chuke hain</h3><p class="muted">Score: ' + esc(done) + '</p></div></div>';
    } else {
      h += '<div class="empty">Jab owner aaj ka quiz daalega, form yahan aayega. Tab tak leaderboard dekhein.</div>';
    }
    h += '<div class="card" style="margin-top:20px"><div class="eyebrow" data-k="quiz.leaderboard">' + T('quiz.leaderboard', 'Leaderboard · aaj') + '</div>' + (S.site.leaderboardVisible ? (S.lb.length ? '<ol class="lb" style="margin-top:10px">' + S.lb.map(function (r) { return '<li><span>' + esc(r.first_name) + '</span><b>' + esc(r.score) + '</b></li>'; }).join('') + '</ol>' : '<p class="muted" style="margin-top:8px">Abhi koi score nahi.</p>') : '<p class="muted">Leaderboard owner ne band kiya hai.</p>') + '</div>';
    return h + '</div></div></div></section>';
  }
  function tickCountdown() {
    var el = $('#cd-h'); if (!el) return;
    var ms = nextMidnightMs(); var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    $('#cd-h').textContent = String(h).padStart(2, '0'); $('#cd-m').textContent = String(m).padStart(2, '0'); $('#cd-s').textContent = String(sec).padStart(2, '0');
  }
  function pagePaigham() {
    var list = S.paigam.filter(function (p) { return p.date <= S.today; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 30);
    return '<section style="padding-top:34px"><div class="wrap" style="max-width:820px"><div class="sec-head rv center"><div class="eyebrow" data-k="paigham.eyebrow">' + T('paigham.eyebrow', 'Paigham') + '</div><h1 style="font-size:clamp(2rem,5vw,3rem)">Aaj ka Paigham</h1><p>Har din ka Paigham date ke hisaab se khud aata hai.</p></div>' + paigamCard(paigamToday(), true) +
      '<div class="eyebrow" style="margin:34px 0 10px" data-k="paigham.prev">' + T('paigham.prev', 'Pichle din') + '</div>' + (list.length > 1 ? list.slice(1).map(function (p) { return '<div class="card" style="margin-bottom:10px;padding:16px 18px"><div class="small muted">' + esc(fmtDate(p.date)) + '</div><div style="font-family:var(--serif);font-size:1.15rem">' + esc(p.text_ro) + (p.sample ? '<span class="tag-sample">sample</span>' : '') + '</div></div>'; }).join('') : '<div class="empty">Pichle din ke Paigham yahan jama honge.</div>') + '</div></section>';
  }
  function pageUpdates() { return '<section style="padding-top:34px"><div class="wrap" style="max-width:820px"><div class="sec-head rv"><div class="eyebrow" data-k="updates.eyebrow">' + T('updates.eyebrow', 'Latest Updates & Announcements') + '</div><h1 style="font-size:clamp(2rem,5vw,3rem)">Updates</h1></div>' + updatesHtml() + '</div></section>'; }
  function pageMedia() {
    return '<section style="padding-top:34px"><div class="wrap"><div class="sec-head rv"><div class="eyebrow" data-k="media.page.eyebrow">' + T('media.page.eyebrow', 'Videos & Gallery') + '</div><h1 style="font-size:clamp(2rem,5vw,3rem)">Media</h1></div>' + videoHtml() + '<div class="sec-head rv" style="margin-top:40px"><div class="eyebrow">Gallery</div><h2>Photos</h2></div>' + galleryHtml() + '</div></section>';
  }
  function pageAbout() {
    return '<section style="padding-top:34px"><div class="wrap" style="max-width:820px"><div class="sec-head rv"><div class="eyebrow" data-k="about.eyebrow">' + T('about.eyebrow', 'About') + '</div><h1 style="font-size:clamp(2rem,5vw,3rem)" data-k="about.heading">' + T('about.heading', 'Hamara Mission') + '</h1></div>' +
      '<div class="card rv"><p class="muted" data-k="about.body" style="font-size:1.05rem">' + T('about.body', 'Ye site Paighaam-e-Tajushshariah ki taraf se ek digital library aur quiz ki jagah hai. Mission aur details owner khud likhega.') + '</p><p class="small muted" style="margin-top:14px">DRAFT — owner to review. Mission ka asli text owner ka hoga.</p></div>' +
      '<div style="margin-top:34px" class="rv"><div class="eyebrow" data-k="history.eyebrow">' + T('history.eyebrow', 'Our History') + '</div></div>' + historyHtml() + '<div class="eyebrow" style="margin-top:30px" data-k="about.glance">' + T('about.glance', 'Ek nazar') + '</div><div style="margin-top:12px">' + statsHtml() + '</div></div></section>';
  }
  function pageTawwun() {
    return '<section style="padding-top:34px"><div class="wrap" style="max-width:820px"><div class="sec-head rv"><div class="eyebrow">Tawwun</div><h1 style="font-size:clamp(2rem,5vw,3rem)">Tawwun Page</h1><p data-k="tawwun.intro">' + T('tawwun.intro', 'Welfare ke kaamon ke liye ta\'awun. Details owner share karega.') + '</p></div>' +
      '<div class="card rv"><div class="eyebrow">Welfare Trust</div><h3 style="margin:6px 0">Paigham-e-Tajushshariah Welfare Trust</h3><p class="muted small" style="margin:0">92 murav pura, gadhi chowki, Bareilly (U.P.)</p></div>' +
      '<div style="margin-top:18px" class="rv"><div class="eyebrow" style="margin-bottom:8px">Ta\'awun ki qisam</div><div class="chips" style="flex-wrap:wrap">' + ['Zakaat', 'Sadqah', 'Atiyat', 'Qurbani'].map(function (c) { return '<span class="chip" style="cursor:default">' + c + '</span>'; }).join('') + '</div></div>' +
      '<div style="margin-top:18px">' + taawunHtml() + '</div>' +
      '<div class="card rv" style="margin-top:18px"><p style="margin:0">Payment ka tareeqa owner share karega. Is site par koi online payment ya bank/UPI detail nahi hai.</p><div style="margin-top:14px"><a class="btn ghost" href="#/contact">Details ke liye message karein</a></div></div></div></section>';
  }
  function pageKhidmat() { return '<section style="padding-top:34px"><div class="wrap"><div class="sec-head rv"><div class="eyebrow" data-k="khidmat.eyebrow">' + T('khidmat.eyebrow', 'Hamari Khidmat') + '</div><h1 style="font-size:clamp(2rem,5vw,3rem)">Khidmat</h1></div>' + khidmatHtml() + '</div></section>'; }
  function pageContact() { return '<section style="padding-top:34px"><div class="wrap" style="max-width:720px">' + contactHtml() + '</div></section>'; }
  function pageComments() { return '<section style="padding-top:34px"><div class="wrap" style="max-width:720px">' + commentsHtml() + '</div></section>'; }

  var ROUTES = {
    '': pageHome, 'library': pageLibrary, 'quiz': pageQuiz, 'paigham': pagePaigham, 'updates': pageUpdates, 'media': pageMedia,
    'about': pageAbout, 'tawwun': pageTawwun, 'khidmat': pageKhidmat, 'contact': pageContact, 'comments': pageComments
  };

  function parseRoute() {
    var raw = (location.hash || '#/').replace(/^#\/?/, '');
    var qp = {}; var parts = raw.split('?'); if (parts[1]) parts[1].split('&').forEach(function (kv) { var p = kv.split('='); qp[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var seg = parts[0].split('/');
    return { name: seg[0] || '', arg: seg[1], q: qp };
  }
  var LAST_NAME = null;
  function render() {
    S.today = St.ymd();
    var r = parseRoute();
    if (r.name === ADMIN_ROUTE) { var eb = $('.editbar'); if (eb) eb.remove(); document.body.classList.remove('editing'); if (window.TajAdmin) return window.TajAdmin.open(); }
    if (window.TajAdmin && window.TajAdmin.active && r.name !== ADMIN_ROUTE) window.TajAdmin.active = false;
    var html;
    if (r.name === 'book') html = pageBook(r.arg);
    else if (ROUTES[r.name] !== undefined) html = ROUTES[r.name](r.name === 'library' ? r.q : {});
    else html = pageHome();
    var app = $('#app');
    app.innerHTML = demoBanner() + html + (r.name === 'book' ? '' : '') + footerHtml();
    chrome(); applyTexts(app); placeTabInd();
    $$('img[data-hide-broken]', app).forEach(function (im) { im.onerror = function () { im.remove(); }; });
    document.body.classList.toggle('editing', sessionStorage.getItem('tajv2b-edit') === '1' && !!St.session());
    addPencils(app); bindPage(app, r);
    window.scrollTo({ top: 0, behavior: 'instant' });
    reveal(app);
    $$('[data-w]').forEach(function (el) { requestAnimationFrame(function () { el.style.width = el.dataset.w + '%'; }); });
    tickCountdown();
    if (r.name === '' || r.name === 'comments') { if (r.name === 'comments') { var c = $('#comments'); if (c) setTimeout(function () { c.scrollIntoView(); }, 50); } }
    if (r.name === 'library' && r.q.q) { /* keep focus */ }
  }
  function placeTabInd() { var tb = $('#tabbar'); if (!tb) return; var ind = tb.querySelector('.ind'); if (!ind) { ind = document.createElement('i'); ind.className = 'ind'; tb.appendChild(ind); } var on = tb.querySelector('a.on') || tb.querySelector('a'); if (!on) return; requestAnimationFrame(function () { var w = ind.offsetWidth || 36; ind.style.transform = 'translate3d(' + (on.offsetLeft + on.offsetWidth / 2 - w / 2) + 'px,0,0)'; }); }
  function demoBanner() { return St.mode === 'demo' ? '<div class="demo-banner"><b>DEMO MODE</b> — not secure. Data is on this phone only. Owner ko live setup chahiye (README).</div>' : ''; }
  function bindPage(app, r) {
    $$('[data-cat]', app).forEach(function (b) { b.onclick = function () { location.hash = '#/library?cat=' + encodeURIComponent(b.dataset.cat); }; });
    var lq = $('#lib-q', app); if (lq) { lq.oninput = debounce(function () { var cat = (new URLSearchParams(location.hash.split('?')[1] || '')).get('cat') || 'All'; history.replaceState(null, '', '#/library?' + (lq.value ? 'q=' + encodeURIComponent(lq.value) + '&' : '') + 'cat=' + encodeURIComponent(cat)); render(); $('#lib-q') && $('#lib-q').focus(); }, 280); }
    $$('[data-lb]', app).forEach(function (b) { b.onclick = function () { lightboxOpen(+b.dataset.lb); }; });
    $$('[data-legal]', app).forEach(function (b) { b.onclick = function () { openLegal(b.dataset.legal); }; });
    $$('[data-close-drawer]', app).forEach(function (a) { a.onclick = closeAll; });
    $$('.drawer [data-close-drawer]').forEach(function (a) { a.onclick = closeAll; });
    $$('[data-legal]', $('#drawer')).forEach(function (b) { b.onclick = function () { closeAll(); openLegal(b.dataset.legal); }; });
    var cf = $('#contact-form', app); if (cf) cf.onsubmit = function (e) { e.preventDefault(); submitContact(cf); };
    var mf = $('#comment-form', app); if (mf) mf.onsubmit = function (e) { e.preventDefault(); submitComment(mf); };
    var qf = $('#quiz-form', app); if (qf) bindQuiz(qf);
    $$('[data-act]', app).forEach(function (b) { b.onclick = function (e) { act(b.dataset.act, b, e); }; });
    var copy = $('#copy', app); if (copy) bindTap(copy);
    if (r.name === '' || r.name === 'paigham') { /* share + listen */ }
    if (r.name === 'book') { var rb = $('[data-act=read]', app); if (rb) rb.dataset.id && 0; }
    if (St.mode === 'live' && !S.ready) { /* nothing */ }
    var pencilMode = sessionStorage.getItem('tajv2b-edit') === '1' && St.session();
    if (pencilMode) document.body.classList.add('editing'); else document.body.classList.remove('editing');
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  var tapN = 0, tapT = 0;
  function bindTap(el) {
    el.onclick = function () {
      var now = Date.now(); if (now - tapT > 1200) tapN = 0; tapT = now; tapN++;
      if (tapN >= 3) { tapN = 0; openAdminLogin(); }
    };
  }
  function openAdminLogin() { location.hash = '#/' + ADMIN_ROUTE; }
  function act(name, el, e) {
    if (name === 'closeall') return closeAll();
    if (name === 'more') return openDrawer(true);
    if (name === 'lbclose') { $('#lightbox').classList.remove('on'); return; }
    if (name === 'listen') return listen();
    if (name === 'status') return statusShare();
    if (name === 'read') return readBook(el.dataset.id);
  }
  function readBook(id) {
    var b = S.books.find(function (x) { return String(x.id) === String(id); }); if (!b) return;
    localStorage.setItem('taj-last-read', JSON.stringify({ id: b.id, title: b.title_en }));
    var v = $('#viewer'); if (!v) return; v.hidden = false; v.querySelector('iframe').src = b.read; v.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  var speaking = false;
  function listen() {
    var p = paigamToday(); if (!p || !window.speechSynthesis) return toast('Is browser me awaaz nahi chalti');
    var note = $('#listen-note');
    if (speaking) { speechSynthesis.cancel(); speaking = false; return toast('Ruk gaya'); }
    var u = new SpeechSynthesisUtterance(p.text_ro || ''); u.lang = 'en-IN'; u.rate = 0.9;
    u.onend = function () { speaking = false; }; speaking = true; speechSynthesis.speak(u);
    if (note) note.hidden = false;
  }
  function statusShare() {
    var p = paigamToday(); if (!p) return;
    var c = document.createElement('canvas'); c.width = 1080; c.height = 1350; var g = c.getContext('2d');
    var dark = false;
    g.fillStyle = '#FBF8F1'; g.fillRect(0, 0, 1080, 1350);
    g.strokeStyle = '#A8854F'; g.lineWidth = 3; g.strokeRect(50, 50, 980, 1250); g.strokeStyle = '#D5DED2'; g.strokeRect(78, 78, 924, 1194);
    g.fillStyle = '#2E4A3D'; g.font = '600 46px Georgia, serif'; g.textAlign = 'center'; g.fillText('PAIGHAAM-E-TAJUSHSHARIAH', 540, 170);
    g.fillStyle = '#A8854F'; g.font = '34px Georgia, serif'; g.fillText(fmtDate(p.date), 540, 232);
    g.fillStyle = '#1E2A23'; g.font = 'italic 500 62px Georgia, serif';
    var words = (p.text_ro || '').split(' '), lines = [], line = '';
    words.forEach(function (w) { var t = (line ? line + ' ' : '') + w; if (g.measureText(t).width > 820) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line);
    var y = 600 - (lines.length * 78) / 2; lines.forEach(function (l) { g.fillText(l, 540, y); y += 84; });
    g.fillStyle = '#66766C'; g.font = '30px Georgia, serif'; g.fillText('Ilm ko samjhiye, adab ke saath', 540, 1210);
    c.toBlob(function (blob) {
      var file = new File([blob], 'paigham.jpg', { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Aaj ka Paigham' }).catch(function () {}); return; }
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'paigham-' + p.date + '.jpg'; document.body.appendChild(a); a.click(); a.remove();
      window.open('https://wa.me/?text=' + encodeURIComponent((p.text_ro || '') + ' — Paighaam-e-Tajushshariah'), '_blank', 'noopener');
      toast('Poster download ho gaya. WhatsApp Status me daal dein.');
    }, 'image/jpeg', 0.92);
  }
  function honeypotOk(form) { return !(form.querySelector('[name=website]') || {}).value; }
  function rateOk(key, ms) { var last = +localStorage.getItem(key) || 0; if (Date.now() - last < ms) return false; localStorage.setItem(key, String(Date.now())); return true; }
  function submitContact(form) {
    var err = $('#c-err'); err.textContent = '';
    var name = form.name.value.trim(), msg = form.message.value.trim(), email = form.email.value.trim();
    if (!name || !msg) { err.textContent = 'Naam aur message zaroori hain.'; return; }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Email sahi nahi lag raha.'; return; }
    if (!honeypotOk(form)) return success('contact-card');
    if (!rateOk('taj-rate-contact', 45000)) { err.textContent = 'Thoda ruk ke dobara bhejein.'; return; }
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    St.insert('messages', { name: name, email: email, phone: form.phone.value.trim(), message: msg, read: false }).then(function (row) {
      if (St.mode === 'live' && window.TAJ_CONFIG.contactFunction && row) fetch(window.TAJ_CONFIG.supabaseUrl + '/functions/v1/' + window.TAJ_CONFIG.contactFunction, { method: 'POST', headers: { apikey: window.TAJ_CONFIG.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id }) }).catch(function () {});
      success('contact-card');
    }).catch(function (e) { btn.disabled = false; err.textContent = 'Nahi gaya: ' + e.message; shakeEl(err); });
  }
  function submitComment(form) {
    var err = $('#m-err'); err.textContent = '';
    var name = form.name.value.trim(), msg = form.message.value.trim();
    if (!name || !msg) { err.textContent = 'Naam aur comment likhein.'; return; }
    if (!honeypotOk(form)) return success('comments');
    if (!rateOk('taj-rate-comment', 60000)) { err.textContent = 'Ek minute baad dobara likhein.'; return; }
    St.insert('comments', { name: name, message: msg, status: 'pending' }).then(function () { success('comments', 'Shukriya! Comment owner ki approval ke baad dikhega.'); }).catch(function (e) { err.textContent = 'Nahi gaya: ' + e.message; shakeEl(err); });
  }
  function success(id, text) {
    var el = $('#' + id) || $('#app');
    var ok = '<div class="okmsg rv in"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="30"/><path d="M22 37l9 9 19-20"/></svg><h3>' + esc(text || 'Shukriya! Message mil gaya.') + '</h3><p class="muted">Owner ise dekhega.</p></div>';
    if (el.id === 'contact-card') el.innerHTML = '<div class="eyebrow" data-k="contact.eyebrow">' + T('contact.eyebrow', 'Connect') + '</div>' + ok; else el.innerHTML = ok;
    toast('Bhej diya');
  }
  function bindQuiz(form) {
    var answers = {};
    $$('.opt', form).forEach(function (b) { b.onclick = function () { var qi = b.dataset.q; $$('.opt[data-q="' + qi + '"]', form).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); answers[qi] = +b.dataset.o; }; });
    form.onsubmit = function (e) {
      e.preventDefault(); var err = $('#q-err'); err.textContent = '';
      var name = form.name.value.trim(), phone = form.phone.value.trim(), addr = form.address.value.trim();
      if (!name || !phone || !addr) { err.textContent = 'Naam, phone aur address bharein.'; return; }
      if (Object.keys(answers).length < S.quizQ.length) { err.textContent = 'Sab sawal ke jawab chunein.'; return; }
      if (!honeypotOk(form)) return;
      var score = 0; S.quizQ.forEach(function (q, i) { if (answers[i] === q.answer) score++; });
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      St.insert('quiz_entries', { date: S.today, first_name: name.split(/\s+/)[0], full_name: name, phone: phone, address: addr, score: score, total: S.quizQ.length }).then(function () {
        localStorage.setItem('taj-quiz-done-' + S.today, score + ' / ' + S.quizQ.length);
        toast('Quiz submit ho gaya');
        return St.list('leaderboard', { eq: { date: S.today }, limit: 10 }).then(function (lb) { S.lb = lb; render(); }).catch(function () { render(); });
      }).catch(function (e) { btn.disabled = false; err.textContent = 'Nahi gaya: ' + e.message; shakeEl(err); });
    };
  }
  function applyTexts(root) {
    $$('[data-k]', root).forEach(function (el) {
      var k = el.dataset.k;
      var lu = S.site.texts && S.site.texts[k + '.url'];
      if (el.dataset.link && lu && safeUrl(lu.text)) el.setAttribute('href', safeUrl(lu.text));
    });
  }
  // Pencil editor (owner only): text + link overlay on the real page
  function addPencils(root) {
    if (!document.body.classList.contains('editing')) return;
    $$('[data-k]', root).forEach(function (el) {
      if (el.querySelector(':scope > .pencil')) return;
      var b = document.createElement('button'); b.className = 'pencil'; b.innerHTML = I.svg('pencil'); b.setAttribute('aria-label', 'Text badlein'); b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); editText(el.dataset.k, !!el.dataset.link, el); };
      el.appendChild(b);
    });
    if (!$('.editbar')) { var bar = document.createElement('div'); bar.className = 'editbar'; bar.innerHTML = 'Edit mode · pencil par tap karein <button data-x>Band karein</button>'; document.body.appendChild(bar); bar.querySelector('button').onclick = function () { sessionStorage.removeItem('tajv2b-edit'); bar.remove(); document.body.classList.remove('editing'); render(); }; }
  }
  function editText(k, isLink, el) {
    var o = (S.site.texts && S.site.texts[k]) || {};
    var cur = o.text != null ? o.text : el.textContent.replace(/\s*$/, '');
    var lu = (S.site.texts && S.site.texts[k + '.url']) || {};
    var m = modal('Text badlein', '<div class="form"><div class="field"><label>Text</label><textarea id="ed-t">' + esc(cur) + '</textarea></div>' + (isLink ? '<div class="field"><label>Link (https://… ya #/page)</label><input id="ed-u" value="' + esc(lu.text || el.getAttribute('href') || '') + '"></div>' : '') + '</div>', '<button class="btn ghost sm" data-close>Cancel</button><button class="btn sm" id="ed-save">Save</button>');
    $('#ed-save').onclick = function () {
      var t = $('#ed-t').value; var u = isLink ? $('#ed-u').value.trim() : undefined;
      var jobs = [St.setText(k, t)];
      if (isLink && u !== undefined) jobs.push(St.setText(k + '.url', safeUrl(u) ? u : ''));
      Promise.all(jobs).then(function () { return St.getSite(); }).then(function (s) { S.site = s; toast('Save ho gaya'); m.classList.remove('on'); render(); }).catch(function (e) { toast('Save nahi hua: ' + e.message); });
    };
  }

  // ----- data load -----
  function load() {
    return Promise.all([
      St.getSite(), St.list('books', { order: 'sort' }), St.list('paigam', { order: 'date', desc: true }), St.list('updates', { order: 'date', desc: true }),
      St.list('gallery'), St.list('quiz_questions', { eq: { date: S.today } }), St.list('comments', { order: 'created', desc: true }), St.list('leaderboard', { eq: { date: S.today }, limit: 10 }),
      St.list('leaderboard', { eq: { date: St.addDays(-1) }, limit: 1 })
    ]).then(function (r) {
      S.site = r[0]; S.books = r[1].map(function (b) { return Object.assign({}, b, { id: b.id }); }); S.paigam = r[2]; S.updates = r[3]; S.gallery = r[4]; S.quizQ = r[5]; S.comments = r[6]; S.lb = r[7]; S.scholar = r[8][0] || null;
      try { localStorage.setItem('taj-cache-paigam', JSON.stringify(S.paigam)); } catch (e) {}
      S.ready = true;
    }).catch(function (e) {
      var c = null; try { c = JSON.parse(localStorage.getItem('taj-cache-paigam') || 'null'); } catch (x) {}
      if (c) S.paigam = c; if (!S.site) S.site = { sections: {}, texts: {}, stats: [], sizes: { mobile: 100, desktop: 100 }, quizRules: [], taawun: {}, social: {} };
      toast('Offline ho sakte hain — purana Paigham dikh raha hai');
    });
  }
  function boot() {
    $('#scrim').onclick = closeAll;
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-act=more]')) { openDrawer(true); return; }
      if (t.closest('[data-act=closeall]')) { closeAll(); return; }
      if (t.closest('[data-act=lbclose]') || t === $('#lightbox')) { $('#lightbox').classList.remove('on'); return; }
      var lg = t.closest('[data-legal]'); if (lg && !t.closest('#app')) { closeAll(); openLegal(lg.dataset.legal); return; }
      if (t.closest('#app') === null && t.closest('#drawer') === null && t.closest('#sheet') === null) return;
    });
    $('#menu-btn').onclick = function () { openDrawer(true); };
    $('#settings-btn').onclick = function () { openSheet(true); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeAll(); $('#lightbox').classList.remove('on'); $('#modal').classList.remove('on'); } });
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-theme],[data-uscale]');
      if (t && t.dataset.theme) { PREF.theme = t.dataset.theme; localStorage.setItem('taj-theme', PREF.theme); applyPrefs(); $$('[data-theme]').forEach(function (b) { b.classList.toggle('on', b.dataset.theme === PREF.theme); }); }
      if (t && t.dataset.uscale) { PREF.uscale = parseFloat(t.dataset.uscale); localStorage.setItem('taj-uscale', String(PREF.uscale)); applyPrefs(); }
      var an = e.target.closest('[data-anim]');
      if (an) { PREF.anim = an.dataset.anim; localStorage.setItem('taj-anim', PREF.anim); applyPrefs(); $$('[data-anim]').forEach(function (b) { b.classList.toggle('on', b.dataset.anim === PREF.anim); }); }
      var a = e.target.closest('a[href^="#/"]'); if (a) closeAll();
    });
    window.addEventListener('hashchange', function () { if (window.TajAdmin && window.TajAdmin.active && parseRoute().name !== ADMIN_ROUTE) { window.TajAdmin.active = false; } closeAll(); render(); });
    window.addEventListener('resize', applyPrefs);
    // parallax: the hero ornament drifts slowly with scroll (transform only, full motion only)
    var px = 0, pxRaf = 0;
    window.addEventListener('scroll', function () { px = window.scrollY; if (pxRaf) return; pxRaf = requestAnimationFrame(function () { pxRaf = 0; if (!document.body.classList.contains('anim-full')) return; var o = $('.photo-slot .orn svg'); if (o) o.style.transform = 'translate3d(0,' + Math.min(px * 0.08, 60).toFixed(1) + 'px,0)'; }); }, { passive: true });
    // ripple on press
    document.addEventListener('pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('.btn'); if (!b || document.body.classList.contains('anim-off')) return;
      var r = b.getBoundingClientRect(); var s = document.createElement('span'); s.className = 'rip';
      s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px'; b.appendChild(s); setTimeout(function () { s.remove(); }, 650);
    }, { passive: true });
    // PWA
    var deferred = null; window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; var b = $('#install-btn'); if (b) b.hidden = false; });
    document.addEventListener('click', function (e) { if (e.target.closest('#install-btn') && deferred) { deferred.prompt(); deferred = null; } });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
    // fetch then render
    load().then(function () {
      if (St.mode === 'live' && !S.site) S.site = {};
      // Fold in admin's 'edit' flag
      render();
      
    });
  }
  window.TajApp = { placeTabInd: placeTabInd, fmtDate: fmtDate, S: S, render: render, load: load, toast: toast, modal: modal, esc: esc, $: $, $$: $$, applyPrefs: applyPrefs, chrome: chrome, parseRoute: parseRoute, openAdminLogin: openAdminLogin, ADMIN_ROUTE: ADMIN_ROUTE, reloadAll: function () { return load().then(render); } };
  document.addEventListener('DOMContentLoaded', boot);
})();
