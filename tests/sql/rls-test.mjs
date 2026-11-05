
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const db = new PGlite();
const schema = fs.readFileSync(process.argv[2], 'utf8');
const results = [];
function ok(name, cond, extra) { results.push({ name, pass: !!cond, extra: extra || '' }); }
async function asRole(role, claims, sql, params) {
  await db.exec('reset role');
  await db.exec(`set role ${role}`);
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify(claims || {}).replace(/'/g, "''")}', false)`);
  await db.exec(`select set_config('request.jwt.claim.sub', '${(claims && claims.sub) || ''}', false)`);
  try { const r = await db.query(sql, params); return { ok: true, rows: r.rows, affected: r.affectedRows }; }
  catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec('reset role'); }
}
await db.exec(fs.readFileSync(process.argv[3], 'utf8'));
await db.exec(schema);
const OWNER = '11111111-1111-1111-1111-111111111111';
await db.exec(`insert into auth.users(id,email) values ('${OWNER}','owner@example.com') on conflict do nothing`);
await db.exec(`insert into public.owners(user_id) values ('${OWNER}') on conflict do nothing`);
const anon = {ro: 'anon'};
const own = { sub: OWNER, role: 'authenticated', aal: 'aal1' };
const own2 = { sub: OWNER, role: 'authenticated', aal: 'aal2' };

// ---- anon: reads
let r = await asRole('anon', anon, 'select key from public.site_content');
ok('anon can read site_content', r.ok, r.err);
r = await asRole('anon', anon, 'select * from public.site_settings');
ok('anon can read site_settings', r.ok && r.rows.length === 1, r.err);
r = await asRole('anon', anon, 'select * from public.public_leaderboard');
ok('anon can read leaderboard view', r.ok, r.err);
// ---- anon: must NOT write content
r = await asRole('anon', anon, `insert into public.site_content(key,value) values ('hero.title','HACKED')`);
ok('anon CANNOT insert site_content', !r.ok, r.ok ? 'inserted!' : '');
r = await asRole('anon', anon, `update public.site_content set value='HACKED' where key='hero.title'`);
ok('anon update site_content affects 0 rows', r.ok && r.affected === 0 || !r.ok, r.err || r.affected);
r = await asRole('anon', anon, `delete from public.site_content`);
ok('anon delete site_content affects 0 rows', (r.ok && r.affected === 0) || !r.ok, r.err || r.affected);
r = await asRole('anon', anon, `insert into public.books(id,title_en) values ('x','Hacked')`);
ok('anon CANNOT insert books', !r.ok, r.ok ? 'inserted!' : '');
r = await asRole('anon', anon, `update public.site_settings set value='{"accent":"plum"}' where id='site'`);
ok('anon CANNOT change site_settings', (r.ok && r.affected === 0) || !r.ok, r.err || r.affected);
r = await asRole('anon', anon, `insert into public.owners(user_id) values ('22222222-2222-2222-2222-222222222222')`);
ok('anon CANNOT add itself to owners', !r.ok, r.ok ? 'inserted!' : '');
r = await asRole('anon', anon, `insert into public.site_assets(key,url) values ('logo','https://evil.example/x.png')`);
ok('anon CANNOT set site assets', !r.ok, r.ok ? 'inserted!' : '');
r = await asRole('anon', anon, `insert into storage.objects(bucket_id,name) values ('media','evil.jpg')`);
ok('anon CANNOT upload to media bucket', !r.ok, r.ok ? 'inserted!' : '');
r = await asRole('anon', anon, `select id from storage.objects`);
ok('anon cannot list media objects', r.ok && r.rows.length === 0, r.err);
// ---- anon: must NOT read private rows
await asRole('anon', anon, `select 1`); // noop
await db.exec(`reset role`);
await db.exec(`insert into public.messages(id,name,email,message) values ('m-private','Private Person','p@example.com','secret text')`);
await db.exec(`insert into public.quiz_entries(id,date,first_name,full_name,phone,address,score,total) values ('e-private',current_date,'Priv','Private Person','9876543210','Some address',1,3)`);
await db.exec(`insert into public.comments(id,name,message,status) values ('c-pending','Pend','waiting','pending'),('c-ok','Ok','visible','approved')`);
r = await asRole('anon', anon, `select * from public.messages`);
ok('anon CANNOT read messages', r.ok && r.rows.length === 0, r.err || r.rows.length);
r = await asRole('anon', anon, `select * from public.quiz_entries`);
ok('anon CANNOT read quiz phone/address rows', r.ok && r.rows.length === 0, r.err || r.rows.length);
r = await asRole('anon', anon, `select * from public.comments`);
ok('anon sees only approved comments', r.ok && r.rows.length === 1 && r.rows[0].id === 'c-ok', JSON.stringify(r.rows && r.rows.map(x=>x.id)));
r = await asRole('anon', anon, `select * from public.content_history`);
ok('anon CANNOT read content history', r.ok && r.rows.length === 0, r.err || r.rows.length);
r = await asRole('anon', anon, `select * from public.owners`);
ok('anon CANNOT read owners list', r.ok && r.rows.length === 0, r.err || r.rows.length);
// ---- anon: allowed inserts
r = await asRole('anon', anon, `insert into public.messages(id,name,email,phone,message,read,forwarded) values ('m-1','Ali','ali@example.com','9999999999','Assalam','false','false')`);
ok('anon CAN send a contact message', r.ok, r.err);
r = await asRole('anon', anon, `insert into public.messages(id,name,message,read,forwarded,hp) values ('m-bot','Bot','spam','false','false','http://spam')`);
ok('honeypot-filled message is refused', !r.ok, r.ok ? 'accepted!' : '');
r = await asRole('anon', anon, `insert into public.messages(id,name,message,read) values ('m-read','Ali','x','true')`);
ok('anon cannot insert an already-read message', !r.ok, r.ok ? 'accepted!' : '');
r = await asRole('anon', anon, `insert into public.messages(id,name,email,message) values ('m-bad','Ali','not-an-email','x')`);
ok('bad email refused', !r.ok, r.ok ? 'accepted!' : '');
r = await asRole('anon', anon, `insert into public.messages(id,name,message) values ('m-long','Ali', '${'a'.repeat(1300)}')`);
ok('overlong message refused', !r.ok, r.ok ? 'accepted!' : '');
r = await asRole('anon', anon, `insert into public.comments(id,name,message,status) values ('c-ok2','Ali','hi','approved')`);
ok('anon cannot post a comment already approved', !r.ok, r.ok ? 'accepted!' : '');
r = await asRole('anon', anon, `insert into public.comments(id,name,message) values ('c-1','Ali','<img src=x onerror=alert(1)>')`);
ok('anon CAN post a pending comment', r.ok, r.err);
r = await asRole('anon', anon, `insert into public.quiz_entries(id,date,first_name,full_name,phone,address,score,total,hp) values ('qe-bot',current_date,'B','B','1234567890','a',1,3,'x')`);
ok('quiz honeypot refused', !r.ok, r.ok ? 'accepted!' : '');
r = await asRole('anon', anon, `insert into public.quiz_entries(id,date,first_name,full_name,phone,address,score,total) values ('qe-1',current_date,'Ali','Ali Khan','+91 98765-43210','Govindpur',2,3)`);
ok('anon CAN submit a quiz entry', r.ok, r.err);
r = await asRole('anon', anon, `insert into public.quiz_entries(id,date,first_name,full_name,phone,address,score,total) values ('qe-cheat',current_date,'Ali','Ali','1234567890','x',99,3)`);
ok('quiz score above total refused', !r.ok, r.ok ? 'accepted!' : '');
r = await asRole('anon', anon, `insert into public.quiz_entries(id,date,first_name,full_name,phone,address,score,total) values ('qe-phone',current_date,'Ali','Ali','abc-letters','x',1,3)`);
ok('quiz phone with letters refused', !r.ok, r.ok ? 'accepted!' : '');
// ---- brake: 100/hour for messages (already 2 anon ok rows above count toward it)
let accepted = 0;
for (let i = 0; i < 120; i++) { const q = await asRole('anon', anon, `insert into public.messages(id,name,message) values ('bulk-${i}','Spam','hello ${i}')`); if (q.ok) accepted++; }
ok('hourly brake stops message floods (accepts < 120)', accepted < 120 && accepted > 0, 'accepted=' + accepted);
// ---- owner: writes and history
r = await asRole('authenticated', own, `insert into public.site_content(key,value) values ('hero.title','Owner title')`);
ok('owner CAN insert site_content', r.ok, r.err);
r = await asRole('authenticated', own, `update public.site_content set value='Owner title 2' where key='hero.title'`);
ok('owner CAN update site_content', r.ok && r.affected === 1, r.err || r.affected);
r = await asRole('authenticated', own, `select key, old_value, new_value, changed_by from public.content_history where key='hero.title' order by id`);
ok('history records insert and update', r.ok && r.rows.length === 2 && r.rows[1].old_value === 'Owner title' && r.rows[1].new_value === 'Owner title 2', JSON.stringify(r.rows));
ok('history records who changed it', r.ok && r.rows[0].changed_by === OWNER, r.rows && r.rows[0] && r.rows[0].changed_by);
r = await asRole('authenticated', own, `select updated_by from public.site_content where key='hero.title'`);
ok('updated_by stamped with owner', r.ok && r.rows[0].updated_by === OWNER, r.err);
r = await asRole('authenticated', own, `delete from public.site_content where key='hero.title'`);
ok('owner delete logs history with null new_value', r.ok && r.affected === 1, r.err);
r = await asRole('authenticated', own, `select count(*)::int as n from public.content_history where key='hero.title' and new_value is null`);
ok('delete recorded', r.ok && r.rows[0].n === 1, r.err);
r = await asRole('authenticated', own, `insert into public.site_assets(key,url) values ('logo','https://x.supabase.co/storage/v1/object/public/media/logo.jpg') on conflict (key) do update set url=excluded.url`);
ok('owner CAN set assets (upsert)', r.ok, r.err);
r = await asRole('authenticated', own, `update public.site_settings set value='{"accent":"teal"}'::jsonb where id='site'`);
ok('owner CAN update settings', r.ok && r.affected === 1, r.err);
r = await asRole('authenticated', own, `select * from public.messages`);
ok('owner CAN read messages', r.ok && r.rows.length >= 2, r.err || r.rows.length);
r = await asRole('authenticated', own, `update public.messages set read = true where id='m-1'`);
ok('owner CAN mark message read', r.ok && r.affected === 1, r.err || r.affected);
r = await asRole('authenticated', own, `update public.comments set status='approved' where id='c-pending'`);
ok('owner CAN approve comment', r.ok && r.affected === 1, r.err || r.affected);
r = await asRole('authenticated', own, `select count(*)::int as n from public.quiz_entries`);
ok('owner CAN read quiz entries', r.ok && r.rows[0].n >= 2, r.err || JSON.stringify(r.rows));
r = await asRole('authenticated', own, `insert into storage.objects(bucket_id,name) values ('media','site/a.jpg')`);
ok('owner CAN upload to media', r.ok, r.err);
r = await asRole('authenticated', own, `select count(*)::int as n from storage.objects`);
ok('owner CAN list media', r.ok && r.rows[0].n >= 1, r.err);
// random logged-in user (not owner) cannot write
const OTHER = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into auth.users(id,email) values ('${OTHER}','other@example.com') on conflict do nothing`);
r = await asRole('authenticated', {sub: OTHER, role:'authenticated', aal:'aal1'}, `insert into public.site_content(key,value) values ('x','y')`);
ok('a signed-in NON-owner CANNOT write content', !r.ok, r.ok ? 'written!' : '');
// MFA enforcement
await db.exec(`update public.owners set require_mfa = true where user_id='${OWNER}'`);
r = await asRole('authenticated', own, `insert into public.site_content(key,value) values ('mfa.test','1')`);
ok('with require_mfa, aal1 session CANNOT write', !r.ok, r.ok ? 'written at aal1!' : '');
r = await asRole('authenticated', own2, `insert into public.site_content(key,value) values ('mfa.test','1')`);
ok('with require_mfa, aal2 session CAN write', r.ok, r.err);
r = await asRole('anon', anon, `select count(*)::int as n from public.site_content`);
ok('reads still work with require_mfa', r.ok, r.err);
// idempotent: run schema again
try { await db.exec(schema); ok('schema.sql is idempotent (second run)', true); } catch (e) { ok('schema.sql is idempotent (second run)', false, e.message); }
const failed = results.filter(x => !x.pass);
for (const x of results) console.log((x.pass ? 'PASS ' : 'FAIL ') + x.name + (x.pass ? '' : '  -> ' + x.extra));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
