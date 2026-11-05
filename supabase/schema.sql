-- =====================================================================
-- Paighaam-e-Tajushshariah — REAL backend (Supabase / Postgres)
-- File: supabase/schema.sql   |   Idempotent: safe to run again.
-- Run once in: Supabase dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Security model (plain words):
--  * Only accounts listed in public.owners can WRITE anything (text, images, books, etc).
--  * If the owner turns on 2FA and sets owners.require_mfa = true, writes also need the
--    2FA step (aal2 session). See docs/OWNER-GUIDE.md.
--  * Visitors (anon) can READ published content, and can only INSERT a contact message
--    or a pending comment, or a push subscription — with length limits, a hidden honeypot
--    field, and a global hourly cap per table (a DB-side brake, not per-visitor).
--  * Quiz: visitors never read the answer key or the attempts table. They call the
--    quiz_submit() function, which checks the round window on the SERVER clock, scores
--    the answers itself, and allows ONE attempt per round per normalised phone number.
--  * Visitors can never read messages, quiz phone/address, push endpoints or pending comments.
-- =====================================================================

-- gen_random_uuid() is built into Postgres 13+ (no extension needed)

-- ---------- owners (the allowlist) ----------
create table if not exists public.owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  require_mfa boolean not null default false,
  created timestamptz default now()
);
alter table public.owners add column if not exists require_mfa boolean not null default false;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.owners o
    where o.user_id = auth.uid()
      and (not o.require_mfa or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  );
$$;

-- ---------- content tables ----------
create table if not exists public.site_content (
  key text primary key,                       -- e.g. 'home.hero.title'
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.content_history (
  id bigint generated always as identity primary key,
  key text not null,
  old_value text,                             -- null = there was no override (default was showing)
  new_value text,                             -- null = override removed
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.site_assets (
  key text primary key,                       -- 'logo', 'home.hero.image', ...
  url text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.site_settings (
  id text primary key,                        -- one row: 'site'
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.site_settings (id, value) values ('site', '{}'::jsonb) on conflict (id) do nothing;

create table if not exists public.books (
  id text primary key,
  cat text default 'Other',
  title_en text not null check (char_length(title_en) <= 200),
  title_ur text,
  writer_en text,
  writer_ur text,
  jild text,
  cover text,
  read text,
  featured boolean default false,
  sort int default 9999,
  created timestamptz default now()
);

create table if not exists public.paigam (
  id text primary key,                        -- the date itself, e.g. '2026-11-05'
  date date not null unique,
  text_ro text check (char_length(coalesce(text_ro,'')) <= 2000),
  text_ur text check (char_length(coalesce(text_ur,'')) <= 2000),
  source text,
  sample boolean default false,
  created timestamptz default now()
);

create table if not exists public.updates (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  title text not null check (char_length(title) <= 200),
  body text check (char_length(coalesce(body,'')) <= 2000),
  created timestamptz default now()
);

create table if not exists public.gallery (
  id text primary key,
  kind text check (kind in ('photo','video')),
  url text,
  youtube_id text,
  title text,
  tall boolean default false,
  created timestamptz default now()
);

create table if not exists public.messages (
  id text primary key default gen_random_uuid()::text,
  name text,
  email text,
  phone text,
  message text,
  read boolean default false,
  forwarded boolean default false,
  hp text,                                    -- honeypot: must stay empty
  created timestamptz default now()
);

create table if not exists public.comments (
  id text primary key default gen_random_uuid()::text,
  name text,
  message text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  hp text,                                    -- honeypot: must stay empty
  created timestamptz default now()
);

-- ---------- brakes on visitor inserts (global hourly caps) ----------
create or replace function public.brake(tbl text, max_per_hour int)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public.is_owner() then return; end if;
  execute format('select count(*) from public.%I where created > now() - interval ''1 hour''', tbl) into n;
  if n >= max_per_hour then
    raise exception 'Abhi bahut zyada entries aayi hain. Thodi der baad try karein.';
  end if;
end $$;

create or replace function public.brake_messages() returns trigger language plpgsql as $$
begin perform public.brake('messages', 100); return new; end $$;
create or replace function public.brake_comments() returns trigger language plpgsql as $$
begin perform public.brake('comments', 100); return new; end $$;

drop trigger if exists brake_messages_trg on public.messages;
create trigger brake_messages_trg before insert on public.messages for each row execute function public.brake_messages();
drop trigger if exists brake_comments_trg on public.comments;
create trigger brake_comments_trg before insert on public.comments for each row execute function public.brake_comments();

-- ---------- who-did-it stamps + undo history for content ----------
create or replace function public.stamp_content() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists stamp_content_trg on public.site_content;
create trigger stamp_content_trg before insert or update on public.site_content for each row execute function public.stamp_content();
drop trigger if exists stamp_assets_trg on public.site_assets;
create trigger stamp_assets_trg before insert or update on public.site_assets for each row execute function public.stamp_content();
drop trigger if exists stamp_settings_trg on public.site_settings;
create trigger stamp_settings_trg before insert or update on public.site_settings for each row execute function public.stamp_content();

create or replace function public.log_content() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.content_history(key, old_value, new_value, changed_by) values (old.key, old.value, null, auth.uid());
    return old;
  elsif tg_op = 'INSERT' then
    insert into public.content_history(key, old_value, new_value, changed_by) values (new.key, null, new.value, auth.uid());
    return new;
  elsif old.value is distinct from new.value then
    insert into public.content_history(key, old_value, new_value, changed_by) values (new.key, old.value, new.value, auth.uid());
    return new;
  end if;
  return new;
end $$;

drop trigger if exists log_content_trg on public.site_content;
create trigger log_content_trg after insert or update or delete on public.site_content for each row execute function public.log_content();

-- ---------- row-level security ----------
alter table public.owners enable row level security;
alter table public.site_content enable row level security;
alter table public.content_history enable row level security;
alter table public.site_assets enable row level security;
alter table public.site_settings enable row level security;
alter table public.books enable row level security;
alter table public.paigam enable row level security;
alter table public.updates enable row level security;
alter table public.gallery enable row level security;
alter table public.messages enable row level security;
alter table public.comments enable row level security;

drop policy if exists "owners: owner reads own row" on public.owners;
create policy "owners: owner reads own row" on public.owners for select using (user_id = auth.uid());

-- public READ + owner WRITE for published content
do $$
declare t text;
begin
  foreach t in array array['site_content','site_assets','site_settings','books','paigam','updates','gallery'] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
    execute format('drop policy if exists "owner writes" on public.%I', t);
    execute format('create policy "owner writes" on public.%I for all using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end $$;

-- content history: owner reads (for undo); nobody else
drop policy if exists "owner reads history" on public.content_history;
create policy "owner reads history" on public.content_history for select using (public.is_owner());
drop policy if exists "owner deletes history" on public.content_history;
create policy "owner deletes history" on public.content_history for delete using (public.is_owner());

-- contact messages: anyone sends (honeypot empty, read = false); only the owner reads/marks/deletes
drop policy if exists "anyone sends message" on public.messages;
create policy "anyone sends message" on public.messages for insert
  with check (char_length(coalesce(name,'')) between 1 and 80 and char_length(coalesce(message,'')) between 1 and 1200
          and char_length(coalesce(email,'')) <= 120 and char_length(coalesce(phone,'')) <= 20
          and (email is null or email = '' or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
          and read = false and forwarded = false and coalesce(hp,'') = '');
drop policy if exists "owner reads messages" on public.messages;
create policy "owner reads messages" on public.messages for select using (public.is_owner());
drop policy if exists "owner manages messages" on public.messages;
create policy "owner manages messages" on public.messages for update using (public.is_owner()) with check (public.is_owner());
drop policy if exists "owner deletes messages" on public.messages;
create policy "owner deletes messages" on public.messages for delete using (public.is_owner());

-- comments: anyone posts as PENDING (honeypot empty); public sees only approved; owner moderates
drop policy if exists "anyone posts comment" on public.comments;
create policy "anyone posts comment" on public.comments for insert
  with check (status = 'pending' and char_length(coalesce(name,'')) between 1 and 60
          and char_length(coalesce(message,'')) between 1 and 500 and coalesce(hp,'') = '');
drop policy if exists "public reads approved" on public.comments;
create policy "public reads approved" on public.comments for select using (status = 'approved' or public.is_owner());
drop policy if exists "owner moderates comments" on public.comments;
create policy "owner moderates comments" on public.comments for update using (public.is_owner()) with check (public.is_owner());
drop policy if exists "owner deletes comments" on public.comments;
create policy "owner deletes comments" on public.comments for delete using (public.is_owner());


-- ---------- media bucket: public read by URL, owner-only upload, size and type limits ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('media', 'media', true, 3145728, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update set public = excluded.public,
    file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- No listing for visitors: they can open a file by its public URL, but cannot list the bucket.
drop policy if exists "media public read" on storage.objects;
drop policy if exists "media owner read" on storage.objects;
create policy "media owner read" on storage.objects for select using (bucket_id = 'media' and public.is_owner());
drop policy if exists "media owner upload" on storage.objects;
create policy "media owner upload" on storage.objects for insert with check (bucket_id = 'media' and public.is_owner());
drop policy if exists "media owner update" on storage.objects;
create policy "media owner update" on storage.objects for update using (bucket_id = 'media' and public.is_owner());
drop policy if exists "media owner delete" on storage.objects;
create policy "media owner delete" on storage.objects for delete using (bucket_id = 'media' and public.is_owner());

-- =====================================================================
-- QUIZ PRO — rounds on a calendar, 4-option questions, answer key hidden,
-- one attempt per round per phone, server-side time window and scoring.
-- Pre-launch tables from the first real-mode draft are removed once (no live data).
-- =====================================================================
drop table if exists public.quiz_entries cascade;
drop table if exists public.quiz_questions cascade;
drop view if exists public.public_leaderboard;

-- Site settings helpers (values live in site_settings.value, one row 'site').
create or replace function public.setting_on(p_path text, p_default boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select (s.value #>> string_to_array(p_path, '.'))::boolean from public.site_settings s where s.id = 'site'),
    p_default);
$$;

create or replace function public.setting_int(p_key text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (s.value ->> p_key)::int from public.site_settings s where s.id = 'site'), p_default);
$$;

create table if not exists public.quiz_rounds (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  published boolean not null default false,        -- false = draft (nobody but the owner sees it)
  show_leaderboard boolean not null default true,
  created timestamptz default now(),
  check (ends_at > starts_at)
);

create table if not exists public.quiz_items (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.quiz_rounds(id) on delete cascade,
  sort int not null default 0,
  q text not null check (char_length(q) between 1 and 500),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  created timestamptz default now()
);

-- The ANSWER KEY. Owner only. Visitors get it only through quiz_reveal() after the round ends.
create table if not exists public.quiz_keys (
  item_id uuid primary key references public.quiz_items(id) on delete cascade,
  correct smallint not null check (correct between 0 and 3),
  explanation text check (char_length(coalesce(explanation, '')) <= 1000)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.quiz_rounds(id) on delete cascade,
  phone_norm text not null check (phone_norm ~ '^[0-9]{10}$'),
  name text not null check (char_length(name) between 2 and 80),
  address text not null check (char_length(address) between 5 and 300),
  answers smallint[] not null,
  score int not null check (score >= 0),
  total int not null check (total >= 0 and score <= total),
  city text check (char_length(coalesce(city, '')) <= 60),   -- optional; shown on the public board only if the owner allows
  winner boolean not null default false,                     -- owner marks winners
  pinned boolean not null default false,                     -- owner pins an entry to the top of the board
  hidden boolean not null default false,                     -- owner hides an entry from the public board
  submitted_at timestamptz not null default now(),
  unique (round_id, phone_norm)                     -- ONE attempt per round per phone number
);

create or replace function public.round_status(r public.quiz_rounds)
returns text language sql stable as $$
  select case when not r.published then 'draft'
              when now() < r.starts_at then 'scheduled'
              when now() < r.ends_at then 'live'
              else 'ended' end
$$;

-- Quiz state for every visitor: the SERVER clock (so the countdown cannot be cheated by a phone clock).
create or replace function public.quiz_state() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'server_now', now(),
    'enabled', public.setting_on('quiz_enabled', true),
    'leaderboard_public', public.setting_on('leaderboard_public', true),
    'leaderboard_live', public.setting_on('leaderboard_live', false),
    'leaderboard_top', public.setting_int('leaderboard_top', 10),
    'leaderboard_show_city', public.setting_on('leaderboard_show_city', false),
    'rounds', coalesce((
      select json_agg(json_build_object(
          'id', r.id, 'title', r.title, 'starts_at', r.starts_at, 'ends_at', r.ends_at,
          'status', public.round_status(r), 'show_leaderboard', r.show_leaderboard,
          'items', (select count(*) from public.quiz_items i where i.round_id = r.id))
        order by r.starts_at)
      from public.quiz_rounds r where r.published), '[]'::json));
$$;

-- Submit: the only way a visitor's answers are stored. Window, phone, answers and score are checked here.
-- Errors come back as short codes in the message: quiz_off, round_missing, not_open_yet, quiz_ended,
-- bad_name, bad_address, bad_phone, bad_answers, already_submitted, busy, bot.
drop function if exists public.quiz_submit(uuid, text, text, text, int[], text);
create or replace function public.quiz_submit(p_round uuid, p_name text, p_address text, p_phone text,
                                              p_answers int[], p_hp text default '', p_city text default '')
returns json language plpgsql security definer set search_path = public as $$
declare
  r public.quiz_rounds;
  v_name text; v_addr text; v_phone text; v_city text; n_items int; v_score int;
begin
  if coalesce(p_hp, '') <> '' then raise exception 'bot'; end if;
  if not public.setting_on('quiz_enabled', true) then raise exception 'quiz_off'; end if;
  select * into r from public.quiz_rounds where id = p_round;
  if not found or not r.published then raise exception 'round_missing'; end if;
  if now() < r.starts_at then raise exception 'not_open_yet'; end if;
  if now() >= r.ends_at then raise exception 'quiz_ended'; end if;

  v_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'bad_name'; end if;
  v_addr := trim(coalesce(p_address, ''));
  if char_length(v_addr) < 5 or char_length(v_addr) > 300 then raise exception 'bad_address'; end if;
  v_city := left(regexp_replace(trim(coalesce(p_city, '')), '\s+', ' ', 'g'), 60);

  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone) = 12 and left(v_phone, 2) = '91' then v_phone := substr(v_phone, 3); end if;
  if length(v_phone) = 11 and left(v_phone, 1) = '0' then v_phone := substr(v_phone, 2); end if;
  if length(v_phone) <> 10 then raise exception 'bad_phone'; end if;

  select count(*) into n_items from public.quiz_items where round_id = p_round;
  if n_items = 0 or p_answers is null or coalesce(array_length(p_answers, 1), 0) <> n_items then
    raise exception 'bad_answers';
  end if;
  if exists (select 1 from unnest(p_answers) a where a < 0 or a > 3) then raise exception 'bad_answers'; end if;

  if (select count(*) from public.quiz_attempts where submitted_at > now() - interval '1 hour') >= 5000 then
    raise exception 'busy';
  end if;
  if exists (select 1 from public.quiz_attempts where round_id = p_round and phone_norm = v_phone) then
    raise exception 'already_submitted';
  end if;

  select count(*) into v_score from (
    select row_number() over (order by i.sort, i.created, i.id) as n, k.correct
    from public.quiz_items i left join public.quiz_keys k on k.item_id = i.id
    where i.round_id = p_round) s
  where p_answers[s.n] = s.correct;

  begin
    insert into public.quiz_attempts(round_id, phone_norm, name, address, city, answers, score, total)
    values (p_round, v_phone, v_name, v_addr, nullif(v_city, ''), p_answers::smallint[], v_score, n_items);
  exception when unique_violation then
    raise exception 'already_submitted';
  end;
  return json_build_object('ok', true, 'score', v_score, 'total', n_items);
end $$;

-- Answers + explanations: only after the round has ended (or for the owner).
create or replace function public.quiz_reveal(p_round uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare r public.quiz_rounds;
begin
  select * into r from public.quiz_rounds where id = p_round;
  if not found or not r.published then raise exception 'round_missing'; end if;
  if not (public.is_owner() or now() >= r.ends_at) then raise exception 'not_ended'; end if;
  return json_build_object('round', r.title, 'items', coalesce((
    select json_agg(json_build_object('id', i.id, 'q', i.q, 'options', i.options,
                                      'correct', k.correct, 'explanation', k.explanation)
                    order by i.sort, i.created, i.id)
    from public.quiz_items i left join public.quiz_keys k on k.item_id = i.id
    where i.round_id = p_round), '[]'::json));
end $$;

-- Leaderboard: highest correct answers first (ties: earliest submit), pinned entries first.
-- Public = first name (+ city only if the owner allows). Never address or phone. Hidden entries are left out.
-- Visible after the round ends, or live when the owner switches leaderboard_live on.
create or replace function public.quiz_leaderboard(p_round uuid)
returns table (rank int, first_name text, city text, score int, total int, winner boolean, pinned boolean)
language plpgsql stable security definer set search_path = public as $$
declare r public.quiz_rounds; n int; v_show_city boolean; v_owner boolean;
begin
  select * into r from public.quiz_rounds where id = p_round;
  if not found or not r.published then return; end if;
  v_owner := public.is_owner();
  if not v_owner then
    if not r.show_leaderboard or not public.setting_on('leaderboard_public', true) then return; end if;
    if now() < r.ends_at and not public.setting_on('leaderboard_live', false) then return; end if;
  end if;
  n := public.setting_int('leaderboard_top', 10);
  v_show_city := public.setting_on('leaderboard_show_city', false);
  return query
    select x.rk, x.fname, x.cty, x.sc, x.tt, x.win, x.pin from (
      select row_number() over (order by a.pinned desc, a.score desc, a.submitted_at asc)::int as rk,
             split_part(a.name, ' ', 1) as fname,
             case when v_show_city then a.city else null end as cty,
             a.score as sc, a.total as tt, a.winner as win, a.pinned as pin
      from public.quiz_attempts a
      where a.round_id = p_round and (v_owner or not a.hidden)) x
    order by x.rk
    limit n;
end $$;

grant execute on function public.quiz_state() to anon, authenticated;
grant execute on function public.quiz_submit(uuid, text, text, text, int[], text, text) to anon, authenticated;
grant execute on function public.quiz_reveal(uuid) to anon, authenticated;
grant execute on function public.quiz_leaderboard(uuid) to anon, authenticated;

-- ---------- NOTIFICATIONS (bell for visitors; the owner writes them) ----------
-- A notification shows once publish_at has passed. Scheduled ones (quiz "soon", "started") are
-- rows whose publish_at is in the future, so no cron job is needed.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'custom' check (kind in ('custom', 'quiz', 'paigham', 'update', 'book')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(coalesce(body, '')) <= 1000),
  link text check (link is null or link = '' or link ~ '^(#/|https://)'),
  publish_at timestamptz not null default now(),
  source_key text unique,                           -- auto notifications: one row per event
  created timestamptz default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (char_length(endpoint) between 20 and 2000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created timestamptz default now()
);

create or replace function public.notify_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.setting_on('auto.update', true) then
    insert into public.notifications(kind, title, body, link, publish_at, source_key)
    values ('update', left('Naya update: ' || new.title, 200), left(coalesce(new.body, ''), 300), '#/updates', now(), 'update:' || new.id)
    on conflict (source_key) do update set title = excluded.title, body = excluded.body;
  end if;
  return new;
end $$;

create or replace function public.notify_book() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.setting_on('auto.book', false) then
    insert into public.notifications(kind, title, body, link, publish_at, source_key)
    values ('book', left('Nayi kitab: ' || new.title_en, 200), left(coalesce(new.writer_en, ''), 300), '#/library', now(), 'book:' || new.id)
    on conflict (source_key) do update set title = excluded.title, body = excluded.body;
  end if;
  return new;
end $$;

create or replace function public.notify_paigam() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.sample and public.setting_on('auto.paigam', false) then
    insert into public.notifications(kind, title, body, link, publish_at, source_key)
    values ('paigham', 'Aaj ka Paigham aa gaya', left(coalesce(new.text_ro, ''), 300), '#/paigham',
            (new.date::timestamp at time zone 'Asia/Kolkata'), 'paigam:' || new.date)
    on conflict (source_key) do update set body = excluded.body;
  end if;
  return new;
end $$;

create or replace function public.notify_round() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.published then
    delete from public.notifications where source_key like 'quiz:' || new.id::text || ':%';
    return new;
  end if;
  if public.setting_on('auto.quiz_scheduled', true) then
    insert into public.notifications(kind, title, body, link, publish_at, source_key)
    values ('quiz', left('Naya Taj Quiz: ' || new.title, 200),
            'Shuru: ' || to_char(new.starts_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || ' IST', '#/quiz', now(),
            'quiz:' || new.id::text || ':scheduled')
    on conflict (source_key) do update set title = excluded.title, body = excluded.body;
  end if;
  if public.setting_on('auto.quiz_soon', true) then
    insert into public.notifications(kind, title, body, link, publish_at, source_key)
    values ('quiz', left('Quiz thodi der me shuru: ' || new.title, 200), 'Round 10 minute me shuru hoga. Tayyar rahein.', '#/quiz',
            new.starts_at - interval '10 minutes', 'quiz:' || new.id::text || ':soon')
    on conflict (source_key) do update set title = excluded.title, publish_at = excluded.publish_at;
  end if;
  if public.setting_on('auto.quiz_started', true) then
    insert into public.notifications(kind, title, body, link, publish_at, source_key)
    values ('quiz', left('Quiz shuru ho gaya: ' || new.title, 200), 'Abhi jawab dein. Ek hi baar mauka hai.', '#/quiz',
            new.starts_at, 'quiz:' || new.id::text || ':started')
    on conflict (source_key) do update set title = excluded.title, publish_at = excluded.publish_at;
  end if;
  return new;
end $$;

drop trigger if exists notify_update_trg on public.updates;
create trigger notify_update_trg after insert on public.updates for each row execute function public.notify_update();
drop trigger if exists notify_book_trg on public.books;
create trigger notify_book_trg after insert on public.books for each row execute function public.notify_book();
drop trigger if exists notify_paigam_trg on public.paigam;
create trigger notify_paigam_trg after insert or update on public.paigam for each row execute function public.notify_paigam();
drop trigger if exists notify_round_trg on public.quiz_rounds;
create trigger notify_round_trg after insert or update on public.quiz_rounds for each row execute function public.notify_round();

create or replace function public.brake_push() returns trigger language plpgsql as $$
begin perform public.brake('push_subscriptions', 500); return new; end $$;
drop trigger if exists brake_push_trg on public.push_subscriptions;
create trigger brake_push_trg before insert on public.push_subscriptions for each row execute function public.brake_push();

-- ---------- row-level security for the quiz and notifications ----------
alter table public.quiz_rounds enable row level security;
alter table public.quiz_items enable row level security;
alter table public.quiz_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

-- Rounds: visitors see published rounds (draft = owner only); owner writes.
drop policy if exists "rounds public read" on public.quiz_rounds;
create policy "rounds public read" on public.quiz_rounds for select using (published or public.is_owner());
drop policy if exists "rounds owner writes" on public.quiz_rounds;
create policy "rounds owner writes" on public.quiz_rounds for all using (public.is_owner()) with check (public.is_owner());

-- Questions: visitors see them only once the round has started (never before). Owner writes.
drop policy if exists "items read when open" on public.quiz_items;
create policy "items read when open" on public.quiz_items for select using (
  public.is_owner() or exists (select 1 from public.quiz_rounds r
                               where r.id = quiz_items.round_id and r.published and now() >= r.starts_at));
drop policy if exists "items owner writes" on public.quiz_items;
create policy "items owner writes" on public.quiz_items for all using (public.is_owner()) with check (public.is_owner());

-- Answer key: owner only. No visitor policy exists, so visitors read nothing here.
drop policy if exists "keys owner only" on public.quiz_keys;
create policy "keys owner only" on public.quiz_keys for all using (public.is_owner()) with check (public.is_owner());

-- Attempts (names, addresses, phones): owner reads, marks winners, deletes. NO insert policy:
-- a visitor can only add one through quiz_submit().
drop policy if exists "attempts owner reads" on public.quiz_attempts;
create policy "attempts owner reads" on public.quiz_attempts for select using (public.is_owner());
drop policy if exists "attempts owner manages" on public.quiz_attempts;
create policy "attempts owner manages" on public.quiz_attempts for update using (public.is_owner()) with check (public.is_owner());
drop policy if exists "attempts owner deletes" on public.quiz_attempts;
create policy "attempts owner deletes" on public.quiz_attempts for delete using (public.is_owner());

-- Notifications: visitors read those whose time has come; owner writes all.
drop policy if exists "notes public read" on public.notifications;
create policy "notes public read" on public.notifications for select using (publish_at <= now() or public.is_owner());
drop policy if exists "notes owner writes" on public.notifications;
create policy "notes owner writes" on public.notifications for all using (public.is_owner()) with check (public.is_owner());

-- Push subscriptions: anyone may ADD one (shape-checked); nobody but the owner reads or deletes.
drop policy if exists "anyone subscribes push" on public.push_subscriptions;
create policy "anyone subscribes push" on public.push_subscriptions for insert with check (true);
drop policy if exists "owner reads push" on public.push_subscriptions;
create policy "owner reads push" on public.push_subscriptions for select using (public.is_owner());
drop policy if exists "owner deletes push" on public.push_subscriptions;
create policy "owner deletes push" on public.push_subscriptions for delete using (public.is_owner());

-- Defence in depth: table grants too (RLS is the real guard). Owner = authenticated + RLS owner policies.
revoke all on public.quiz_keys from anon;
revoke all on public.quiz_attempts from anon;
revoke insert on public.quiz_attempts from authenticated;
grant select on public.quiz_rounds, public.quiz_items to anon;
grant select, insert, update, delete on public.quiz_rounds, public.quiz_items, public.quiz_keys to authenticated;
grant select, update, delete on public.quiz_attempts to authenticated;
grant insert on public.push_subscriptions to anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant select on public.notifications to anon;
grant select, insert, update, delete on public.notifications to authenticated;
