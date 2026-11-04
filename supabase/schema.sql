-- Paighaam-e-Tajushshariah v2b — Supabase schema + row-level security (run once, in the SQL Editor)
-- Only the owner (a row in public.owners) can write. The public can read the site, send a
-- contact message, enter the quiz and post a pending comment. Nobody public can read messages,
-- quiz phone/address, or pending comments.

create extension if not exists pgcrypto;

create table if not exists public.owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.owners where user_id = auth.uid());
$$;

create table if not exists public.books (
  id text primary key,
  cat text default 'Other',
  title_en text not null,
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
  id text primary key,                 -- the date itself, e.g. '2026-11-05'
  date date not null unique,
  text_ro text,
  text_ur text,
  source text,
  sample boolean default false,
  created timestamptz default now()
);

create table if not exists public.updates (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  title text not null,
  body text,
  created timestamptz default now()
);

create table if not exists public.quiz_questions (
  id text primary key,
  date date not null,
  q text not null,
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
  created timestamptz default now()
);

create table if not exists public.comments (
  id text primary key default gen_random_uuid()::text,
  name text,
  message text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created timestamptz default now()
);

create table if not exists public.site_settings (
  id text primary key,
  value jsonb not null default '{}'::jsonb
);

-- Leaderboard: only first name + score, never phone or address.
create or replace view public.public_leaderboard as
  select id, date, first_name, score from public.quiz_entries;

-- ---------- row-level security ----------
alter table public.owners enable row level security;
alter table public.books enable row level security;
alter table public.paigam enable row level security;
alter table public.updates enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_entries enable row level security;
alter table public.gallery enable row level security;
alter table public.messages enable row level security;
alter table public.comments enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "owners: owner reads own row" on public.owners;
create policy "owners: owner reads own row" on public.owners for select using (user_id = auth.uid());

-- public read + owner write
do $$
declare t text;
begin
  foreach t in array array['books','paigam','updates','quiz_questions','gallery','site_settings'] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
    execute format('drop policy if exists "owner writes" on public.%I', t);
    execute format('create policy "owner writes" on public.%I for all using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end $$;

-- quiz entries: anyone may enter (short fields only); only the owner reads them
drop policy if exists "anyone enters quiz" on public.quiz_entries;
create policy "anyone enters quiz" on public.quiz_entries for insert
  with check (char_length(coalesce(first_name,'')) <= 60 and char_length(coalesce(phone,'')) between 5 and 20
              and char_length(coalesce(address,'')) <= 160 and score >= 0);
drop policy if exists "owner reads entries" on public.quiz_entries;
create policy "owner reads entries" on public.quiz_entries for select using (public.is_owner());
drop policy if exists "owner manages entries" on public.quiz_entries;
create policy "owner manages entries" on public.quiz_entries for update using (public.is_owner()) with check (public.is_owner());
drop policy if exists "owner deletes entries" on public.quiz_entries;
create policy "owner deletes entries" on public.quiz_entries for delete using (public.is_owner());

-- contact messages: anyone sends; only the owner reads / marks read / deletes
drop policy if exists "anyone sends message" on public.messages;
create policy "anyone sends message" on public.messages for insert
  with check (char_length(coalesce(name,'')) between 1 and 80 and char_length(coalesce(message,'')) between 1 and 1200
              and char_length(coalesce(email,'')) <= 120 and char_length(coalesce(phone,'')) <= 20 and read = false and forwarded = false);
drop policy if exists "owner reads messages" on public.messages;
create policy "owner reads messages" on public.messages for select using (public.is_owner());
drop policy if exists "owner manages messages" on public.messages;
create policy "owner manages messages" on public.messages for update using (public.is_owner()) with check (public.is_owner());
drop policy if exists "owner deletes messages" on public.messages;
create policy "owner deletes messages" on public.messages for delete using (public.is_owner());

-- comments: anyone posts as PENDING; public sees only approved; owner moderates
drop policy if exists "anyone posts comment" on public.comments;
create policy "anyone posts comment" on public.comments for insert
  with check (status = 'pending' and char_length(coalesce(name,'')) between 1 and 60 and char_length(coalesce(message,'')) between 1 and 500);
drop policy if exists "public reads approved" on public.comments;
create policy "public reads approved" on public.comments for select using (status = 'approved' or public.is_owner());
drop policy if exists "owner moderates comments" on public.comments;
create policy "owner moderates comments" on public.comments for update using (public.is_owner()) with check (public.is_owner());
drop policy if exists "owner deletes comments" on public.comments;
create policy "owner deletes comments" on public.comments for delete using (public.is_owner());

-- leaderboard view: readable by everyone (it has only id, date, first_name, score)
grant select on public.public_leaderboard to anon, authenticated;

-- media bucket for photos (public read, owner upload)
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media owner upload" on storage.objects;
create policy "media owner upload" on storage.objects for insert with check (bucket_id = 'media' and public.is_owner());
drop policy if exists "media owner update" on storage.objects;
create policy "media owner update" on storage.objects for update using (bucket_id = 'media' and public.is_owner());
drop policy if exists "media owner delete" on storage.objects;
create policy "media owner delete" on storage.objects for delete using (bucket_id = 'media' and public.is_owner());

-- Seed: the site settings row the app reads (edit later from the admin panel)
insert into public.site_settings (id, value) values ('site', '{}'::jsonb) on conflict (id) do nothing;
