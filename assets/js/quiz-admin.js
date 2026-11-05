/* Owner panels for Taj Quiz PRO and Alerts (notifications). Loaded after admin.js; admin.js hands it the
   clicks (data-a) and forms (data-f) it does not know. Everything typed by a visitor is shown with esc(). */
(function () {
  'use strict';
  var St = window.TajStore;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (s) { return document.querySelector(s); };
  var TA = function () { return window.TajAdminState; };
  var CTL = function () { return window.TajAdminCtl; };
  var IST_OFF = 19800000;
  var DRAFT = null, MONTH = null, DAY = null, VIEW = 'cal', SEL = null;
  var STATUS_TXT = { draft: 'Draft', scheduled: 'Scheduled', live: 'Live', ended: 'Ended' };
  var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function parse(s) { return Date.parse(String(s).replace(/(\.\d{3})\d+/, '$1')); }
  function status(r) { if (!r.published) return 'draft'; var t = St.now(); if (t < parse(r.starts_at)) return 'scheduled'; if (t < parse(r.ends_at)) return 'live'; return 'ended'; }
  function fmt(iso) { try { return new Date(parse(iso)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: '2-digit', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function istKey(iso) { var d = new Date(parse(iso) + IST_OFF); return d.toISOString().slice(0, 10); }
  function istInput(iso) { if (!iso) return ''; return new Date(parse(iso) + IST_OFF).toISOString().slice(0, 16); }
  function isoFromIst(v) { return new Date(v + ':00+05:30').toISOString(); }
  function todayKey() { return new Date(St.now() + IST_OFF).toISOString().slice(0, 10); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function siteUrl() { return location.origin + location.pathname; }
  function waLink(text) { return 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + siteUrl()); }
  function csvCell(v) { var s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function roundsOf(c) { return (c.quizRounds || []).slice().sort(function (a, b) { return parse(a.starts_at) - parse(b.starts_at); }); }
  function attemptsOf(c, rid) { return (c.quizAttempts || []).filter(function (x) { return x.round_id === rid; }); }
  function itemsOf(c, rid) { return (c.quizItems || []).filter(function (x) { return x.round_id === rid; }).sort(function (a, b) { return a.sort - b.sort; }); }
  function keyOf(c, itemId) { return (c.quizKeys || []).filter(function (k) { return k.item_id === itemId; })[0] || {}; }
  function settings(c) { return c.site || {}; }

  // ---------- quiz tab ----------
  function switchBtn(k, label, on) {
    return '<div class="qz-sw"><span>' + esc(label) + '</span><div class="seg"><button class="' + (on ? 'on' : '') + '" data-a="qz-set" data-k="' + k + '" data-v="1">Haan</button><button class="' + (!on ? 'on' : '') + '" data-a="qz-set" data-k="' + k + '" data-v="0">Nahi</button></div></div>';
  }
  function quizPanel(c) {
    var s = settings(c); var top = +s.leaderboard_top || 10;
    var rs = roundsOf(c);
    var head = '<h2 style="margin:0 0 6px">Taj Quiz</h2><div class="card qz-top"><div class="eyebrow">Quiz ka switch</div>' +
      '<p class="small muted" style="margin:6px 0 10px">' + (s.quiz_enabled === false ? 'Quiz BAND hai — visitors ko "band hai" dikhega. Jawab nahi liye jayenge.' : 'Quiz CHALU hai — round ke time par sawal aur form dikhega.') + '</p>' +
      switchBtn('quiz_enabled', 'Quiz chalu hai?', s.quiz_enabled !== false) +
      switchBtn('leaderboard_public', 'Leaderboard public dikhe?', s.leaderboard_public !== false) +
      switchBtn('leaderboard_live', 'Round ke beech bhi board dikhe? (live)', !!s.leaderboard_live) +
      switchBtn('leaderboard_show_city', 'Shehar bhi dikhe?', !!s.leaderboard_show_city) +
      '<div class="qz-sw"><span>Board me kitne log (top)</span><div class="seg">' + [5, 10, 20].map(function (n) { return '<button class="' + (top === n ? 'on' : '') + '" data-a="qz-set" data-k="leaderboard_top" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div></div>' +
      '</div>';
    var tabs = '<div class="actions qz-views" style="gap:8px;margin:14px 0 6px;flex-wrap:wrap"><button class="btn ' + (VIEW === 'cal' ? '' : 'ghost') + ' sm" data-a="qz-view" data-v="cal">Calendar</button><button class="btn ' + (VIEW === 'list' ? '' : 'ghost') + ' sm" data-a="qz-view" data-v="list">List</button><button class="btn sm" data-a="qz-new" data-day="">+ Naya round</button></div>';
    var body = '';
    if (SEL) return head + tabs + attemptsView(c, SEL);
    body = VIEW === 'cal' ? calendar(c, rs) : listView(c, rs);
    return head + tabs + body + '<p class="small muted" style="margin-top:12px">Time IST me hai. Round ka status apne aap badalta hai: draft (chhupa) → scheduled → live → ended. Sawal change karne se pehle check karein ki kisi ne jawab to nahi diya.</p>';
  }
  function calendar(c, rs) {
    var mk = MONTH || todayKey().slice(0, 7);
    var y = +mk.slice(0, 4), m = +mk.slice(5, 7) - 1;
    var first = new Date(Date.UTC(y, m, 1)); var lead = (first.getUTCDay() + 6) % 7;
    var days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var byDay = {}; rs.forEach(function (r) { var k = istKey(r.starts_at); (byDay[k] = byDay[k] || []).push(r); });
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span class="qz-day blank"></span>';
    for (var d = 1; d <= days; d++) {
      var key = y + '-' + pad(m + 1) + '-' + pad(d); var list = byDay[key] || [];
      cells += '<button class="qz-day ' + (key === todayKey() ? 'today ' : '') + (DAY === key ? 'sel' : '') + '" data-a="qz-day" data-v="' + key + '" aria-label="' + key + (list.length ? ', ' + list.length + ' round' : '') + '"><b>' + d + '</b>' +
        (list.length ? '<span class="qz-dots">' + list.slice(0, 3).map(function (r) { return '<i class="dot ' + status(r) + '"></i>'; }).join('') + '</span>' : '') + '</button>';
    }
    var mname = new Date(Date.UTC(y, m, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    var head = '<div class="qz-cal-head"><button class="iconbtn" data-a="qz-month" data-v="-1" aria-label="Pichla mahina">&lsaquo;</button><b>' + esc(mname) + '</b><button class="iconbtn" data-a="qz-month" data-v="1" aria-label="Agla mahina">&rsaquo;</button></div>';
    var grid = '<div class="qz-cal">' + WD.map(function (w) { return '<span class="qz-wd">' + w + '</span>'; }).join('') + cells + '</div>';
    var dayBox = '';
    if (DAY) {
      var list2 = byDay[DAY] || [];
      dayBox = '<div class="card qz-dayb"><div class="eyebrow">' + esc(DAY) + '</div>' + (list2.length ? list2.map(function (r) { return roundRow(c, r); }).join('') : '<p class="small muted">Is din koi round nahi.</p>') +
        '<button class="btn sm" style="margin-top:10px" data-a="qz-new" data-day="' + esc(DAY) + '">+ Is din naya round</button></div>';
    }
    var legend = '<p class="small muted qz-legend"><i class="dot draft"></i> draft <i class="dot scheduled"></i> scheduled <i class="dot live"></i> live <i class="dot ended"></i> ended</p>';
    return '<div class="card" style="padding:12px">' + head + grid + legend + '</div>' + dayBox;
  }
  function roundRow(c, r) {
    var st = status(r); var at = attemptsOf(c, r.id).length; var n = itemsOf(c, r.id).length;
    var text = 'Naya Taj Quiz: ' + r.title + '. Shuru: ' + fmt(r.starts_at) + ' IST. Sawal ka jawab site par dein.';
    return '<div class="qz-row"><div><span class="qz-st ' + st + '">' + STATUS_TXT[st] + '</span> <b>' + esc(r.title) + '</b><div class="small muted">' + esc(fmt(r.starts_at)) + ' → ' + esc(fmt(r.ends_at)) + ' · ' + n + ' sawal · ' + at + ' jawab</div></div>' +
      '<div class="actions qz-acts" style="gap:6px;flex-wrap:wrap"><button class="btn ghost sm" data-a="qz-edit" data-id="' + esc(r.id) + '">Edit</button><button class="btn ghost sm" data-a="qa-open" data-id="' + esc(r.id) + '">Jawab (' + at + ')</button>' +
      '<button class="btn ghost sm" data-a="qz-pub" data-id="' + esc(r.id) + '" data-v="' + (r.published ? '0' : '1') + '">' + (r.published ? 'Chhupa dein' : 'Publish') + '</button>' +
      '<a class="btn ghost sm" href="' + esc(waLink(text)) + '" target="_blank" rel="noopener">WhatsApp share</a>' +
      '<button class="btn ghost sm" data-a="qz-del" data-id="' + esc(r.id) + '">Hatayein</button></div></div>';
  }
  function listView(c, rs) {
    if (!rs.length) return '<div class="empty">Abhi koi round nahi. "+ Naya round" dabayein.</div>';
    return '<div class="tbl">' + rs.slice().reverse().map(function (r) { return roundRow(c, r); }).join('') + '</div>';
  }

  // ---------- one round's answers (owner only) ----------
  function attemptsView(c, rid) {
    var r = (c.quizRounds || []).filter(function (x) { return x.id === rid; })[0];
    if (!r) { SEL = null; return quizPanel(c); }
    var list = attemptsOf(c, rid).slice().sort(function (a, b) { return (b.pinned - a.pinned) || (b.score - a.score) || (parse(a.submitted_at) - parse(b.submitted_at)); });
    var rows = list.map(function (x, i) {
      return '<div class="tr qa-row' + (x.hidden ? ' hid' : '') + '"><div><b>' + (i + 1) + '. ' + esc(x.name) + '</b> <span class="small muted">' + esc(x.score) + ' / ' + esc(x.total) + '</span>' + (x.winner ? ' <i class="qz-badge">Winner</i>' : '') + (x.pinned ? ' <i class="qz-badge pin">Pinned</i>' : '') + (x.hidden ? ' <i class="qz-badge">Hidden</i>' : '') +
        '<div class="small">📞 ' + esc(x.phone_norm) + ' · ' + esc(x.address) + (x.city ? ' · ' + esc(x.city) : '') + '</div><div class="small muted">' + esc(fmt(x.submitted_at)) + '</div></div>' +
        '<div class="actions" style="gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn ghost sm" data-a="qa-mark" data-id="' + esc(x.id) + '" data-k="winner" data-v="' + (x.winner ? '0' : '1') + '">' + (x.winner ? 'Winner hatayein' : 'Winner banayein') + '</button>' +
        '<button class="btn ghost sm" data-a="qa-mark" data-id="' + esc(x.id) + '" data-k="pinned" data-v="' + (x.pinned ? '0' : '1') + '">' + (x.pinned ? 'Unpin' : 'Pin karein') + '</button>' +
        '<button class="btn ghost sm" data-a="qa-mark" data-id="' + esc(x.id) + '" data-k="hidden" data-v="' + (x.hidden ? '0' : '1') + '">' + (x.hidden ? 'Board par dikhayein' : 'Board se chhupayein') + '</button>' +
        '<button class="btn ghost sm" data-a="qa-del" data-id="' + esc(x.id) + '">Entry hatayein</button></div></div>';
    }).join('');
    return '<div class="card"><div class="actions" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><button class="btn ghost sm" data-a="qa-back">← Calendar par wapas</button><b>' + esc(r.title) + '</b></div>' +
      '<p class="small muted" style="margin:10px 0">' + list.length + ' jawab · public board: top ' + ((settings(c).leaderboard_top) || 10) + ' (hidden entries bahar). Phone aur address sirf aapko dikhte hain.</p>' +
      '<div class="actions" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-a="qa-csv" data-id="' + esc(rid) + '">CSV download</button><button class="btn ghost sm" data-a="qa-reset" data-id="' + esc(rid) + '">Board reset (winner/pin/hide hatayein)</button><button class="btn ghost sm" data-a="qa-wipe" data-id="' + esc(rid) + '">Sab jawab hatayein</button></div></div>' +
      '<div class="tbl" style="margin-top:12px">' + (rows || '<div class="empty">Abhi koi jawab nahi.</div>') + '</div>';
  }

  // ---------- round editor (modal) ----------
  function blankItem(sort) { return { id: St.uid(), sort: sort, q: '', options: ['', '', '', ''], correct: 0, explanation: '' }; }
  function openEditor(c, id, day) {
    var r = id ? (c.quizRounds || []).filter(function (x) { return x.id === id; })[0] : null;
    var locked = !!(id && attemptsOf(c, id).length);
    if (r) {
      DRAFT = { id: r.id, title: r.title, starts: istInput(r.starts_at), ends: istInput(r.ends_at), published: !!r.published, show_leaderboard: r.show_leaderboard !== false,
        items: itemsOf(c, r.id).map(function (it) { var k = keyOf(c, it.id); return { id: it.id, sort: it.sort, q: it.q, options: (it.options || []).slice(0, 4), correct: k.correct == null ? 0 : k.correct, explanation: k.explanation || '' }; }), locked: locked };
      if (!DRAFT.items.length) DRAFT.items.push(blankItem(1));
    } else {
      var d0 = day || todayKey();
      DRAFT = { id: null, title: '', starts: d0 + 'T20:00', ends: d0 + 'T21:00', published: false, show_leaderboard: true, items: [blankItem(1)], locked: false };
    }
    drawEditor();
  }
  function readDom() {
    if (!DRAFT) return;
    var f = document.getElementById('qr-form'); if (!f) return;
    DRAFT.title = f.title.value; DRAFT.starts = f.starts.value; DRAFT.ends = f.ends.value; DRAFT.published = f.published.checked; DRAFT.show_leaderboard = f.show_leaderboard.checked;
    DRAFT.items.forEach(function (it, i) {
      var q = f.querySelector('[name="q' + i + '"]'); if (!q) return;
      it.q = q.value; it.options = [0, 1, 2, 3].map(function (j) { return f.querySelector('[name="o' + i + '_' + j + '"]').value; });
      var cr = f.querySelector('input[name="c' + i + '"]:checked'); it.correct = cr ? +cr.value : 0;
      it.explanation = f.querySelector('[name="e' + i + '"]').value;
    });
  }
  function drawEditor() {
    var d = DRAFT; var lk = d.locked ? ' disabled' : '';
    var items = d.items.map(function (it, i) {
      return '<fieldset class="qr-item"><legend>Sawal ' + (i + 1) + (it.q && /^SAMPLE/i.test(it.q) ? ' <i class="qz-badge">sample — owner replace</i>' : '') + '</legend>' +
        '<div class="field"><label>Sawal</label><textarea name="q' + i + '" rows="2" maxlength="500"' + lk + '>' + esc(it.q) + '</textarea></div>' +
        [0, 1, 2, 3].map(function (j) { return '<div class="qr-opt"><input type="radio" name="c' + i + '" value="' + j + '" ' + (it.correct === j ? 'checked' : '') + lk + ' aria-label="Sahi jawab ' + 'ABCD'[j] + '"><span class="qz-let">' + 'ABCD'[j] + '</span><input name="o' + i + '_' + j + '" maxlength="300" value="' + esc(it.options[j] || '') + '" placeholder="Option ' + 'ABCD'[j] + '"' + lk + '></div>'; }).join('') +
        '<div class="field"><label>Explanation (optional, round khatam hone par dikhega)</label><input name="e' + i + '" maxlength="1000" value="' + esc(it.explanation) + '"></div>' +
        (d.locked ? '' : '<button class="btn ghost sm" type="button" data-a="qr-rm" data-i="' + i + '">Sawal hatayein</button>') + '</fieldset>';
    }).join('');
    var html = '<h3>' + (d.id ? 'Round edit karein' : 'Naya round') + '</h3>' +
      '<form id="qr-form" data-f="qround" class="adm-form" style="display:grid;gap:10px">' +
      '<div class="field"><label>Naam (round ka title)</label><input name="title" required maxlength="200" value="' + esc(d.title) + '"></div>' +
      '<div class="field"><label>Shuru (IST)</label><input name="starts" type="datetime-local" required value="' + esc(d.starts) + '"></div>' +
      '<div class="field"><label>Khatam (IST)</label><input name="ends" type="datetime-local" required value="' + esc(d.ends) + '"></div>' +
      '<label class="qz-chk"><input type="checkbox" name="published" ' + (d.published ? 'checked' : '') + '> Publish karein (visitors ko dikhega)</label>' +
      '<label class="qz-chk"><input type="checkbox" name="show_leaderboard" ' + (d.show_leaderboard ? 'checked' : '') + '> Is round ka board public (owner ki settings ke saath)</label>' +
      (d.locked ? '<p class="small" style="color:#9A3B2E">Is round par jawab aa chuke hain. Sawal ab nahi badal sakte (score galat ho jayega). Title aur time badal sakte hain.</p>' : '') +
      '<div style="display:grid;gap:10px">' + items + '</div>' +
      (d.locked ? '' : '<button class="btn ghost sm" type="button" data-a="qr-add">+ Sawal add karein</button>') +
      '<p class="small muted">Har sawal ke 4 option, aur ek sahi jawab (radio). Sawal "SAMPLE" se shuru ho to owner use asli sawal se badle.</p>' +
      '<p class="small" id="qrerr" style="color:#9A3B2E" role="alert"></p>' +
      '<div class="actions" style="gap:8px"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-a="qr-cancel">Band karein</button></div></form>';
    openModal(html);
  }
  function openModal(html) {
    var m = $('#modal'); m.innerHTML = '<div class="box qbox" role="dialog" aria-modal="true" style="max-height:88vh;overflow:auto">' + html + '</div>';
    m.classList.add('on'); m.onclick = function (e) { if (e.target === m) closeModal(); };
  }
  function closeModal() { var m = $('#modal'); if (m) { m.classList.remove('on'); m.innerHTML = ''; } DRAFT = null; }
  function saveRound(f) {
    readDom();
    var d = DRAFT; var err = $('#qrerr');
    if (!d.title.trim()) { err.textContent = 'Naam likhein.'; return; }
    if (!d.starts || !d.ends) { err.textContent = 'Shuru aur khatam ka time dono likhein.'; return; }
    var s = isoFromIst(d.starts), e = isoFromIst(d.ends);
    if (Date.parse(e) <= Date.parse(s)) { err.textContent = 'Khatam, shuru ke baad ka hona chahiye.'; return; }
    var items = null, keys = null;
    if (!d.locked) {
      for (var i = 0; i < d.items.length; i++) {
        var it = d.items[i];
        if (!it.q.trim()) { err.textContent = 'Sawal ' + (i + 1) + ' khali hai.'; return; }
        if (it.options.some(function (o) { return !String(o).trim(); })) { err.textContent = 'Sawal ' + (i + 1) + ' ke 4 options bharein.'; return; }
        if (!(it.correct >= 0 && it.correct <= 3)) { err.textContent = 'Sawal ' + (i + 1) + ' ka sahi jawab chunein.'; return; }
      }
      items = d.items.map(function (it, i) { return { id: it.id, sort: i + 1, q: it.q.trim(), options: it.options.map(function (o) { return String(o).trim(); }) }; });
      keys = d.items.map(function (it) { return { item_id: it.id, correct: it.correct, explanation: it.explanation.trim() || null }; });
    }
    var round = { id: d.id || undefined, title: d.title.trim(), starts_at: s, ends_at: e, published: d.published, show_leaderboard: d.show_leaderboard };
    err.textContent = 'Save ho raha hai…';
    St.quizSaveRound(round, items, keys).then(function () { closeModal(); CTL().toast('Round save ho gaya'); return CTL().refresh(); })
      .catch(function (x) { err.textContent = 'Save nahi hua: ' + (x && x.message ? x.message : 'kuch gadbad'); });
  }

  // ---------- alerts (notifications) ----------
  function alertsPanel(c) {
    var s = settings(c); var auto = Object.assign({ quiz_scheduled: true, quiz_soon: true, quiz_started: true, update: true, paigam: false, book: false }, s.auto || {});
    var EV = [['quiz_scheduled', 'Naya quiz round aaye (scheduled)'], ['quiz_soon', 'Quiz 10 minute me shuru (soon)'], ['quiz_started', 'Quiz shuru ho gaya (started)'], ['update', 'Naya update / announcement'], ['paigham', 'Aaj ka Paigham (har din)'], ['book', 'Nayi kitab']];
    var settingsHtml = '<div class="card"><div class="eyebrow">Notification settings</div><p class="small muted" style="margin:6px 0 10px">Har event par bell notification apne aap banega. Off karne se naya event notification nahi banega (purane rahenge).</p>' +
      EV.map(function (e) { var k = e[0] === 'paigham' ? 'paigam' : e[0]; var on = !!auto[k]; return '<div class="qz-sw"><span>' + esc(e[1]) + '</span><div class="seg"><button class="' + (on ? 'on' : '') + '" data-a="al-auto" data-k="' + k + '" data-v="1">On</button><button class="' + (!on ? 'on' : '') + '" data-a="al-auto" data-k="' + k + '" data-v="0">Off</button></div></div>'; }).join('') +
      '<p class="small muted" style="margin-top:10px">Phone push abhi ' + (c.pushCount || 0) + ' phone par on hai (sirf jinhone "alert on" kiya). WhatsApp par apne aap message nahi jaata: har notification ka "WhatsApp par share" button aap khud dabakar bhejein.</p></div>';
    var f = '<form class="card" data-f="note" style="display:grid;gap:10px;margin-top:12px"><div class="eyebrow">Naya notification (bell par)</div>' +
      '<div class="field"><label>Title</label><input name="title" required maxlength="200" placeholder="Jaise: Aaj ka quiz shuru"></div>' +
      '<div class="field"><label>Body (optional)</label><textarea name="body" rows="2" maxlength="1000"></textarea></div>' +
      '<div class="field"><label>Kahan le jaaye</label><select name="link"><option value="#/">Home</option><option value="#/quiz">Taj Quiz</option><option value="#/paigham">Aaj ka Paigham</option><option value="#/updates">Updates</option><option value="#/library">Taj Library</option></select></div>' +
      '<div class="field"><label>Kab (khali = abhi)</label><input name="when" type="datetime-local"><small class="muted">IST. Schedule ho to time aane par dikhega.</small></div>' +
      '<div class="actions" style="gap:8px"><button class="btn" type="submit">Bell par bhejein</button></div><p class="small" id="noteerr" style="color:#9A3B2E"></p></form>';
    var list = (c.notes || []).slice(0, 25).map(function (n) {
      var sent = parse(n.publish_at) <= St.now();
      var wa = waLink(n.title + (n.body ? '\n' + n.body : ''));
      return '<div class="qz-row"><div><span class="qz-st ' + (sent ? 'live' : 'scheduled') + '">' + (sent ? 'Dikh raha hai' : 'Scheduled') + '</span> <b>' + esc(n.title) + '</b><div class="small muted">' + esc(n.kind || '') + ' · ' + esc(fmt(n.publish_at)) + ' IST</div></div>' +
        '<div class="actions qz-acts" style="gap:6px;flex-wrap:wrap"><a class="btn ghost sm" href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp par share</a><button class="btn ghost sm" data-a="note-push" data-id="' + esc(n.id) + '">Phone push</button><button class="btn ghost sm" data-a="note-del" data-id="' + esc(n.id) + '">Hatayein</button></div></div>';
    }).join('');
    return '<h2 style="margin:0 0 6px">Alerts (notifications)</h2>' + settingsHtml + f + '<div class="card" style="margin-top:12px"><div class="eyebrow">Bheje gaye / scheduled</div><div class="tbl" style="margin-top:8px">' + (list || '<div class="empty">Abhi koi notification nahi.</div>') + '</div></div>';
  }

  // ---------- admin hooks ----------
  function act(a, el) {
    var c = TA().d;
    if (a === 'qz-set') { var v = el.dataset.v; var k = el.dataset.k; var val = k === 'leaderboard_top' ? +v : v === '1'; var p = {}; p[k] = val; return CTL().run(St.saveSite(p), 'Setting save ho gaya'); }
    if (a === 'qz-view') { VIEW = el.dataset.v; SEL = null; return CTL().draw(); }
    if (a === 'qz-month') { var base = MONTH || todayKey().slice(0, 7); var y = +base.slice(0, 4), m = +base.slice(5, 7) - 1 + (+el.dataset.v); var dt = new Date(Date.UTC(y, m, 1)); MONTH = dt.toISOString().slice(0, 7); return CTL().draw(); }
    if (a === 'qz-day') { DAY = DAY === el.dataset.v ? null : el.dataset.v; return CTL().draw(); }
    if (a === 'qz-new') { openEditor(c, null, el.dataset.day || null); return; }
    if (a === 'qz-edit') { openEditor(c, el.dataset.id, null); return; }
    if (a === 'qz-pub') { return CTL().run(St.update('quiz_rounds', el.dataset.id, { published: el.dataset.v === '1' }), el.dataset.v === '1' ? 'Publish ho gaya' : 'Chhupa diya'); }
    if (a === 'qz-del') { if (!confirm('Ye round, iske sawal aur sabhi jawab hata dein? Wapas nahi aayega.')) return; return CTL().run(St.quizDeleteRound(el.dataset.id), 'Round hata diya'); }
    if (a === 'qa-open') { SEL = el.dataset.id; return CTL().draw(); }
    if (a === 'qa-back') { SEL = null; return CTL().draw(); }
    if (a === 'qa-mark') { var p2 = {}; p2[el.dataset.k] = el.dataset.v === '1'; return CTL().run(St.attemptMark(el.dataset.id, p2), 'Save ho gaya'); }
    if (a === 'qa-del') { if (!confirm('Ye entry hata dein? Ye sirf is ek entry ko hatata hai.')) return; return CTL().run(St.remove('quiz_attempts', el.dataset.id), 'Entry hat gayi'); }
    if (a === 'qa-reset') { if (!confirm('Is round ke winner, pin aur hide marks hata dein? Jawab nahi jayenge.')) return; return CTL().run(St.attemptsReset(el.dataset.id), 'Board reset ho gaya'); }
    if (a === 'qa-wipe') { if (!confirm('Is round ke SAARE jawab (naam, phone, address) hamesha ke liye hata dein?')) return; return CTL().run(St.attemptsWipe(el.dataset.id), 'Jawab hata diye'); }
    if (a === 'qa-csv') return exportCsv(c, el.dataset.id);
    if (a === 'qr-add') { readDom(); DRAFT.items.push(blankItem(DRAFT.items.length + 1)); return drawEditor(); }
    if (a === 'qr-rm') { readDom(); DRAFT.items.splice(+el.dataset.i, 1); if (!DRAFT.items.length) DRAFT.items.push(blankItem(1)); return drawEditor(); }
    if (a === 'qr-cancel') return closeModal();
    if (a === 'al-auto') { var au = Object.assign({}, (c.site && c.site.auto) || {}); au[el.dataset.k] = el.dataset.v === '1'; return CTL().run(St.saveSite({ auto: au }), 'Setting save ho gaya'); }
    if (a === 'note-del') { if (!confirm('Ye notification hata dein?')) return; return CTL().run(St.remove('notifications', el.dataset.id), 'Hata diya'); }
    if (a === 'note-push') {
      if (!St.pushReady || !St.live) { CTL().toast('Phone push ke liye live setup chahiye (demo mode me nahi chalta).'); return; }
      return St.sendPush(el.dataset.id).then(function (r) { CTL().toast('Push bheja: ' + (r && r.sent != null ? r.sent + ' phone' : 'ho gaya')); }).catch(function (x) { CTL().toast('Push nahi gaya: ' + x.message); });
    }
    return undefined;
  }
  function exportCsv(c, rid) {
    var r = (c.quizRounds || []).filter(function (x) { return x.id === rid; })[0] || {};
    var head = ['round', 'submitted_ist', 'name', 'address', 'phone', 'city', 'score', 'total', 'winner', 'pinned', 'hidden'];
    var lines = [head.join(',')].concat(attemptsOf(c, rid).map(function (x) {
      return [r.title, fmt(x.submitted_at), x.name, x.address, x.phone_norm, x.city, x.score, x.total, x.winner ? 'yes' : 'no', x.pinned ? 'yes' : 'no', x.hidden ? 'yes' : 'no'].map(csvCell).join(',');
    }));
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'quiz-' + (r.title || 'round').replace(/[^a-z0-9]+/gi, '-').slice(0, 40) + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function submit(f) {
    if (f.dataset.f === 'qround') { saveRound(f); return true; }
    if (f.dataset.f === 'note') {
      var t = f.title.value.trim(); var err = $('#noteerr'); if (!t) { err.textContent = 'Title likhein.'; return true; }
      var row = { kind: 'custom', title: t, body: f.body.value.trim() || null, link: f.link.value, publish_at: f.when.value ? isoFromIst(f.when.value) : new Date(St.now()).toISOString() };
      return St.notify(row).then(function () { CTL().toast('Notification bell par gaya'); return CTL().refresh(); }).catch(function (x) { err.textContent = 'Nahi gaya: ' + x.message; });
    }
    return undefined;
  }
  // The dashboard and attempts counts; the Alerts list needs notes + push count from the loader.
  window.TajQuizAdmin = {
    quizPanel: quizPanel, alertsPanel: alertsPanel, act: act, submit: submit,
    reset: function () { DRAFT = null; }
  };
})();
