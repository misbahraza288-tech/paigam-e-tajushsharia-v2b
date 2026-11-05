
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
await db.exec(`insert into public.comments(id,name,message,status) values ('c-pending','Pend','waiting','pending'),('c-ok','Ok','visible','approved')`);
r = await asRole('anon', anon, `select * from public.messages`);
ok('anon CANNOT read messages', r.ok && r.rows.length === 0, r.err || r.rows.length);
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

// ================= QUIZ PRO =================
// rounds: LIVE (started 1h ago, ends in 1h), SCHED (starts tomorrow), ENDED (ended yesterday), DRAFT (unpublished)
await db.exec(`reset role`);
await db.exec(`insert into public.quiz_rounds(id,title,starts_at,ends_at,published) values
  ('00000000-0000-0000-0000-00000000a001','Live round', now()-interval '1 hour', now()+interval '1 hour', true),
  ('00000000-0000-0000-0000-00000000a002','Scheduled round', now()+interval '1 day', now()+interval '2 days', true),
  ('00000000-0000-0000-0000-00000000a003','Ended round', now()-interval '2 days', now()-interval '1 day', true),
  ('00000000-0000-0000-0000-00000000a004','Draft round', now()-interval '1 hour', now()+interval '1 hour', false)`);
await db.exec(`insert into public.quiz_items(id,round_id,sort,q,options) values
  ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-00000000a001',1,'Live Q1',' ["A","B","C","D"]'::jsonb),
  ('00000000-0000-0000-0000-00000000b002','00000000-0000-0000-0000-00000000a001',2,'Live Q2','["A","B","C","D"]'::jsonb),
  ('00000000-0000-0000-0000-00000000b003','00000000-0000-0000-0000-00000000a002',1,'Sched Q1','["A","B","C","D"]'::jsonb),
  ('00000000-0000-0000-0000-00000000b004','00000000-0000-0000-0000-00000000a003',1,'Ended Q1','["A","B","C","D"]'::jsonb),
  ('00000000-0000-0000-0000-00000000b005','00000000-0000-0000-0000-00000000a004',1,'Draft Q1','["A","B","C","D"]'::jsonb)`);
await db.exec(`insert into public.quiz_keys(item_id,correct,explanation) values
  ('00000000-0000-0000-0000-00000000b001',1,'Live explanation'),('00000000-0000-0000-0000-00000000b002',2,null),
  ('00000000-0000-0000-0000-00000000b003',0,null),('00000000-0000-0000-0000-00000000b004',3,'Ended explanation'),
  ('00000000-0000-0000-0000-00000000b005',0,null)`);
await db.exec(`insert into public.quiz_attempts(round_id,phone_norm,name,address,answers,score,total) values
  ('00000000-0000-0000-0000-00000000a003','9000000001','Ali Khan','Govindpur Dhanbad',array[3]::smallint[],1,1)`);
const LIVE_R='00000000-0000-0000-0000-00000000a001', SCH_R='00000000-0000-0000-0000-00000000a002', END_R='00000000-0000-0000-0000-00000000a003', DRF_R='00000000-0000-0000-0000-00000000a004';
r = await asRole('anon', anon, `select id from public.quiz_rounds`);
ok('anon sees published rounds only (3, not the draft)', r.ok && r.rows.length === 3, r.err || r.rows.length);
r = await asRole('anon', anon, `select id from public.quiz_rounds where id='${DRF_R}'`);
ok('anon CANNOT see a draft round', r.ok && r.rows.length === 0, r.err || r.rows.length);
r = await asRole('anon', anon, `select id from public.quiz_items where round_id='${SCH_R}'`);
ok('anon sees NO questions before the round starts', r.ok && r.rows.length === 0, r.err || r.rows.length);
r = await asRole('anon', anon, `select id from public.quiz_items where round_id='${LIVE_R}'`);
ok('anon sees questions once the round is live', r.ok && r.rows.length === 2, r.err || r.rows.length);
r = await asRole('anon', anon, `select * from public.quiz_keys`);
ok('anon CANNOT read the answer key (quiz_keys)', !r.ok || r.rows.length === 0, r.err || r.rows.length);
r = await asRole('anon', anon, `select * from public.quiz_attempts`);
ok('anon CANNOT read attempts (names, addresses)', !r.ok || r.rows.length === 0, r.err || r.rows.length);
r = await asRole('anon', anon, `insert into public.quiz_attempts(round_id,phone_norm,name,address,answers,score,total) values ('${LIVE_R}','9111111111','Cheat','Some address 1',array[1,2]::smallint[],2,2)`);
ok('anon CANNOT insert an attempt directly (must use quiz_submit)', !r.ok, r.ok ? 'inserted!' : '');
r = await asRole('anon', anon, `update public.quiz_attempts set score=99`);
ok('anon CANNOT change a score', (r.ok && r.affected === 0) || !r.ok, r.err || r.affected);
r = await asRole('anon', anon, `select quiz_reveal('${LIVE_R}') as j`);
ok('anon CANNOT see answers of a live round (quiz_reveal refuses)', !r.ok && /not_ended/.test(r.err), r.err || 'answers returned!');
r = await asRole('anon', anon, `select quiz_reveal('${END_R}') as j`);
ok('anon CAN see answers after the round ended', r.ok && /Ended explanation/.test(JSON.stringify(r.rows[0].j)), r.err || 'no answers');
r = await asRole('anon', anon, `select quiz_submit('${SCH_R}','Ali Khan','Govindpur Dhanbad','9000000002','{0}'::int[]) as j`);
ok('quiz refuses submit BEFORE start (server clock)', !r.ok && /not_open_yet/.test(r.err), r.err || 'accepted!');
r = await asRole('anon', anon, `select quiz_submit('${END_R}','Ali Khan','Govindpur Dhanbad','9000000002','{0}'::int[]) as j`);
ok('quiz refuses submit AFTER end', !r.ok && /quiz_ended/.test(r.err), r.err || 'accepted!');
r = await asRole('anon', anon, `select quiz_submit('${DRF_R}','Ali Khan','Govindpur Dhanbad','9000000002','{0}'::int[]) as j`);
ok('quiz refuses a draft round', !r.ok && /round_missing/.test(r.err), r.err || 'accepted!');
r = await asRole('anon', anon, `select quiz_submit('${LIVE_R}','Ali Khan','Govindpur Dhanbad','9000000002','{1}'::int[]) as j`);
ok('quiz refuses wrong number of answers', !r.ok && /bad_answers/.test(r.err), r.err || 'accepted!');
r = await asRole('anon', anon, `select quiz_submit('${LIVE_R}','Ali Khan','Govindpur Dhanbad','9000000002','{1,7}'::int[]) as j`);
ok('quiz refuses an answer outside 0..3', !r.ok && /bad_answers/.test(r.err), r.err || 'accepted!');
r = await asRole('anon', anon, `select quiz_submit('${LIVE_R}','Ali Khan','Govindpur Dhanbad','12345','{1,2}'::int[]) as j`);
ok('quiz refuses a short phone', !r.ok && /bad_phone/.test(r.err), r.err || 'accepted!');
r = await asRole('anon', anon, `select quiz_submit('${LIVE_R}','Ali Khan','Govindpur Dhanbad','9000000002','{1,2}'::int[],'bot') as j`);
ok('quiz honeypot refused', !r.ok && /bot/.test(r.err), r.err || 'accepted!');
r = await asRole('anon', anon, `select quiz_submit('${LIVE_R}','Ali Khan','Govindpur Dhanbad','+91 98765-43210','{1,0}'::int[],'','Patna') as j`);
ok('anon CAN submit once in the live window; score computed on the server (1 of 2)', r.ok && /"score" ?: ?1/.test(JSON.stringify(r.rows[0].j)) && /"total" ?: ?2/.test(JSON.stringify(r.rows[0].j)), r.err || JSON.stringify(r.rows));
r = await asRole('anon', anon, `select quiz_submit('${LIVE_R}','Ali Again','Govindpur Dhanbad','098765 43210','{1,2}'::int[]) as j`);
ok('SECOND attempt with the same phone (other spacing) is refused', !r.ok && /already_submitted/.test(r.err), r.err || 'accepted twice!');
await db.exec(`reset role`);
r = await db.query(`select count(*)::int as n from public.quiz_attempts where round_id='${LIVE_R}' and phone_norm='9800000000' or (round_id='${LIVE_R}')`);
ok('exactly one attempt stored for that round (the first phone only)', r.rows[0].n === 1, JSON.stringify(r.rows));
r = await asRole('anon', anon, `select quiz_leaderboard('${LIVE_R}') as x`);
ok('leaderboard hidden while the round is still live', r.ok && r.rows.length === 0, r.err || r.rows.length);
r = await asRole('anon', anon, `select * from public.quiz_leaderboard('${END_R}')`);
ok('leaderboard after end: first name only, no phone/address columns', r.ok && r.rows.length === 1 && r.rows[0].first_name === 'Ali' && !('address' in r.rows[0]) && !('phone_norm' in r.rows[0]), r.err || JSON.stringify(r.rows));
// ranking: owner adds 4 more on the ENDED round (scores 3,3,2 + one hidden 3); board must rank by score, tie by earliest, pinned first, hidden out
await db.exec(`insert into public.quiz_attempts(round_id,phone_norm,name,address,city,answers,score,total,submitted_at) values
  ('${END_R}','9000000011','Bilal Ahmad','Address line one','Dhanbad',array[0]::smallint[],3,3,now()-interval '1 hour'),
  ('${END_R}','9000000012','Sara Khan','Address line two','Govindpur',array[0]::smallint[],3,3,now()-interval '2 hours'),
  ('${END_R}','9000000013','Zed Low','Address line three','Dhanbad',array[0]::smallint[],2,3,now()-interval '3 hours'),
  ('${END_R}','9000000014','Hidden Person','Address line four','X',array[0]::smallint[],3,3,now()-interval '4 hours')`);
await db.exec(`update public.quiz_attempts set hidden=true where phone_norm='9000000014'`);
await db.exec(`update public.quiz_attempts set pinned=true where phone_norm='9000000013'`);
r = await asRole('anon', anon, `select * from public.quiz_leaderboard('${END_R}')`);
ok('board: pinned entry first, then highest score, tie -> earliest submit', r.ok && r.rows[0].first_name === 'Zed' && r.rows[1].first_name === 'Sara' && r.rows[2].first_name === 'Bilal' && r.rows[3].first_name === 'Ali', r.err || JSON.stringify(r.rows.map(x=>x.first_name)));
ok('hidden entry is left out of the public board', r.ok && !r.rows.some(x => x.first_name === 'Hidden'), 'hidden shown');
ok('ranks are 1..n', r.ok && r.rows.map(x => x.rank).join(',') === '1,2,3,4', r.err || JSON.stringify(r.rows.map(x=>x.rank)));
ok('city NOT shown while the owner keeps it off', r.ok && r.rows.every(x => x.city === null), JSON.stringify(r.rows.map(x=>x.city)));
await db.exec(`update site_settings set value = value || '{"leaderboard_top": 2, "leaderboard_show_city": true}'::jsonb where id='site'`);
r = await asRole('anon', anon, `select * from public.quiz_leaderboard('${END_R}')`);
ok('owner Top-N setting limits the board (2)', r.ok && r.rows.length === 2, r.err || r.rows.length);
ok('city shown when the owner turns it on', r.ok && r.rows[0].city === 'Dhanbad', r.err || JSON.stringify(r.rows));
ok('public board never has address or phone columns', r.ok && r.rows.every(x => !('address' in x) && !('phone_norm' in x) && !('phone' in x)), 'leak');
await db.exec(`update site_settings set value = value || '{"leaderboard_top": 10, "leaderboard_show_city": false}'::jsonb where id='site'`);
r = await asRole('anon', anon, `select * from public.quiz_leaderboard('${LIVE_R}')`);
ok('live board hidden while the owner keeps live OFF', r.ok && r.rows.length === 0, r.err || r.rows.length);
await db.exec(`update site_settings set value = value || '{"leaderboard_live": true}'::jsonb where id='site'`);
r = await asRole('anon', anon, `select * from public.quiz_leaderboard('${LIVE_R}')`);
ok('live board visible when the owner switches live ON', r.ok && r.rows.length >= 1, r.err || r.rows.length);
await db.exec(`update site_settings set value = value || '{"leaderboard_live": false}'::jsonb where id='site'`);
await db.exec(`update site_settings set value = value || '{"leaderboard_public": false}'::jsonb where id='site'`);
r = await asRole('anon', anon, `select * from public.quiz_leaderboard('${END_R}')`);
ok('board OFF (owner switch) hides it from visitors', r.ok && r.rows.length === 0, r.err || r.rows.length);
await db.exec(`update site_settings set value = value || '{"leaderboard_public": true}'::jsonb where id='site'`);
r = await asRole('anon', anon, `select quiz_state() as s`);
ok('quiz_state returns the server time and rounds (no answers)', r.ok && /server_now/.test(JSON.stringify(r.rows[0].s)) && !/correct/.test(JSON.stringify(r.rows[0].s)), r.err || 'missing');
r = await asRole('anon', anon, `insert into public.quiz_rounds(title,starts_at,ends_at,published) values ('Hack', now(), now()+interval '1 hour', true)`);
ok('anon CANNOT create a quiz round', !r.ok, r.ok ? 'created!' : '');
r = await asRole('anon', anon, `insert into public.notifications(title) values ('Fake notice')`);
ok('anon CANNOT write a notification', !r.ok, r.ok ? 'written!' : '');
r = await asRole('anon', anon, `select title from public.notifications`);
ok('anon sees only notifications whose time has come (scheduled "soon" hidden)', r.ok && r.rows.every(x => x.title !== 'Quiz thodi der me shuru: Scheduled round') && r.rows.some(x => /Naya Taj Quiz/.test(x.title)), r.err || JSON.stringify(r.rows));
r = await asRole('anon', anon, `insert into public.push_subscriptions(endpoint,p256dh,auth) values ('https://push.example.com/abc123456789','BNcRdreALRFXTkOOUHK5E','tBHItJI5svbpez7KI4CCXg')`);
ok('anon CAN add a push subscription', r.ok, r.err);
r = await asRole('anon', anon, `insert into public.push_subscriptions(endpoint,p256dh,auth) values ('http://not-https.example.com/abc123456789','BNcRdreALRFXTkOOUHK5E','tBHItJI5svbpez7KI4CCXg')`);
ok('push endpoint must be https', !r.ok, r.ok ? 'accepted!' : '');
r = await asRole('anon', anon, `select * from public.push_subscriptions`);
ok('anon CANNOT read push subscriptions', r.ok && r.rows.length === 0, r.err || r.rows.length);
r = await asRole('authenticated', { sub: '22222222-2222-2222-2222-222222222222', role: 'authenticated', aal: 'aal2' }, `select * from public.quiz_keys`);
ok('a signed-in NON-owner CANNOT read the answer key', r.ok && r.rows.length === 0, r.err || r.rows.length);
r = await asRole('authenticated', { sub: '22222222-2222-2222-2222-222222222222', role: 'authenticated', aal: 'aal2' }, `select * from public.quiz_attempts`);
ok('a signed-in NON-owner CANNOT read attempts', r.ok && r.rows.length === 0, r.err || r.rows.length);
r = await asRole('authenticated', own2, `select count(*)::int as n from public.quiz_keys`);
ok('owner CAN read the answer key', r.ok && r.rows[0].n === 5, r.err || JSON.stringify(r.rows));
r = await asRole('authenticated', own2, `select count(*)::int as n from public.quiz_attempts`);
ok('owner CAN read attempts', r.ok && r.rows[0].n >= 1, r.err || JSON.stringify(r.rows));
r = await asRole('authenticated', own2, `update public.quiz_attempts set winner=true where round_id='${END_R}' and phone_norm='9000000011'`);
ok('owner CAN mark winners', r.ok && r.affected === 1, r.err || r.affected);
r = await asRole('authenticated', own2, `select * from public.quiz_leaderboard('${LIVE_R}')`);
ok('owner sees the live leaderboard (owner view)', r.ok && r.rows.length >= 1, r.err || r.rows.length);
r = await asRole('authenticated', own2, `insert into public.quiz_rounds(title,starts_at,ends_at,published) values ('Owner new', now()+interval '3 days', now()+interval '3 days 1 hour', false)`);
ok('owner CAN create a round', r.ok, r.err);
await db.exec(`update public.site_settings set value = value || '{"quiz_enabled": false}'::jsonb where id='site'`);
r = await asRole('anon', anon, `select quiz_submit('${LIVE_R}','Ali Khan','Govindpur Dhanbad','9000000003','{1,2}'::int[]) as j`);
ok('quiz OFF (owner switch) refuses submits even in the window', !r.ok && /quiz_off/.test(r.err), r.err || 'accepted!');
await db.exec(`update public.site_settings set value = value || '{"quiz_enabled": true}'::jsonb where id='site'`);
await db.exec(`reset role`);
await db.exec(`update public.quiz_rounds set published=false where id='${LIVE_R}'`);
r = await asRole('anon', anon, `select id from public.notifications where source_key like 'quiz:${LIVE_R}:%'`);
ok('un-publishing a round removes its auto notifications', r.ok && r.rows.length === 0, r.err || r.rows.length);
await db.exec(`update public.quiz_rounds set published=true where id='${LIVE_R}'`);

const failed = results.filter(x => !x.pass);
for (const x of results) console.log((x.pass ? 'PASS ' : 'FAIL ') + x.name + (x.pass ? '' : '  -> ' + x.extra));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
