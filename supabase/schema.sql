-- =====================================================================
-- Paighaam-e-Tajushshariah — REAL backend (Supabase / Postgres)
-- File: supabase/schema.sql   |   Idempotent: safe to run again.
-- Run once in: Supabase dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Security model (plain words):
--  * Only accounts listed in public.owners can WRITE anything (text, images, books, etc).
--  * If the owner turns on 2FA and sets owners.require_mfa = true, writes also need the
--    2FA step (aal2 session). See docs/OWNER-GUIDE.md.
--  * Visitors (anon) can READ published content, and can only INSERT a contact message,
--    a quiz entry or a pending comment — with length limits, a hidden honeypot field,
--    and a global hourly cap per table (a DB-side brake, not per-visitor).
--  * Visitors can never read messages, quiz phone/address, or pending comments.
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

create table if not exists public.quiz_questions (
  id text primary key,
  date date not null,
  q text not null check (char_length(q) <= 500),
  options jsonb not null,
  answer int not null,
  created timestamptz default now()
);

create table if not exists public.quiz_entries (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  first_name text,
  full_name text,
  phone text,
  address text,
  score int,
  total int,
  hp text,                                    -- honeypot: must stay empty
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

-- Leaderboard: only first name + score (no phone, no address). Readable by everyone.
create or replace view public.public_leaderboard as
  select id, date, first_name, score from public.quiz_entries;

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
create or replace function public.brake_quiz() returns trigger language plpgsql as $$
begin perform public.brake('quiz_entries', 300); return new; end $$;

drop trigger if exists brake_messages_trg on public.messages;
create trigger brake_messages_trg before insert on public.messages for each row execute function public.brake_messages();
drop trigger if exists brake_comments_trg on public.comments;
create trigger brake_comments_trg before insert on public.comments for each row execute function public.brake_comments();
drop trigger if exists brake_quiz_trg on public.quiz_entries;
create trigger brake_quiz_trg before insert on public.quiz_entries for each row execute function public.brake_quiz();

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
alter table public.quiz_questions enable row level security;
alter table public.quiz_entries enable row level security;
alter table public.gallery enable row level security;
alter table public.messages enable row level security;
alter table public.comments enable row level security;

drop policy if exists "owners: owner reads own row" on public.owners;
create policy "owners: owner reads own row" on public.owners for select using (user_id = auth.uid());

-- public READ + owner WRITE for published content
do $$
declare t text;
begin
  foreach t in array array['site_content','site_assets','site_settings','books','paigam','updates','quiz_questions','gallery'] loop
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

-- quiz entries: anyone enters (short fields, honeypot empty); only the owner reads them
drop policy if exists "anyone enters quiz" on public.quiz_entries;
create policy "anyone enters quiz" on public.quiz_entries for insert
  with check (char_length(coalesce(first_name,'')) between 1 and 60
          and char_length(coalesce(phone,'')) between 5 and 20 and phone ~ '^[0-9+ ()-]+$'
          and char_length(coalesce(address,'')) <= 160 and char_length(coalesce(full_name,'')) <= 80
          and score >= 0 and total >= 0 and score <= total and coalesce(hp,'') = '');
drop policy if exists "owner reads entries" on public.quiz_entries;
create policy "owner reads entries" on public.quiz_entries for select using (public.is_owner());
drop policy if exists "owner manages entries" on public.quiz_entries;
create policy "owner manages entries" on public.quiz_entries for update using (public.is_owner()) with check (public.is_owner());
drop policy if exists "owner deletes entries" on public.quiz_entries;
create policy "owner deletes entries" on public.quiz_entries for delete using (public.is_owner());

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

grant select on public.public_leaderboard to anon, authenticated;

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
