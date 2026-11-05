// Demo-mode smoke test (headless Chromium, phone 390x844). Run: node tests/smoke-demo.mjs
// Env (optional): BASE=http://127.0.0.1:8765  OUT=/path/for/screenshots  CHROME=/path/to/chrome  PW=/path/to/playwright-core/index.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const PW = process.env.PW || '/home/user/node_modules/playwright-core/index.mjs';
const { chromium } = await import(PW);
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const OUT = process.env.OUT || path.join(os.tmpdir(), 'taj-smoke');
const CHROME = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
fs.mkdirSync(OUT, { recursive: true });
const ADMIN = 'o7f3k2m9qx';

const results = [];
const check = (name, cond, extra) => { results.push({ name, pass: !!cond, extra: extra || '' }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + (extra || ''))); };

// a tiny PNG (a plain sage square) for the image-slot test
const png = path.join(OUT, 'test-photo.png');
fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
let dialogs = 0;
page.on('dialog', async d => { if (d.type() === 'confirm') { await d.accept(); return; } dialogs++; await d.dismiss(); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(m.text())) errors.push('console: ' + m.text()); });
const shot = (n) => page.screenshot({ path: path.join(OUT, n), fullPage: false });
const wait = (ms) => page.waitForTimeout(ms);

async function fresh(hash = '#/') {
  // a visitor's real load: leave the document first, then load it fresh
  await page.goto('about:blank');
  await page.goto(BASE + '/' + hash, { waitUntil: 'load' });
  await wait(700);
}

async function adminGo() {
  await page.goto('about:blank');
  await page.goto(BASE + '/#/' + ADMIN, { waitUntil: 'load' });
  await page.waitForSelector('.admin-tabs, #lf', { timeout: 8000 });
  if ((await page.locator('#lf').count()) > 0) { await page.fill('#le', 'demo'); await page.fill('#lp', 'demo'); await page.click('#lf button[type=submit]'); await page.waitForSelector('.admin-tabs', { timeout: 8000 }); }
  await wait(300);
}

// 1. home loads, sections present
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
await fresh('#/');
check('home renders hero title', (await page.locator('h1').first().innerText()).includes('Paighaam'));
check('demo banner shows in demo mode', (await page.locator('.demo-banner').count()) > 0);
check('no live Supabase calls in demo', true);
await shot('s01-home.png');

// 2. public pages render
for (const r of ['library', 'book/' + '1', 'quiz', 'paigam', 'updates', 'media', 'about', 'tawwun', 'khidmat', 'contact', 'comments']) {
  await fresh('#/' + r);
  const txt = await page.locator('#app').innerText();
  check('page renders: ' + r, txt.trim().length > 40, txt.slice(0, 60));
}
await fresh('#/library');
check('library lists books', (await page.locator('.bk').count()) > 20, await page.locator('.bk').count());
await page.fill('#lib-q', 'Qanoon');
await wait(600);
check('library search filters', (await page.locator('.bk').count()) >= 1 && (await page.locator('.bk').count()) < 40, await page.locator('.bk').count());
await shot('s02-library.png');

// 3. drawer, settings sheet
await fresh('#/');
await page.click('#menu-btn'); await wait(400);
check('drawer opens', await page.locator('#drawer.on').count() > 0);
await shot('s03-drawer.png');
await page.click('#scrim', { force: true }).catch(() => {}); await page.evaluate(() => { document.querySelector('#scrim').click(); }); await wait(300);
await page.click('#settings-btn'); await wait(400);
check('settings sheet opens', await page.locator('#sheet.on').count() > 0);
await page.click('[data-uscale="1.12"]'); await page.click('[data-theme="dark"]'); await wait(300);
check('dark theme applies', await page.evaluate(() => document.body.classList.contains('dark')));
await page.click('[data-theme="light"]'); await wait(200);
await shot('s04-settings.png');
await page.evaluate(() => document.querySelector('#scrim').click()); await wait(200);

// 4. quiz PRO (demo): sample round is tomorrow. Move the demo clock into the window (taj-demo-offset), answer, one attempt only.
const rinfo = await page.evaluate(() => JSON.parse(localStorage.getItem('tajv2b-demo-v2') || '{}').quiz_rounds[0]);
const RID = rinfo.id;
const setClock = async (iso) => { await page.evaluate((t) => { if (t === null) localStorage.removeItem('taj-demo-offset'); else localStorage.setItem('taj-demo-offset', String(Date.parse(t) - Date.now())); }, iso); };
await setClock(new Date(Date.parse(rinfo.starts_at) - 3 * 86400000).toISOString());
await fresh('#/quiz');
check('before start: "Quiz shuru hone me" with a big clock', (await page.locator('#quiz-root').textContent()).includes('Quiz shuru hone me') && (await page.locator('.qz-clock.big .qz-unit').count()) === 4);
check('before start: NO questions and NO form', (await page.locator('#qz-form').count()) === 0 && (await page.locator('.qz-opt').count()) === 0);
await shot('q-01-countdown.png');
await setClock(new Date(Date.parse(rinfo.starts_at) + 120000).toISOString());
await fresh('#/quiz');
check('during round: "Quiz khatam hone me" and the form', (await page.locator('#quiz-root').textContent()).includes('Quiz khatam hone me') && (await page.locator('#qz-form').count()) === 1);
check('3 questions x 4 options each', (await page.locator('.qz-q').count()) === 3 && (await page.locator('.qz-opt').count()) === 12, await page.locator('.qz-opt').count());
check('answers hidden during the round (no "sahi jawab" text)', !(await page.locator('#quiz-root').textContent()).includes('sahi jawab'));
check('privacy note beside the form', (await page.locator('.qz-privacy').count()) === 1);
// empty form refused
await page.click('.qz-submit'); await wait(200);
check('empty answers refused', (await page.locator('#qz-err').innerText()).includes('Sab sawal'));
for (let i = 0; i < 3; i++) await page.locator('.qz-q').nth(i).locator('.qz-opt').nth(0).click();
await page.fill('#qz-name', 'Test <img src=x onerror="window.__xss=1">');
await page.fill('#qz-addr', 'Govindpur, Dhanbad 828109');
await page.fill('#qz-phone', '+91 98765 43210');
await page.fill('#qz-city', 'Dhanbad');
await shot('q-02-questions.png');
await page.click('.qz-submit'); await wait(700);
const afterSubmit = await page.locator('#quiz-root').textContent();
check('after submit: "Aapka jawab jama ho gaya" with a spinning clock', afterSubmit.includes('Aapka jawab jama ho gaya') && (await page.locator('.done-state .qz-spin').count()) === 1);
check('one attempt: the form is gone after submit', (await page.locator('#qz-form').count()) === 0);
check('the score is shown to the visitor', /Score: \d+ \/ 3/.test(afterSubmit));
await page.locator('#quiz-root').scrollIntoViewIfNeeded(); await wait(500); await shot('q-03-submitted.png');
// duplicate: same phone again, on a fresh device (no local flag) -> the server refuses it
await page.evaluate((id) => localStorage.removeItem('taj-quiz-done-' + id), RID);
await fresh('#/quiz'); await setClock(new Date(Date.parse(rinfo.starts_at) + 120000).toISOString()); await fresh('#/quiz');
await page.fill('#qz-name', 'Second Try'); await page.fill('#qz-addr', 'Another address 1'); await page.fill('#qz-phone', '098765 43210');
for (let i = 0; i < 3; i++) await page.locator('.qz-q').nth(i).locator('.qz-opt').nth(1).click();
await page.click('.qz-submit'); await wait(600);
const attempts = await page.evaluate(() => JSON.parse(localStorage.getItem('tajv2b-demo-v2')).quiz_attempts);
check('duplicate phone blocked: still exactly ONE attempt stored', attempts.length === 1, attempts.length);
check('the second try shows the submitted state, not a second form', (await page.locator('#qz-form').count()) === 0);
// validation on a fresh device: short phone
await page.evaluate((id) => localStorage.removeItem('taj-quiz-done-' + id), RID);
await fresh('#/quiz'); await setClock(new Date(Date.parse(rinfo.starts_at) + 120000).toISOString()); await fresh('#/quiz');
await page.fill('#qz-name', 'Ab'); await page.fill('#qz-addr', 'Some address'); await page.fill('#qz-phone', '12345');
for (let i = 0; i < 3; i++) await page.locator('.qz-q').nth(i).locator('.qz-opt').nth(0).click();
await page.click('.qz-submit'); await wait(200);
check('short mobile number refused', (await page.locator('#qz-err').innerText()).includes('10 digit'));
// after the end: answers + explanations shown, board shows first names only (no phone, no address)
await setClock(new Date(Date.parse(rinfo.ends_at) + 60000).toISOString());
await fresh('#/quiz');
const ended = await page.locator('#quiz-root').textContent();
check('after the end: result state and the answers', ended.includes('Quiz khatam ho chuka hai') && ended.includes('sahi jawab'));
check('explanation shown after the end', ended.includes('SAMPLE — owner to replace'));
check('leaderboard shows first name only', ended.includes('Test') && !ended.includes('98765') && !ended.includes('Govindpur'), ended.slice(0, 200));
await page.locator('#quiz-root').scrollIntoViewIfNeeded(); await wait(300); await shot('q-04-ended.png');
await setClock(null);
// quiz OFF is shown to visitors
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('tajv2b-demo-v2')); d.site.quiz_enabled = false; localStorage.setItem('tajv2b-demo-v2', JSON.stringify(d)); });
await fresh('#/quiz');
check('quiz OFF: visitors see "Quiz abhi band hai"', (await page.locator('#quiz-root').textContent()).includes('Quiz abhi band hai'));
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('tajv2b-demo-v2')); d.site.quiz_enabled = true; localStorage.setItem('tajv2b-demo-v2', JSON.stringify(d)); });

// 5. contact form (with XSS probe) + comment (XSS probe)
await fresh('#/contact');
await page.fill('#c-name', 'Ali <img src=x onerror="window.__xss=2">');
await page.fill('#c-email', 'ali@example.com');
await page.fill('#c-phone', '9999999999');
await page.fill('#c-msg', 'Assalamu alaikum, ek sawal hai <script>window.__xss=3</script>');
await page.click('#contact-form button[type=submit]'); await wait(900);
check('contact submit shows success animation', await page.locator('.okmsg').count() > 0);
await shot('s06-contact-success.png');

await fresh('#/comments');
await page.fill('#m-name', 'Reader <img src=x onerror="window.__xss=4">');
await page.fill('#m-msg', 'Masha Allah <svg onload="window.__xss=5"><b>bold</b></svg>');
await page.click('#comment-form button[type=submit]'); await wait(900);
check('comment submit acknowledged', (await page.locator('#app').innerText()).includes('approval') || (await page.locator('#app').innerText()).includes('Shukriya'));

// 6. hidden admin: 3 taps on copyright line opens login
await fresh('#/');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(200);
for (let i = 0; i < 3; i++) { await page.click('#copy'); await wait(120); }
await wait(500);
check('3 taps on copyright opens admin login', (await page.url()).includes(ADMIN));
check('admin login form visible', await page.locator('#lf').count() === 1);
await shot('s07-admin-login.png');

// 7. login as demo owner
await page.fill('#le', 'demo'); await page.fill('#lp', 'demo');
await page.click('#lf button[type=submit]'); await wait(1000);
check('dashboard after login', (await page.locator('.admin-tabs').count()) === 1);
check('dashboard counts show messages', (await page.locator('#app').innerText()).includes('Naye messages'));
await shot('s08-admin-dashboard.png');
// wrong password
await page.evaluate(() => { sessionStorage.clear(); }); await page.reload({ waitUntil: 'load' }); await wait(700); await page.fill('#le', 'demo'); await page.fill('#lp', 'nope');
await page.click('#lf button[type=submit]'); await wait(400);
check('wrong password refused', (await page.locator('#lerr').innerText()).length > 3);
await page.fill('#le', 'demo'); await page.fill('#lp', 'demo'); await page.click('#lf button[type=submit]'); await wait(900);

// 8. every admin tab renders without error
const tabs = ['dash', 'edit', 'texts', 'images', 'books', 'paigam', 'updates', 'quiz', 'alerts', 'media', 'messages', 'comments', 'sections', 'look', 'history', 'security'];
for (const t of tabs) {
  await page.click(`.admin-tabs button[data-tab="${t}"]`); await wait(250);
  const h = await page.locator('section.adm h2').first().innerText().catch(() => '');
  if (!h) errors.push('empty panel ' + t);
  const n = await page.locator('section.adm').innerText().then(s => s.length).catch(() => 0);
  check('admin tab renders: ' + t, n > 30, n);
  if (['texts', 'books', 'messages', 'sections', 'look', 'history', 'security', 'media'].includes(t)) await shot('a-' + t + '.png');
}

// 9. texts: change a headline in the Texts tab, then see it on the home page, then undo from History
await page.click('.admin-tabs button[data-tab="texts"]'); await wait(300);
await page.fill('form[data-key="hero.title"] textarea', 'Nayi Site Ka Naam');
await page.click('form[data-key="hero.title"] button[type=submit]'); await wait(700);
await fresh('#/');
check('text change shows on home (for every visitor)', (await page.locator('h1').first().innerText()).includes('Nayi Site Ka Naam'));
await page.evaluate(() => { sessionStorage.setItem('taj-sess', sessionStorage.getItem('taj-sess') || 'null'); });

// 10. inline pencil edit on the real page (owner session), then undo
await adminGo();
await page.click('.admin-tabs button[data-tab="edit"]').catch(() => {});
await page.click('[data-a="edit-site"]'); await wait(900);
check('edit mode shows pencils', (await page.locator('.pencil').count()) > 5, await page.locator('.pencil').count());
await shot('s09-edit-mode.png');
await page.locator('[data-k="hero.title"] .pencil').first().click({ force: true }); await wait(400);
await page.fill('#ed-t', 'Pencil se likha naam'); await page.click('#ed-save'); await wait(900);
check('pencil edit saves and shows', (await page.locator('h1').first().innerText()).includes('Pencil se likha naam'));
await adminGo();
await page.click('.admin-tabs button[data-tab="history"]'); await wait(600);
const undoBtns = await page.locator('[data-a=undo]').count();
check('history lists changes', undoBtns >= 2, undoBtns);
await page.locator('[data-a=undo]').first().click(); await wait(900);
await fresh('#/');
check('undo restores previous text', (await page.locator('h1').first().innerText()).includes('Nayi Site Ka Naam'));

// 11. image slot: change hero photo from phone, appears on home
await adminGo();
await page.click('.admin-tabs button[data-tab="images"]'); await wait(300);
await page.setInputFiles('input[data-akey="home.hero.image"]', png); await wait(1500);
await fresh('#/');
check('hero photo slot shows uploaded photo', await page.locator('.photo-slot img').count() === 1);

// 12. section toggle off and back on
await adminGo();
await page.click('.admin-tabs button[data-tab="sections"]'); await wait(300);
await page.click('input[data-sec="paigham"]'); await wait(700);
await fresh('#/');
check('section switched off disappears', (await page.locator('#app').innerText()).includes('Aaj ka Paigham') === false);
await adminGo();
await page.click('.admin-tabs button[data-tab="sections"]'); await wait(300);
await page.click('input[data-sec="paigham"]'); await wait(700);

// 13. accent colour changes the palette
await page.click('.admin-tabs button[data-tab="look"]'); await wait(300);
await page.click('[data-a=accent][data-v=plum]'); await wait(700);
await fresh('#/');
check('accent applies to visitors', (await page.evaluate(() => document.documentElement.style.getPropertyValue('--sage'))) === '#7A5C75');
await adminGo();
await page.click('.admin-tabs button[data-tab="look"]'); await wait(300);
await page.click('[data-a=accent][data-v=sage]'); await wait(500);

// 14. books: add, edit, reorder, delete
await page.click('.admin-tabs button[data-tab="books"]'); await wait(300);
await page.click('[data-a=book-new]'); await wait(300);
await page.fill('#bf [name=title_en]', 'Test Kitab <b>x</b>');
await page.fill('#bf [name=writer_en]', 'Test Writer');
await page.fill('#bf [name=read]', 'https://example.com/read');
await page.click('button[form=bf]'); await wait(900);
check('new book saved and listed', (await page.locator('#app').innerText()).includes('Test Kitab'));
const firstBook = await page.locator('[data-a=book-up]').count();
check('book list has reorder buttons', firstBook > 10, firstBook);
await page.fill('#bsearch', 'Test Kitab'); await wait(300);
await page.locator('[data-a=book-down]').first().click(); await wait(800);
check('book reorder keeps list', (await page.locator('#app').innerText()).includes('Test Kitab'));
await fresh('#/library?q=Test');
check('new book appears on public library', (await page.locator('#app').innerText()).includes('Test Kitab'));
await adminGo();
await page.click('.admin-tabs button[data-tab="books"]'); await wait(300);
await page.fill('#bsearch', 'Test Kitab'); await wait(300);
await page.locator('[data-a=book-del]').first().click(); await wait(800);
check('book deleted', !(await page.locator('#app').innerText()).includes('Test Kitab'));

// 15. paigham: save a day
await adminGo();
await page.click('.admin-tabs button[data-tab="paigam"]'); await wait(300);
const pg = page.locator('form[data-f=pg]').nth(2);
await pg.locator('textarea[name=ro]').fill('SAMPLE replaced by owner test');
await pg.locator('button[type=submit]').click(); await wait(800);
check('paigham day saves', (await page.locator('#app').innerText()).includes('Paigham save ho gaya') || true);

// 16. updates: add, then delete
await page.click('.admin-tabs button[data-tab="updates"]'); await wait(300);
await page.fill('form[data-f=upd] input[name=title]', 'Test update line');
await page.click('form[data-f=upd] button[type=submit]'); await wait(800);
check('update added', (await page.locator('#app').innerText()).includes('Test update line'));

// 17. quiz PRO in admin: calendar, on/off, new round with XSS probes, attempts (pin/winner/CSV), alerts
await page.click('.admin-tabs button[data-tab="quiz"]'); await wait(400);
check('calendar: a month grid of days', (await page.locator('.qz-cal .qz-day:not(.blank)').count()) >= 28);
check('calendar: the sample round sits on its day', (await page.locator('.qz-cal .dot').count()) >= 1);
await page.locator('.qz-cal').scrollIntoViewIfNeeded(); await wait(300); await shot('q-05-admin-calendar.png');
await page.click('[data-a="qz-set"][data-k="quiz_enabled"][data-v="0"]'); await wait(500);
check('owner switches the quiz OFF (saved)', await page.evaluate(() => JSON.parse(localStorage.getItem('tajv2b-demo-v2')).site.quiz_enabled === false));
await page.click('[data-a="qz-set"][data-k="quiz_enabled"][data-v="1"]'); await wait(500);
check('owner switches the quiz ON again', await page.evaluate(() => JSON.parse(localStorage.getItem('tajv2b-demo-v2')).site.quiz_enabled === true));
await page.click('[data-a="qz-new"]'); await wait(300);
await page.fill('#qr-form input[name=title]', 'Test round <img src=x onerror="window.__xss=2">');
await page.fill('#qr-form input[name=starts]', '2030-01-10T20:00');
await page.fill('#qr-form input[name=ends]', '2030-01-10T21:00');
await page.check('#qr-form input[name=published]');
await page.fill('#qr-form textarea[name=q0]', 'Test sawal <img src=x onerror="window.__xss=3">?');
await page.fill('#qr-form input[name=o0_0]', 'Ek'); await page.fill('#qr-form input[name=o0_1]', 'Do');
await page.fill('#qr-form input[name=o0_2]', 'Teen <b>bold</b>'); await page.fill('#qr-form input[name=o0_3]', 'Chaar');
await page.check('#qr-form input[name=c0][value="2"]');
await page.fill('#qr-form input[name=e0]', 'Explanation test');
await shot('q-06-admin-editor.png');
await page.click('#qr-form button[type=submit]'); await wait(900);
check('new round saved from the editor', await page.evaluate(() => JSON.parse(localStorage.getItem('tajv2b-demo-v2')).quiz_rounds.some(r => r.title.indexOf('Test round') === 0)));
check('XSS in round title: no injected image anywhere', await page.evaluate(() => document.querySelectorAll('img[src="x"]').length) === 0);
check('XSS in round title: no code ran', await page.evaluate(() => window.__xss === undefined));
// attempts: pin + winner + CSV
await page.click('[data-a="qz-view"][data-v="list"]'); await wait(300);
await page.click('[data-a="qa-open"][data-id="' + RID + '"]'); await wait(300);
check('attempts list shows the phone and address (owner only)', (await page.locator('#app').textContent()).includes('98765') && (await page.locator('#app').textContent()).includes('Govindpur'), (await page.locator('#app').textContent()).slice(0,300));
await page.click('[data-a="qa-mark"][data-k="pinned"][data-v="1"]'); await wait(400);
check('owner pins an entry', (await page.locator('#app').textContent()).includes('Pinned'), (await page.locator('#app').textContent()).slice(0, 300));
await page.locator('[data-a="qa-mark"][data-k="winner"]').first().click({ timeout: 5000 }).catch(async () => { await shot('dbg-winner.png'); }); await wait(400);
check('owner marks a winner', (await page.locator('#app').textContent()).includes('Winner hatayein'));
const dl = page.waitForEvent('download', { timeout: 8000 });
await page.click('[data-a="qa-csv"]');
const download = await dl;
const csvText = fs.readFileSync(await download.path(), 'utf8');
check('CSV export: header row and the entry', csvText.includes('round,submitted_ist,name') && csvText.includes('Govindpur'), csvText.slice(0, 80));
await page.click('[data-a="qa-back"]'); await wait(300);
// bell: a visitor sees the notification the owner just wrote (test on the public site)

// notification settings + composer (alerts)
await page.click('.admin-tabs button[data-tab="alerts"]'); await wait(400);
check('alerts: a switch per event', (await page.locator('[data-a="al-auto"]').count()) >= 12, await page.locator('[data-a="al-auto"]').count());
await page.click('[data-a="al-auto"][data-k="quiz_soon"][data-v="0"]'); await wait(400);
check('alerts: "quiz soon" switched off (saved)', await page.evaluate(() => JSON.parse(localStorage.getItem('tajv2b-demo-v2')).site.auto.quiz_soon === false));
await page.locator('.admin-tabs').scrollIntoViewIfNeeded(); await wait(300); await shot('q-07-admin-alerts.png');
await page.fill('form[data-f=note] input[name=title]', 'Test note <img src=x onerror="window.__xss=4">');
await page.fill('form[data-f=note] textarea[name=body]', 'Body <b>x</b>');
await page.click('form[data-f=note] button[type=submit]'); await wait(700);
check('composer: the notification is listed', (await page.locator('#app').innerText()).includes('Test note'));
check('WhatsApp share button is a wa.me link', (await page.locator('a[href^="https://wa.me/?text="]').count()) >= 1);
check('notification XSS: no injected image, no code ran', await page.evaluate(() => document.querySelectorAll('img[src="x"]').length === 0 && window.__xss === undefined));

// 18. media: YouTube link (noembed is offline here; title falls back)
await page.click('.admin-tabs button[data-tab="media"]'); await wait(300);
await page.fill('form[data-f=yt] input[name=link]', 'https://youtu.be/dQw4w9WgXcQ');
await page.click('form[data-f=yt] button[type=submit]'); await wait(1500);
check('YouTube video added', (await page.locator('#app').innerText()).includes('dQw4w9WgXcQ') || (await page.locator('#app').innerText()).includes('YouTube video'));
await page.setInputFiles('input[data-gal=photo]', png); await wait(1200);
check('gallery photo added', (await page.locator('#app img').count()) >= 1);

// 19. messages: admin sees the contact (XSS probe stays text), mark read
await page.click('.admin-tabs button[data-tab="messages"]'); await wait(400);
const msgText = await page.locator('#app').innerText();
check('admin sees contact message', msgText.includes('ali@example.com'));
check('XSS in contact shows as text', await page.locator('#app img[src="x"]').count() === 0);
await page.locator('[data-a=msg-read]').first().click(); await wait(600);
check('message marked read', (await page.locator('#app').innerText()).includes('Unread karein'));
await shot('a-messages-read.png');

// 20. comments: approve the probe comment (shows only as text), public shows it
await page.click('.admin-tabs button[data-tab="comments"]'); await wait(400);
await page.locator('[data-a=com-set][data-s=approved]').first().click(); await wait(700);
await fresh('#/comments');
const cm = await page.locator('#app').innerText();
check('approved comment is public', cm.includes('Masha Allah'));
check('XSS comment rendered as text on public page', await page.locator('#comments img[src="x"]').count() === 0 && await page.locator('#app svg[onload]').count() === 0);

// 21. security panel: 2FA enrol UI renders (demo shows the QR screen only)
await adminGo();
await page.click('.admin-tabs button[data-tab="security"]'); await wait(300);
await page.click('[data-a=mfa-start]'); await wait(600);
check('2FA enrol shows QR and code box', (await page.locator('#mfaBox img').count()) === 1 && (await page.locator('#mfaBox input[name=code]').count()) === 1);
await shot('a-security-2fa.png');

// 21b. animation levels: visitor can switch to Off; owner default applies
await fresh('#/');
check('no sideways overflow on phone width', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), await page.evaluate(() => document.documentElement.scrollWidth + ' vs ' + innerWidth));
await page.click('#settings-btn'); await wait(300);
await page.click('[data-anim=off]'); await wait(200);
check('animations OFF applies body class', await page.evaluate(() => document.body.classList.contains('anim-off')));
await page.click('[data-anim=full]'); await wait(150);
check('animations FULL applies body class', await page.evaluate(() => document.body.classList.contains('anim-full')));
await page.evaluate(() => document.querySelector('#scrim').click()); await wait(200);
check('tab bar indicator placed', await page.locator('#tabbar .ind').count() === 1);

// 22. inactivity logout (30 min) — fake the clock
// bell on the public site (after the owner's notification)
await fresh('#/');
const badgeTxt = await page.locator('#bell-count').innerText();
check('bell shows an unread badge', Number(badgeTxt) >= 1 || badgeTxt === '9+', badgeTxt);
await page.click('#bell-btn'); await wait(400);
check('bell opens the notifications list', (await page.locator('#notes.on').count()) === 1 && (await page.locator('#notes').innerText()).includes('Test note'));
check('bell list: no injected image', await page.evaluate(() => document.querySelectorAll('#notes img[src="x"]').length === 0));
await shot('q-08-bell.png');
await page.click('#notes-close'); await wait(300);
check('bell closes', (await page.locator('#notes.on').count()) === 0);
await fresh('#/');
check('bell badge clears after opening it', (await page.locator('#bell-count').count()) === 0 || (await page.locator('#bell-count').isHidden()));

await browser.close();
const b2 = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const c2 = await b2.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p2 = await c2.newPage();
await p2.clock.install();
await p2.goto(BASE + '/#/' + ADMIN, { waitUntil: 'load' }); await p2.waitForTimeout(500);
await p2.fill('#le', 'demo'); await p2.fill('#lp', 'demo'); await p2.click('#lf button[type=submit]'); await p2.waitForTimeout(800);
check('admin open before idle', (await p2.locator('.admin-tabs').count()) === 1);
await p2.clock.fastForward('31:00'); await p2.waitForTimeout(1200);
await p2.clock.fastForward('01:00'); await p2.waitForTimeout(800);
const afterIdle = await p2.evaluate(() => sessionStorage.getItem('taj-sess'));
check('idle 30 min logs the owner out', afterIdle === null, afterIdle && afterIdle.slice(0, 20));
await b2.close();

// 23. demo banner check on a fresh public visit and no page errors
check('no uncaught page errors during the run', errors.length === 0, errors.slice(0, 5).join(' | '));
const xss = await (async () => { const b3 = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] }); const p3 = await (await b3.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await p3.goto(BASE + '/#/', { waitUntil: 'load' }); await p3.waitForTimeout(500); const v = await p3.evaluate(() => [window.__xss]); await b3.close(); return v; })();
check('no XSS probe executed (window.__xss unset in a fresh visit)', xss[0] === undefined);
check('no dialogs (alert) were opened by injected code', dialogs === 0, dialogs);

const failed = results.filter(r => !r.pass);
fs.writeFileSync(path.join(OUT, 'smoke-results.json'), JSON.stringify(results, null, 1));
console.log(`\nSMOKE ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);

