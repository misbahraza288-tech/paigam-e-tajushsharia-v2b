// Policy test for a REAL Supabase project (run once the owner gives the Project URL + anon key).
// It uses only the PUBLIC anon key and checks that a visitor can do exactly what is allowed and nothing more.
// Usage:  SUPABASE_URL=https://xyz.supabase.co SUPABASE_ANON_KEY=... node supabase/policy-test.mjs
//    or:  node supabase/policy-test.mjs https://xyz.supabase.co <anon-key>
// It never prints the key. It writes ONE junk message named "POLICY-TEST" (the only write it makes); delete it in Messages.
const url = (process.env.SUPABASE_URL || process.argv[2] || '').replace(/\/+$/, '');
const key = process.env.SUPABASE_ANON_KEY || process.argv[3] || '';
if (!/^https:\/\/[^\s]+$/.test(url) || key.length < 20) {
  console.error('Usage: SUPABASE_URL=https://<project>.supabase.co SUPABASE_ANON_KEY=<anon public key> node supabase/policy-test.mjs');
  process.exit(2);
}
if (/service_role/i.test(key) || key.startsWith('eyJ') && (() => { try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch (e) { return false; } })()) {
  console.error('STOP: this looks like a SERVICE ROLE key. Use the anon (public) key only. Never paste service_role anywhere.');
  process.exit(2);
}
const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
const results = [];
const rec = (name, pass, detail) => { results.push(pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  -> ' + detail)); };
async function call(method, path, body, prefer) {
  const h = Object.assign({}, H); if (prefer) h.Prefer = prefer;
  try {
    const r = await fetch(url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
    return { status: r.status, body: j };
  } catch (e) { return { status: 0, body: 'network: ' + e.message }; }
}
const denied = (r) => r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0 && false);
const writeBlocked = (r) => r.status >= 400 || (r.status < 300 && Array.isArray(r.body) && r.body.length === 0);

// reads the visitor SHOULD have
let r = await call('GET', '/rest/v1/site_content?select=key,value&limit=5');
rec('visitor CAN read site content', r.status === 200 && Array.isArray(r.body), JSON.stringify(r).slice(0, 160));
r = await call('GET', '/rest/v1/site_settings?select=id&id=eq.site');
rec('visitor CAN read site settings', r.status === 200 && Array.isArray(r.body), r.status);
r = await call('GET', '/rest/v1/books?select=id&limit=1');
rec('visitor CAN read books', r.status === 200, r.status);
r = await call('GET', '/rest/v1/comments?select=id,status&limit=50');
rec('visitor sees ONLY approved comments', r.status === 200 && Array.isArray(r.body) && r.body.every(x => x.status === 'approved'), JSON.stringify(r.body).slice(0, 120));
r = await call('GET', '/rest/v1/public_leaderboard?select=first_name,score&limit=3');
rec('visitor CAN read leaderboard (first name + score only)', r.status === 200 && Array.isArray(r.body) && r.body.every(x => Object.keys(x).every(k => ['first_name', 'score', 'id', 'date'].includes(k))), r.status);

// reads the visitor must NOT have
r = await call('GET', '/rest/v1/messages?select=*&limit=5');
rec('visitor CANNOT read contact messages', r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0), JSON.stringify(r.body).slice(0, 120));
r = await call('GET', '/rest/v1/quiz_entries?select=*&limit=5');
rec('visitor CANNOT read quiz entries (phone, address)', r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0), JSON.stringify(r.body).slice(0, 120));
r = await call('GET', '/rest/v1/content_history?select=*&limit=5');
rec('visitor CANNOT read the change history', r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0), JSON.stringify(r.body).slice(0, 120));
r = await call('GET', '/rest/v1/owners?select=*');
rec('visitor CANNOT read the owners list', r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0), JSON.stringify(r.body).slice(0, 120));
r = await call('GET', '/storage/v1/object/list/media', { prefix: '', limit: 5 });
rec('visitor CANNOT list media files', r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0), r.status);

// writes the visitor must NOT be able to make (blocked = error, or nothing changed)
r = await call('POST', '/rest/v1/site_content', { key: 'policy.test', value: 'HACKED' });
rec('visitor CANNOT write site content', r.status >= 400, r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
r = await call('PATCH', '/rest/v1/site_content?key=eq.home.hero.title', { value: 'HACKED' }, 'return=representation');
rec('visitor CANNOT change an existing text', writeBlocked(r), r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
r = await call('POST', '/rest/v1/books', { id: 'policy-test', title_en: 'HACKED' });
rec('visitor CANNOT add a book', r.status >= 400, r.status);
r = await call('PATCH', '/rest/v1/site_settings?id=eq.site', { value: { accent: 'plum' } }, 'return=representation');
rec('visitor CANNOT change site settings', writeBlocked(r), r.status);
r = await call('POST', '/rest/v1/owners', { user_id: '00000000-0000-0000-0000-000000000000' });
rec('visitor CANNOT add itself as owner', r.status >= 400, r.status);
r = await call('POST', '/rest/v1/site_assets', { key: 'logo', url: 'https://example.com/x.png' });
rec('visitor CANNOT set the logo or photos', r.status >= 400, r.status);
r = await call('POST', '/storage/v1/object/media/policy-test.jpg', undefined);
rec('visitor CANNOT upload to the media bucket', r.status >= 400, r.status);

// the visitor writes that MUST work
r = await call('POST', '/rest/v1/messages', { id: 'policy-test-' + Date.now(), name: 'POLICY-TEST', email: 'policy@example.com', message: 'policy test - delete me', read: false, forwarded: false }, 'return=minimal');
rec('visitor CAN send a contact message', r.status === 201 || r.status === 200 || r.status === 204, r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
r = await call('POST', '/rest/v1/messages', { id: 'policy-hp-' + Date.now(), name: 'Bot', message: 'spam', read: false, forwarded: false, hp: 'filled' }, 'return=minimal');
rec('honeypot-filled contact message is refused', r.status >= 400, r.status);
r = await call('POST', '/rest/v1/comments', { id: 'policy-c-' + Date.now(), name: 'Reader', message: 'Masha Allah', status: 'approved' }, 'return=minimal');
rec('visitor cannot post a comment already approved', r.status >= 400, r.status);
r = await call('POST', '/rest/v1/quiz_entries', { id: 'policy-q-' + Date.now(), date: new Date().toISOString().slice(0, 10), first_name: 'Test', full_name: 'Test', phone: '9876543210', address: 'Test', score: 999, total: 3 }, 'return=minimal');
rec('quiz score above total is refused', r.status >= 400, r.status);
console.log(`\n${results.filter(Boolean).length}/${results.length} policy checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
