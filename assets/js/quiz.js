/* Taj Quiz (public page): countdown, questions, one attempt, submitted state, results and leaderboard.
   Everything time-based uses the SERVER clock (TajStore.now); the answer key is never fetched before the round ends.
   Renders into #quiz-root. No inline script; every value that comes from the database goes through esc(). */
(function () {
  'use strict';
  var St = window.TajStore;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LET = ['A', 'B', 'C', 'D'];
  var ROOT = null, TIMER = null, STATE = null, ITEMS = {}, LAST_STATUS = '', BUSY = false, MSG = '';
  var DONE_KEY = function (id) { return 'taj-quiz-done-' + id; };
  var CACHE_KEY = 'taj-quiz-state';

  function parse(ts) { return Date.parse(String(ts).replace(/(\.\d{3})\d+/, '$1')); }
  function now() { return St.now(); }
  function statusOf(r) { var t = now(); if (t < parse(r.starts_at)) return 'scheduled'; if (t < parse(r.ends_at)) return 'live'; return 'ended'; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ist(ts) { try { return new Date(parse(ts)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('anim-off'); }
  function done(id) { try { return JSON.parse(localStorage.getItem(DONE_KEY(id)) || 'null'); } catch (e) { return null; } }
  function markDone(id, v) { try { localStorage.setItem(DONE_KEY(id), JSON.stringify(v)); } catch (e) {} }
  function rounds() { return (STATE && STATE.rounds) || []; }
  function pick() {
    var rs = rounds();
    var live = rs.filter(function (r) { return statusOf(r) === 'live'; })[0];
    var next = rs.filter(function (r) { return statusOf(r) === 'scheduled'; })[0];
    var ended = rs.filter(function (r) { return statusOf(r) === 'ended'; }); ended = ended[ended.length - 1];
    return { live: live, next: next, ended: ended };
  }
  function stop() { if (TIMER) clearInterval(TIMER); TIMER = null; ROOT = null; }

  // ----- countdown -----
  var LBL = { d: 'din', h: 'ghante', m: 'minute', s: 'second' };
  function clockHtml(ts, big) {
    return '<div class="qz-clock' + (big ? ' big' : '') + '" data-ts="' + esc(ts) + '" role="timer" aria-live="off">' +
      ['d', 'h', 'm', 's'].map(function (k) { return '<div class="qz-unit"><span class="qz-digits" data-k="' + k + '"><b>00</b></span><small>' + LBL[k] + '</small></div>'; }).join('') + '</div>';
  }
  function setDigit(el, k, v) {
    var box = el.querySelector('[data-k="' + k + '"] b'); if (!box) return;
    var t = pad(v);
    if (box.textContent !== t) { box.textContent = t; if (!reduced()) { box.classList.remove('flip'); void box.offsetWidth; box.classList.add('flip'); } }
  }
  function tickClocks() {
    if (!ROOT) return;
    var t = now();
    ROOT.querySelectorAll('.qz-clock').forEach(function (el) {
      var diff = Math.max(0, parse(el.dataset.ts) - t);
      var s = Math.floor(diff / 1000);
      setDigit(el, 'd', Math.floor(s / 86400)); setDigit(el, 'h', Math.floor(s % 86400 / 3600));
      setDigit(el, 'm', Math.floor(s % 3600 / 60)); setDigit(el, 's', s % 60);
    });
    var st = statusNow();
    if (st !== LAST_STATUS) { LAST_STATUS = st; refresh(); }
  }
  function statusNow() { var p = pick(); return (p.live ? 'L' + p.live.id : '') + '|' + (p.next ? 'N' + p.next.id : '') + '|' + (p.ended ? 'E' + p.ended.id : ''); }
  function startTicking() { if (TIMER) clearInterval(TIMER); LAST_STATUS = statusNow(); TIMER = setInterval(function () { if (!ROOT || !ROOT.isConnected) { stop(); return; } tickClocks(); }, 1000); tickClocks(); }

  // ----- helpers -----
  function fetchState() {
    return St.quizState().then(function (s) { STATE = s; try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch (e) {} return s; })
      .catch(function (e) {
        var c = null; try { c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (x) {}
        if (c) { STATE = c; STATE.__cached = true; return c; }
        throw e;
      });
  }
  function items(roundId) {
    if (ITEMS[roundId]) return Promise.resolve(ITEMS[roundId]);
    return St.list('quiz_items', { eq: { round_id: roundId }, order: 'sort' }).then(function (rows) { ITEMS[roundId] = rows || []; return ITEMS[roundId]; });
  }
  function errText(raw) {
    var m = {
      quiz_off: 'Quiz abhi band hai. Owner jab chahega tab khulega.',
      not_open_yet: 'Quiz abhi shuru nahi hua. Clock khatam hone ka intezaar karein.',
      quiz_ended: 'Ye quiz khatam ho chuka hai.',
      round_missing: 'Ye quiz ab available nahi hai.',
      bad_name: 'Naam sahi likhein (kam se kam 2 letter).',
      bad_address: 'Address thoda detail me likhein.',
      bad_phone: 'Mobile number 10 digit ka likhein.',
      bad_answers: 'Har sawal ka ek jawab chunein.',
      already_submitted: 'Is mobile number se is quiz ka jawab pehle hi aa chuka hai.',
      busy: 'Abhi bahut log jawab de rahe hain. Thodi der baad try karein.',
      push_needs_live: '', bot: 'Form bhejne me kuch gadbad hui. Page reload karke dobara try karein.'
    };
    return m[raw] != null ? m[raw] : 'Kuch gadbad hui. Dobara try karein.';
  }

  // ----- views -----
  function head(eyebrow, title) {
    return '<div class="qz-head rv"><span class="qz-eyebrow">' + esc(eyebrow) + '</span>' + (title ? '<h2 class="qz-title">' + esc(title) + '</h2>' : '') + '</div>';
  }
  function viewScheduled(r) {
    return '<div class="qz-hero rv">' + head('Quiz shuru hone me', r.title) + clockHtml(r.starts_at, true) +
      '<p class="qz-meta">Shuru: ' + esc(ist(r.starts_at)) + ' IST · ' + (r.items || 0) + ' sawal</p>' +
      '<p class="small muted center">Quiz shuru hote hi sawal yahin khul jayenge. Ek mobile number se sirf ek baar jawab.</p></div>';
  }
  function viewClosed() {
    return '<div class="qz-hero rv">' + head('Abhi koi quiz scheduled nahi', '') + '<p class="small muted center">Owner jab naya round daalega, yahan countdown aa jayega.</p></div>';
  }
  function viewLive(r, list) {
    var mine = done(r.id);
    if (mine) return viewSubmitted(r);
    if (!list) return '<div class="qz-hero rv">' + head('Quiz khatam hone me', r.title) + clockHtml(r.ends_at, true) + '<p class="small muted center">Sawal load ho rahe hain…</p></div>';
    if (!list.length) return '<div class="qz-hero rv">' + head('Quiz khatam hone me', r.title) + clockHtml(r.ends_at, true) + '<p class="small muted center">Is round ke sawal abhi nahi aaye. Thodi der baad dekhein.</p></div>';
    var qs = list.map(function (it, i) {
      return '<fieldset class="qz-q rv"><legend><span class="qz-qn">Sawal ' + (i + 1) + ' / ' + list.length + '</span></legend>' +
        '<p class="qz-qtext">' + esc(it.q) + '</p><div class="qz-opts" role="radiogroup" aria-label="Sawal ' + (i + 1) + ' ke jawab">' +
        (it.options || []).slice(0, 4).map(function (o, j) {
          return '<label class="qz-opt"><input type="radio" name="q' + i + '" value="' + j + '"><span class="qz-let">' + LET[j] + '</span><span class="qz-otext">' + esc(o) + '</span></label>';
        }).join('') + '</div></fieldset>';
    }).join('');
    return '<div class="qz-hero compact rv">' + head('Quiz khatam hone me', r.title) + clockHtml(r.ends_at, false) + '</div>' +
      '<form class="qz-form" id="qz-form" novalidate data-round="' + esc(r.id) + '">' + qs +
      '<div class="qz-card rv"><div class="eyebrow">Aapki details</div>' +
      '<div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<div class="field"><label for="qz-name">Naam</label><input id="qz-name" name="name" required minlength="2" maxlength="80" autocomplete="name"></div>' +
      '<div class="field"><label for="qz-addr">Address</label><textarea id="qz-addr" name="address" required minlength="5" maxlength="300" rows="2" autocomplete="street-address"></textarea></div>' +
      '<div class="field"><label for="qz-phone">Mobile number</label><input id="qz-phone" name="phone" required inputmode="tel" maxlength="16" autocomplete="tel" placeholder="10 digit"></div>' +
      '<div class="field"><label for="qz-city">Shehar <span class="muted">(optional, leaderboard ke liye)</span></label><input id="qz-city" name="city" maxlength="60" autocomplete="address-level2"></div>' +
      '<details class="qz-privacy"><summary>Privacy: aapka data kya hai?</summary><p>Naam, address aur mobile number sirf is quiz ke liye liye jate hain. Ye sirf site ke owner ke paas rehte hain, public nahi hote. Owner kabhi bhi aapki entry delete kar sakta hai. Public leaderboard par sirf pehla naam (aur chahein to shehar) dikhega.</p></details>' +
      '<p class="small muted" style="margin:6px 0 0">Jawab jama karne ke baad badal nahi sakte. Ek mobile number se ek hi baar.</p>' +
      '<button class="btn qz-submit" type="submit">Jawab jama karein</button><p class="small qz-err" id="qz-err" role="alert"></p></div></form>';
  }
  function spinner(size) {
    return '<svg class="qz-spin" viewBox="0 0 80 80" width="' + size + '" height="' + size + '" aria-hidden="true"><circle class="ring" cx="40" cy="40" r="34"/><circle class="track" cx="40" cy="40" r="34"/>' +
      '<line class="hand h" x1="40" y1="40" x2="40" y2="18"/><line class="hand m" x1="40" y1="40" x2="58" y2="40"/><circle class="pin" cx="40" cy="40" r="3"/></svg>';
  }
  function viewSubmitted(r) {
    var mine = done(r.id) || {};
    var p = pick(); var target = p.live && p.live.id === r.id ? r.ends_at : (p.next ? p.next.starts_at : r.ends_at);
    var what = p.live && p.live.id === r.id ? 'Result aur agla round' : (p.next ? 'Agla round shuru hone me' : 'Result ka waqt');
    return '<div class="qz-hero rv done-state">' + spinner(120) + head('Aapka jawab jama ho gaya', r.title) +
      '<p class="qz-score">Score: ' + esc(mine.score) + ' / ' + esc(mine.total) + '</p>' +
      '<p class="small muted center">' + esc(what) + '</p>' + clockHtml(target, false) +
      '<p class="small muted center">Result round khatam hone ke baad leaderboard par dikhega (owner ne allow kiya ho to).</p></div>';
  }
  function viewEnded(r, reveal, board) {
    var mine = done(r.id);
    var ans = reveal ? reveal.items.map(function (it, i) {
      var sel = mine && mine.answers ? mine.answers[i] : null;
      return '<div class="qz-rev rv"><p class="qz-qtext"><b>' + (i + 1) + '.</b> ' + esc(it.q) + '</p><ol class="qz-ropts">' +
        it.options.map(function (o, j) { return '<li class="' + (j === it.correct ? 'ok' : (sel === j ? 'no' : '')) + '"><span class="qz-let">' + LET[j] + '</span> ' + esc(o) + (j === it.correct ? ' <em>sahi jawab</em>' : '') + '</li>'; }).join('') +
        '</ol>' + (it.explanation ? '<p class="small muted qz-expl">' + esc(it.explanation) + '</p>' : '') + '</div>';
    }).join('') : '';
    return '<div class="qz-hero rv">' + head('Quiz khatam ho chuka hai', r.title) +
      (mine ? '<p class="qz-score">Aapka score: ' + esc(mine.score) + ' / ' + esc(mine.total) + '</p>' : '<p class="small muted center">Is round me aapne jawab nahi diya.</p>') +
      '</div>' + (board || '') + (ans ? '<div class="eyebrow" style="margin:26px 0 8px">Sahi jawab</div>' + ans : '');
  }
  function boardHtml(r, rows) {
    if (!rows || !rows.length) return '<div class="qz-board rv"><div class="eyebrow">Leaderboard</div><p class="small muted">Abhi koi entry public nahi hai.</p></div>';
    return '<div class="qz-board rv"><div class="eyebrow">Leaderboard · ' + esc(r.title) + '</div><ol class="qz-rank">' + rows.map(function (x) {
      return '<li class="' + (x.winner ? 'win' : '') + '"><b>' + esc(x.rank) + '</b><span class="qz-nm">' + esc(x.first_name) + (x.city ? ' <small class="muted">' + esc(x.city) + '</small>' : '') + (x.winner ? ' <i class="qz-badge">Winner</i>' : '') + (x.pinned ? ' <i class="qz-badge pin">Top pick</i>' : '') + '</span><span class="qz-sc">' + esc(x.score) + ' / ' + esc(x.total) + '</span></li>';
    }).join('') + '</ol></div>';
  }

  // ----- render -----
  function render(list, reveal, board) {
    if (!ROOT) return;
    var p = pick(); var html = '';
    if (STATE && STATE.enabled === false) {
      html = '<div class="qz-hero rv">' + head('Quiz abhi band hai', '') + '<p class="small muted center">Owner jab quiz chalu karega, tab yahan countdown aur sawal aayenge.</p></div>';
    } else if (p.live) {
      html = viewLive(p.live, list);
    } else if (p.next) {
      html = viewScheduled(p.next);
    } else if (p.ended) {
      html = viewEnded(p.ended, reveal, board);
    } else {
      html = viewClosed();
    }
    if (p.ended && !p.live && !p.next && !reveal) html = html;
    if (p.ended && (p.live || p.next) && STATE && STATE.enabled !== false) html += '<div class="qz-last">' + (p.ended ? '<span class="small muted">Pichla quiz: ' + esc(p.ended.title) + '</span>' : '') + '</div>';
    ROOT.innerHTML = html;
    var f = ROOT.querySelector('#qz-form'); if (f) bindForm(f);
    startTicking();
  }
  function refresh() {
    if (!ROOT) return;
    fetchState().then(function () {
      var p = pick();
      var ended = p.ended && !p.live && !p.next ? p.ended : null;
      var live = p.live;
      var load = live ? items(live.id) : Promise.resolve(null);
      var rev = ended && ended.show_leaderboard !== false ? St.rpc('quiz_reveal', { p_round: ended.id }).catch(function () { return null; }) : Promise.resolve(null);
      var brd = ended && ended.show_leaderboard !== false ? St.rpc('quiz_leaderboard', { p_round: ended.id }).catch(function () { return []; }) : Promise.resolve(null);
      return Promise.all([load, rev, brd]).then(function (r) {
        if (ended) { render(null, r[1], boardHtml(ended, r[2])); }
        else render(r[0], null, '');
        if (ended && !r[1]) { /* answers appear after the round ends */ }
      });
    }).catch(function () {
      if (ROOT) ROOT.innerHTML = '<div class="qz-hero rv"><p class="small muted center">Quiz abhi load nahi ho pa raha. Internet check karke page reload karein.</p></div>';
    });
  }
  function bindForm(form) {
    form.onsubmit = function (e) {
      e.preventDefault();
      if (BUSY) return;
      var err = form.querySelector('#qz-err'); err.textContent = '';
      if (form.website && form.website.value) return; // honeypot: a bot filled it; pretend nothing happened
      var roundId = form.dataset.round;
      var list = ITEMS[roundId] || [];
      var answers = [];
      for (var i = 0; i < list.length; i++) {
        var c = form.querySelector('input[name="q' + i + '"]:checked');
        if (!c) { err.textContent = 'Sab sawal ke jawab chunein.'; shake(form); return; }
        answers.push(+c.value);
      }
      var name = form.name.value.trim(), addr = form.address.value.trim(), phone = form.phone.value.trim();
      if (name.length < 2) { err.textContent = 'Naam likhein.'; shake(form); return; }
      if (addr.length < 5) { err.textContent = 'Address likhein.'; shake(form); return; }
      if (phone.replace(/\D/g, '').replace(/^(91|0)/, '').length !== 10) { err.textContent = 'Mobile number 10 digit ka likhein.'; shake(form); return; }
      BUSY = true;
      var btn = form.querySelector('.qz-submit'); btn.disabled = true; btn.textContent = 'Bhej rahe hain…';
      St.rpc('quiz_submit', { p_round: roundId, p_name: name, p_address: addr, p_phone: phone, p_answers: answers, p_hp: '', p_city: (form.city.value || '').trim() })
        .then(function (res) {
          BUSY = false;
          markDone(roundId, { score: res.score, total: res.total, answers: answers, at: new Date(now()).toISOString() });
          if (window.TajApp && window.TajApp.toast) window.TajApp.toast('Jawab jama ho gaya');
          render(list, null, '');
        })
        .catch(function (x) {
          BUSY = false; btn.disabled = false; btn.textContent = 'Jawab jama karein';
          var raw = x && x.raw;
          if (raw === 'already_submitted') { markDone(roundId, { score: '—', total: list.length, answers: answers, at: new Date(now()).toISOString(), note: 'pehle se' }); render(list, null, ''); return; }
          if (raw === 'not_open_yet' || raw === 'quiz_ended' || raw === 'round_missing' || raw === 'quiz_off') { refresh(); return; }
          err.textContent = errText(raw || ''); shake(form);
        });
    };
  }
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  // ----- public entry points -----
  function mount(root) {
    stop(); ROOT = root; ITEMS = {}; BUSY = false;
    root.innerHTML = '<div class="skel"></div><div class="skel short"></div>';
    fetchState().then(function () { refresh(); }).catch(function () {
      if (ROOT) ROOT.innerHTML = '<div class="qz-hero rv"><p class="small muted center">Quiz abhi load nahi ho pa raha. Internet check karke dobara kholein.</p></div>';
    });
  }
  function lastTop() {
    return St.quizState().then(function (s) {
      STATE = s;
      var ended = (s.rounds || []).filter(function (r) { return statusOf(r) === 'ended'; }); ended = ended[ended.length - 1];
      if (!ended) return null;
      return St.rpc('quiz_leaderboard', { p_round: ended.id }).then(function (rows) { return rows && rows[0] ? { first_name: rows[0].first_name, score: rows[0].score + ' / ' + rows[0].total } : null; });
    });
  }
  window.TajQuiz = { mount: mount, stop: stop, lastTop: lastTop, statusOf: statusOf };
})();
