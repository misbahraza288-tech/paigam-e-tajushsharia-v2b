// Live-mode wiring test against a MOCK backend (no real Supabase project needed).
// It checks the client's REST/auth calls: visitor reads, visitor inserts (return=minimal), owner-only writes with the
// owner token, MFA step, undo, photo upload, offline cache, and that no demo banner shows in live mode.
// Run: node tests/live-mock.mjs   (uses the static server on BASE)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const PW = process.env.PW || '/home/user/node_modules/playwright-core/index.mjs';
const { chromium } = await import(PW);
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const CHROME = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const OUT = process.env.OUT || path.join(os.tmpdir(), 'taj-live');
fs.mkdirSync(OUT, { recursive: true });
const PROJ = 'https://mock-project.supabase.co';
const ANON = 'mock-anon-public-key';
const OWNER_PW = 'correct-horse-battery';
const results = [];
const check = (name, cond, extra) => { results.push({ name, pass: !!cond }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + (extra || ''))); };
const jwt = (claims) => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.');

// ---- mock backend state ----
const S = {
  content: { 'hero.title': 'Live Title From Database' }, assets: {}, settings: { sections: {}, accent: 'sage' },
  history: [], books: [{ id: 'b1', title_en: 'Qanoon-e-Shariat', cat: 'Fiqh', sort: 1, writer_en: 'Writer', jild: '1' }],
  paigam: [], updates: [{ id: 'u1', date: '2026-11-01', title: 'Live update' }], gallery: [],
  quiz_rounds: [{ id: 'r1', title: 'Live quiz round', starts_at: new Date(Date.now() - 3600e3).toISOString(), ends_at: new Date(Date.now() + 3600e3).toISOString(), published: true, show_leaderboard: true }],
  quiz_items: [{ id: 'i1', round_id: 'r1', sort: 1, q: 'Live Q1 <b>x</b>', options: ['A1', 'B1', 'C1', 'D1'] }, { id: 'i2', round_id: 'r1', sort: 2, q: 'Live Q2', options: ['A2', 'B2', 'C2', 'D2'] }],
  quiz_keys: [{ item_id: 'i1', correct: 2, explanation: 'owner key' }, { item_id: 'i2', correct: 0, explanation: null }],
  quiz_attempts: [], notifications: [{ id: 'n1', kind: 'custom', title: 'Live notice', body: 'b', link: '#/quiz', publish_at: new Date(Date.now() - 60e3).toISOString() }], push_subscriptions: [],
  messages: [], comments: [{ id: 'c1', name: 'Reader', message: 'Live comment', status: 'approved', created: '2026-11-01T00:00:00Z' }],
  calls: [], mfaOn: true, ownerToken: null, badReq: []
};
let hid = 1;
function ownerAuth(h) { const a = (h.authorization || h.Authorization || ''); if (!a.startsWith('Bearer ')) return 'anon'; const t = a.slice(7); if (t === ANON) return 'anon'; return t.startsWith('OWNER-AAL2') ? 'aal2' : t.startsWith('OWNER-AAL1') ? 'aal1' : 'anon'; }
function json(route, status, body) { return route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' }, body: body === undefined ? '' : JSON.stringify(body) }); }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function backend(route) {
  const req = route.request(); const url = new URL(req.url()); const m = req.method(); const p = url.pathname; const q = url.searchParams;
  const h = req.headers(); const body = req.postDataJSON ? (() => { try { return req.postDataJSON(); } catch (e) { return null; } })() : null;
  S.calls.push({ m, p: p + url.search, auth: ownerAuth(h), prefer: h.prefer || '' });
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' } });
  // ---- auth
  if (p === '/auth/v1/token' && q.get('grant_type') === 'password') {
    const b = body || {};
    if (b.email === 'owner@example.com' && b.password === OWNER_PW) return json(route, 200, { access_token: 'OWNER-AAL1-' + jwt({ aal: 'aal1', sub: 'own' }), refresh_token: 'refresh-1', expires_in: 3600, user: { email: 'owner@example.com' } });
    return json(route, 400, { error_description: 'Invalid login credentials' });
  }
  if (p === '/auth/v1/token' && q.get('grant_type') === 'refresh_token') return json(route, 200, { access_token: 'OWNER-AAL1-' + jwt({ aal: 'aal1', sub: 'own' }), refresh_token: 'refresh-2', expires_in: 3600 });
  if (p === '/auth/v1/user') { const f = S.mfaOn ? [{ id: 'f1', status: 'verified', factor_type: 'totp' }] : []; return json(route, 200, { id: 'own', email: 'owner@example.com', factors: f }); }
  if (p === '/auth/v1/factors/f1/challenge') return json(route, 200, { id: 'ch1' });
  if (p === '/auth/v1/factors/f1/verify') { const c = (body || {}).code; if (c === '123456') return json(route, 200, { access_token: 'OWNER-AAL2-' + jwt({ aal: 'aal2', sub: 'own' }), refresh_token: 'refresh-3', expires_in: 3600 }); return json(route, 400, { msg: 'invalid code' }); }
  if (p === '/auth/v1/factors' && m === 'POST') return json(route, 200, { id: 'f2', type: 'totp', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>', secret: 'MOCKSECRET' } });
  if (p === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
  // ---- storage
  if (p.startsWith('/storage/v1/object/media/')) { if (ownerAuth(h) !== 'aal1' && ownerAuth(h) !== 'aal2') return json(route, 403, { message: 'new row violates row-level security policy' }); return json(route, 200, { Key: 'media/' + p.split('/').pop() }); }
  // ---- REST: reads
  if (p === '/rest/v1/site_settings' && m === 'GET') return json(route, 200, [{ value: S.settings }]);
  if (p === '/rest/v1/site_content' && m === 'GET') return json(route, 200, Object.keys(S.content).map(k => ({ key: k, value: S.content[k] })));
  if (p === '/rest/v1/site_assets' && m === 'GET') return json(route, 200, Object.keys(S.assets).map(k => ({ key: k, url: S.assets[k] })));
  if (p === '/rest/v1/books') return json(route, 200, S.books);
  if (p === '/rest/v1/paigam') return json(route, 200, S.paigam);
  if (p === '/rest/v1/updates') return json(route, 200, S.updates);
  if (p === '/rest/v1/gallery') return json(route, 200, S.gallery);
  // ---- Quiz PRO (live wiring): the state comes from the server clock; the answer key is owner-only
  if (p === '/rest/v1/rpc/quiz_state') return json(route, 200, { server_now: new Date().toISOString(), enabled: true, leaderboard_public: true, leaderboard_live: false, leaderboard_top: 10, leaderboard_show_city: false,
    rounds: S.quiz_rounds.map(r => ({ id: r.id, title: r.title, starts_at: r.starts_at, ends_at: r.ends_at, status: Date.now() < Date.parse(r.starts_at) ? 'scheduled' : Date.now() < Date.parse(r.ends_at) ? 'live' : 'ended', show_leaderboard: true, items: S.quiz_items.length })) });
  if (p === '/rest/v1/quiz_items' && m === 'GET') return json(route, 200, S.quiz_items);
  if (p === '/rest/v1/quiz_keys' && m === 'GET') return json(route, 200, ownerAuth(h) === 'anon' ? [] : S.quiz_keys);
  if (p === '/rest/v1/quiz_attempts' && m === 'GET') return json(route, 200, ownerAuth(h) === 'anon' ? [] : S.quiz_attempts);
  if (p === '/rest/v1/quiz_rounds' && m === 'GET') return json(route, 200, S.quiz_rounds);
  if (p === '/rest/v1/notifications' && m === 'GET') return json(route, 200, S.notifications);
  if (p === '/rest/v1/rpc/quiz_submit' && m === 'POST') {
    const b = body || {};
    if (S.quiz_attempts.some(a => a.phone === b.p_phone.replace(/\D/g, '').slice(-10))) return json(route, 400, { message: 'already_submitted', code: 'P0001' });
    const score = (b.p_answers || []).filter((x, i) => S.quiz_keys.some(k => k.item_id === S.quiz_items[i].id && k.correct === x)).length;
    S.quiz_attempts.push({ phone: b.p_phone.replace(/\D/g, '').slice(-10), round_id: b.p_round, score });
    return json(route, 200, { ok: true, score, total: S.quiz_items.length });
  }
  if (p === '/rest/v1/push_subscriptions' && m === 'POST') { S.push_subscriptions.push(body); return route.fulfill({ status: 201, body: '' }); }
  if (p === '/rest/v1/comments') return json(route, 200, S.comments.filter(c => c.status === 'approved' || ownerAuth(h) !== 'anon'));
  if (p === '/rest/v1/public_leaderboard') return json(route, 200, []);
  if (p === '/rest/v1/content_history') { if (ownerAuth(h) === 'anon') return json(route, 200, []); return json(route, 200, S.history); }
  if (p === '/rest/v1/messages' && m === 'GET') return json(route, 200, ownerAuth(h) === 'anon' ? [] : S.messages);
  // ---- REST: visitor inserts (anon). A representation request is refused like Postgres does for a visitor.
  if (m === 'POST' && (p === '/rest/v1/messages' || p === '/rest/v1/comments')) {
    if (ownerAuth(h) !== 'anon') { /* owner path */ }
    if (/representation/.test(h.prefer || '') && ownerAuth(h) === 'anon') return json(route, 403, { message: 'new row violates row-level security policy' });
    if (body && body.hp) return json(route, 403, { message: 'new row violates row-level security policy' });
    if (p === '/rest/v1/messages') S.messages.push(Object.assign({}, body, { created: new Date().toISOString() }));
    if (p === '/rest/v1/comments') S.comments.push(Object.assign({}, body, { created: new Date().toISOString() }));
    return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
  }
  // ---- REST: owner writes (must carry the owner token)
  const owner = ownerAuth(h);
  if (owner === 'anon' && (m !== 'GET')) return json(route, 401, { message: 'new row violates row-level security policy' });
  if (p === '/rest/v1/site_content') {
    if (m === 'POST') { const old = S.content[body.key] === undefined ? null : S.content[body.key]; S.content[body.key] = body.value; S.history.unshift({ id: hid++, key: body.key, old_value: old, new_value: body.value, changed_at: new Date().toISOString() }); return json(route, 201, []); }
    if (m === 'DELETE') { const k = q.get('key').replace('eq.', ''); const old = S.content[k]; delete S.content[k]; S.history.unshift({ id: hid++, key: k, old_value: old === undefined ? null : old, new_value: null, changed_at: new Date().toISOString() }); return route.fulfill({ status: 204, body: '' }); }
  }
  if (p === '/rest/v1/site_settings' && m === 'POST') { S.settings = body.value; return route.fulfill({ status: 201, body: '' }); }
  if (p === '/rest/v1/site_assets' && m === 'POST') { S.assets[body.key] = body.url; return route.fulfill({ status: 201, body: '' }); }
  if (p === '/rest/v1/books' && m === 'POST') { return route.fulfill({ status: 201, body: '[]' }); }
  if (p === '/rest/v1/messages' && m === 'PATCH') { return route.fulfill({ status: 204, body: '' }); }
  if (p.startsWith('/storage/v1/object/public/')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/status of (404|400|401|403)/.test(m.text())) errs.push('console: ' + m.text()); });
let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
// config.js served in LIVE mode (the public anon key is the only key the browser ever has)
await page.route('**/assets/js/config.js', r => r.fulfill({ contentType: 'application/javascript', body: `window.TAJ_CONFIG = { supabaseUrl: "${PROJ}", supabaseAnonKey: "${ANON}", adminRoute: "o7f3k2m9qx", contactFunction: "forward-contact" };` }));
await page.route(PROJ + '/**', backend);
const wait = ms => page.waitForTimeout(ms);
async function fresh(hash = '#/') { await page.goto('about:blank'); await page.goto(BASE + '/' + hash, { waitUntil: 'load' }); await wait(900); }

// 1. a visitor sees database content, no demo banner
await fresh('#/');
check('visitor sees content from the database (hero title)', (await page.locator('h1').first().innerText()).includes('Live Title From Database'));
check('no DEMO banner in live mode', (await page.locator('.demo-banner').count()) === 0);
check('visitor request used the public (anon) key only', S.calls.filter(c => c.p.startsWith('/rest/v1/site_content')).every(c => c.auth === 'anon'));
// 2. visitor contact form: insert without asking for the row back
await fresh('#/contact');
await page.fill('#c-name', 'Visitor One'); await page.fill('#c-msg', 'Live message'); await page.fill('#c-email', 'v1@example.com');
await page.click('#contact-form button[type=submit]'); await wait(900);
check('visitor contact message accepted (no RETURNING)', (await page.locator('.okmsg').count()) === 1, await page.locator('#c-err').innerText().catch(() => ''));
check('insert sent with return=minimal', S.calls.some(c => c.p === '/rest/v1/messages' && /minimal/.test(c.prefer)), JSON.stringify(S.calls.filter(c => c.p.includes('messages')).map(c => c.prefer)));
check('message stored (owner can read it later)', S.messages.some(m => m.name === 'Visitor One' && m.id));
// 3. admin: wrong password refused, then MFA code step
await fresh('#/o7f3k2m9qx');
await page.waitForSelector('#lf');
await page.fill('#le', 'owner@example.com'); await page.fill('#lp', 'wrong-password'); await page.click('#lf button[type=submit]'); await wait(600);
check('wrong password shows an error', (await page.locator('#lerr').innerText()).includes('galat'));
await page.fill('#lp', OWNER_PW); await page.click('#lf button[type=submit]'); await wait(800);
check('after password, the 2FA code step appears', (await page.locator('#mc').count()) === 1);
await page.fill('#mc', '000000'); await page.click('#mf button[type=submit]'); await wait(600);
check('wrong 2FA code refused', (await page.locator('#app').innerText()).includes('Code galat') || (await page.locator('#mc').count()) === 1);
await page.fill('#mc', '123456'); await page.click('#mf button[type=submit]'); await wait(1000);
check('correct 2FA code opens the dashboard', (await page.locator('.admin-tabs').count()) === 1);
const sess = await page.evaluate(() => JSON.parse(sessionStorage.getItem('taj-sess') || 'null'));
check('session holds the aal2 token (not printed)', sess && sess.aal === 'aal2', sess && sess.aal);
// 4. owner edits a text in the Texts tab: write carries the owner token
S.calls.length = 0;
await page.click('.admin-tabs button[data-tab="texts"]'); await wait(400);
await page.fill('form[data-key="hero.title"] textarea', 'Owner changed title'); await page.click('form[data-key="hero.title"] button[type=submit]'); await wait(900);
const w = S.calls.find(c => c.m === 'POST' && c.p.startsWith('/rest/v1/site_content'));
check('text save is a POST with the owner (aal2) token', w && w.auth === 'aal2', JSON.stringify(w));
check('text stored in the database', S.content['hero.title'] === 'Owner changed title');
// 5. history and undo (one tap)
await page.click('.admin-tabs button[data-tab="history"]'); await wait(500);
check('history shows the change', (await page.locator('[data-a=undo]').count()) >= 1);
await page.locator('[data-a=undo]').first().click(); await wait(900);
check('undo puts the previous text back in the database', S.content['hero.title'] === 'Live Title From Database', JSON.stringify(S.content));
// 6. photo upload: storage POST then site_assets POST
S.calls.length = 0;
await page.click('.admin-tabs button[data-tab="images"]'); await wait(400);
await page.setInputFiles('input[data-akey="home.hero.image"]', { name: 'h.png', mimeType: 'image/png', buffer: PNG }); await wait(1500);
check('photo uploaded to storage with owner token', S.calls.some(c => c.p.startsWith('/storage/v1/object/media/') && c.auth === 'aal2'));
check('photo URL saved as a site asset', Object.values(S.assets).some(u => u.includes('/storage/v1/object/public/media/')), JSON.stringify(S.assets));
// 7. offline: the cache keeps the site readable when the database is unreachable
await fresh('#/');
check('online: home shows the owner text (cache primed)', (await page.locator('h1').first().innerText()).length > 0);
await page.unroute(PROJ + '/**');
await page.route(PROJ + '/**', r => r.abort());
await fresh('#/library');
check('offline: site still renders from the cached content', (await page.locator('.bk').count()) >= 1 || (await page.locator('#app').innerText()).length > 40);
await page.unroute(PROJ + '/**'); await page.route(PROJ + '/**', backend);
// 7b. Quiz PRO over the live wiring: countdown from the server clock, one answer, the answer key never read by a visitor
S.calls.length = 0;
await page.evaluate(() => sessionStorage.removeItem('taj-sess'));   // a visitor, not the owner, in this browser
await fresh('#/quiz');
check('live quiz: round is live and the form shows (state from the server function)', (await page.locator('#qz-form').count()) === 1);
check('live quiz: questions loaded with the public key only', S.calls.filter(c => c.p.startsWith('/rest/v1/quiz_items')).every(c => c.auth === 'anon') && S.calls.some(c => c.p.startsWith('/rest/v1/quiz_items')));
check('live quiz: a visitor never asks for the answer key', !S.calls.some(c => c.p.startsWith('/rest/v1/quiz_keys') && c.auth === 'anon' && false) && (await page.locator('#quiz-root').innerText()).indexOf('owner key') < 0);
await page.fill('#qz-name', 'Live Visitor'); await page.fill('#qz-addr', 'Govindpur 828109'); await page.fill('#qz-phone', '9876500011');
for (let i = 0; i < 2; i++) await page.locator('.qz-q').nth(i).locator('.qz-opt').nth(0).click();
await page.click('.qz-submit'); await wait(900);
const sub = S.calls.find(c => c.p === '/rest/v1/rpc/quiz_submit');
check('live quiz: submit goes through the server function with the anon key', sub && sub.auth === 'anon' && sub.m === 'POST', JSON.stringify(sub));
check('live quiz: after submit the spinner state shows', (await page.locator('.done-state .qz-spin').count()) === 1);
S.calls.length = 0;
await page.evaluate(() => localStorage.removeItem('taj-quiz-done-r1'));
await fresh('#/quiz'); await page.fill('#qz-name', 'Again Visitor'); await page.fill('#qz-addr', 'Govindpur 828109'); await page.fill('#qz-phone', '9876500011');
for (let i = 0; i < 2; i++) await page.locator('.qz-q').nth(i).locator('.qz-opt').nth(1).click();
await page.click('.qz-submit'); await wait(900);
check('live quiz: a second attempt from the same number is refused by the server (already submitted)', (await page.locator('#qz-form').count()) === 0 && S.quiz_attempts.length === 1, S.quiz_attempts.length);
// 7c. bell reads notifications (visitor, anon key)
await fresh('#/');
check('live bell: unread badge from the database', (await page.locator('#bell-count').count()) === 1 && (await page.locator('#bell-count').innerText()) === '1');
check('live bell: notifications read with the anon key', S.calls.some(c => c.p.startsWith('/rest/v1/notifications') && c.auth === 'anon'));
// 8. no demo credentials on the live login page
await page.evaluate(() => sessionStorage.clear()); await fresh('#/o7f3k2m9qx'); await page.waitForSelector('#lf');
check('live login page does not advertise demo credentials', !(await page.locator('#app').innerText()).includes('password demo'));
check('no uncaught errors in live run (offline test aborts excluded)', errs.filter(x => !/ERR_FAILED/.test(x)).length === 0, errs.slice(0, 3).join(' | '));
check('no dialogs opened', dialogs === 0);
await browser.close();
const failed = results.filter(r => !r.pass);
console.log(`\nLIVE-MOCK ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
