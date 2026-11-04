# Paighaam-e-Tajushshariah — v2b (Version B)

Design-led preview of the Paighaam-e-Tajushshariah site, built as a gift for the site's owner.
Light palette (ivory, sage, gold), serif headings, Amiri / Nastaliq for Arabic and Urdu, bottom tab bar on phones, hidden owner panel.

**Status: DEMO MODE.** The site runs fully in the browser with demo data. Live data (owner login, saving, messages) needs a free Supabase project. The original site at paigam-e-tajushsharia.pages.dev is not changed.

## Owner setup, in 8 steps (Roman Hinglish)

1. supabase.com par free account banayein (email se).
2. "New project" banayein: naam "paighaam". Database password kahin safe likh lein. Region nearest chuein.
3. Project khulne par Settings → API kholen. "Project URL" aur "anon public" key copy karein. `service_role` key kabhi copy mat karein.
4. Authentication → Users → "Add user" se owner ka email aur password banayein. Password sirf owner ke paas rahega, Misbah ya Tab ke paas nahi.
5. SQL Editor → New query → `supabase/schema.sql` ka poora text paste karke Run karein. Error aaye to screenshot bhejein.
6. SQL Editor me ye line chalayein, OWNER_EMAIL ki jagah owner ka email likh kar: `insert into public.owners (user_id) select id from auth.users where email = 'OWNER_EMAIL';`
7. `assets/js/config.js` me `supabaseUrl` aur `supabaseAnonKey` paste karke GitHub par commit karein. Bas anon key, koi aur key nahi.
8. Telegram par messages chahiye to: BotFather se bot token lein, Supabase me function deploy karein (`supabase functions deploy forward-contact --no-verify-jwt`) aur secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` set karein. Ye optional hai.

Demo se live jaane ke baad site par "DEMO MODE" ki patti apne aap hat jati hai.

## Owner panel

Hidden URL: `#/tajush-desk` (site ke aakhir me copyright line par 3 baar tap karein, phir login). Login ke baad: Dashboard, Books, Paigham (30 din), Updates, Quiz & Leaderboard, Media & Gallery, Messages (read/unread + WhatsApp reply), Comments (approve/reject), Sections on/off, Texts & Sizes (pencil editor, text size sliders), Stats & Ta'awun, Settings.

## Files

- `index.html` — shell, bottom tab bar, drawer, settings sheet
- `assets/css/styles.css` — design system
- `assets/js/config.js` — the only file to edit for live mode
- `assets/js/books-data.js` — 372 books recovered from the original site's book list
- `assets/js/data.js` — data layer (demo localStorage or Supabase REST)
- `assets/js/app.js` — public pages, reveal and count-up animations, quiz, lightbox, pencil editor
- `assets/js/admin.js` — owner panel
- `supabase/schema.sql` — tables, row-level security, storage bucket
- `supabase/functions/forward-contact/index.ts` — optional Telegram forwarding
- `sw.js`, `manifest.webmanifest` — installable app and offline cache
- `docs/KNOWLEDGE.md` — how it works, what is placeholder, how to hand over

Hero photo: put the owner's photo at `assets/img/hero.jpg` (or upload it from the admin Media manager). Until then the ornament slot shows. Do not add images of people to religious content without the owner's approval.
