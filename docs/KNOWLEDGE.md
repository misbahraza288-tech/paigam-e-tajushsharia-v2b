# Knowledge note — Paighaam-e-Tajushshariah v2b

## What is real and what is placeholder
- **Recovered from the live site (2026-11-04):** all 372 book entries (Urdu and Roman titles, writers, jild, category as the original lists them, cover image links and the Google Drive read links). The Tawwun welfare trust's name and address. The section headings "Hamari Khidmat", "Muslim Bachhiyon ke liye School", "Deeni Library Bareilly me", "Taj Quiz", "Tawwun Page", and the four Ta'awun categories (Zakaat, Sadqah, Atiyat, Qurbani). The "Should Read" list (6 of the original's 7 slider books matched in the catalogue).
- **Placeholder, marked on the page or in the admin:** Aaj ka Paigham text (every entry is "SAMPLE — owner to replace"); updates; history timeline; quiz questions (marked SAMPLE); About/Mission text (DRAFT); legal pages (DRAFT); Ta'awun goal and amount; gallery photo slots; hero photo; featured video; footer social links (empty until the owner adds them).
- **Not recovered:** the original quiz questions (they lived in the old site's database, which was not exported), the original paigam texts, the original photos, the original admin login. Nothing from the original's database or keys is copied into this site.
- **Original claims, unverified:** the stats (1000+ resources, 50K+ readers, 700+ quiz questions, 24/7 access) come from the original site's own numbers. The owner checks and edits them in Stats.

## How it works
- No build step. Plain HTML, CSS and JavaScript. Routes are hash links (`#/library`, `#/book/12`, `#/quiz`).
- **Demo mode** (config keys empty): the data lives in the browser's localStorage. Owner login is user `demo`, password `demo`. Banner: "DEMO MODE — not secure".
- **Live mode** (config keys set): the same screens read and write Supabase tables through its REST API. Writes need the owner's session. Row-level security in `supabase/schema.sql` lets the public only read the site, send a message, enter the quiz and post a pending comment.
- **Date-keyed Paigham:** each entry has its date. The home page shows today's date's entry in Asia/Kolkata time, so it changes at midnight IST without a cron job. Entries for the next 30 days are set in admin.
- **Quiz:** questions are keyed by date. Name, phone and address are stored privately and only the owner sees them. The leaderboard shows first name and score only.
- **Comments and "Share Your Thoughts":** go to a queue. Comments stay pending until the owner approves them. Honeypot field and a per-browser rate limit are in place.
- **Offline:** the service worker caches the app shell. The last Paigham is kept on the phone for offline reading.
- **Listen:** the browser's own voice reads the Paigham text. It is not a Quran recitation.
- **Share to WhatsApp Status:** makes a quote poster image and opens the share sheet (or downloads it and opens WhatsApp).
- **Pencil editor:** when the owner is logged in, "Visual editor" shows a pencil on the real page text and links. Saved text is kept in site settings.

## Known limits (be honest with the owner)
- **Push notifications** are not built. They need a push server and VAPID keys, which are not part of the free static site. Instead, new updates show a pulsing dot for 3 days.
- **WhatsApp auto-forwarding** of messages is not possible without the WhatsApp Business API. Instead the owner gets a Telegram message (optional) and a "Reply on WhatsApp" button on each message in the admin.
- **Quiz answers are visible to anyone who reads the page source.** That suits a community quiz, not an exam. A stricter version needs grading on the server.
- **YouTube and Google Drive** embeds depend on those sites. Some Drive files cannot be embedded; the page always shows an "open in a new tab" link.
- **Photo uploads** are compressed in the browser (about 1200 px wide, JPEG) before they go to storage.
- **Cover images** of the books are hot-linked from the original site's image host. If the owner moves the covers, update them in admin.

## Handing over to the owner
1. The owner creates the Supabase project and owner account (README, steps 1–6).
2. Paste the URL and anon key into `assets/js/config.js` (step 7). The owner or Misbah commits it on GitHub Pages.
3. Log in through the hidden panel with the owner's own email. Change the stats, the Ta'awun numbers, the Paigham texts and the quiz questions from admin.
4. Replace the SAMPLE texts and DRAFT pages. Add the hero photo. Add the social links.
5. Turn off any section that is not needed from Sections.

## Switching demo mode off
Paste the Supabase keys into `assets/js/config.js` and run the schema. Nothing else changes. To clear demo data on this phone, use Settings in admin (demo only).
