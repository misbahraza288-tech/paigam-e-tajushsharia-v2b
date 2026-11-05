# Paighaam-e-Tajushshariah — Version B (real mode)

Design-led site for Paighaam-e-Tajushshariah: light palette (ivory, sage, gold), serif headings, Amiri / Nastaliq for Arabic and Urdu, bottom tab bar on phones, a gentle motion layer, and a hidden owner panel where every text, photo, book, section and setting is changed from one place.

- **Demo mode** (default, `assets/js/config.js` has no URL/key): everything lives in the visitor's browser. Owner login is `demo` / `demo`. A banner says DEMO MODE.
- **Live mode** (URL + anon key in `config.js`): content lives in the owner's own Supabase project. Visitors read published content. Only the signed-in owner (email + password, plus a 2FA code when enabled) can write. No demo banner, no demo login.

The owner's step list is in **docs/OWNER-GUIDE.md** (Roman Hinglish). Technical notes are in **docs/KNOWLEDGE.md**.

## What is in the repo

- `index.html` — shell, Content-Security-Policy, skeleton loader
- `assets/css/styles.css`, `assets/css/motion.css` — design and motion (transform/opacity only; `prefers-reduced-motion` and the owner's Full / Light / Off setting respected)
- `assets/js/config.js` — the only file the owner edits to go live
- `assets/js/data.js` — data layer: demo storage or Supabase REST + Auth, cached fallback, undo history, 2FA
- `assets/js/app.js` — public site, pencil edit mode, quiz, gallery, contact and comments
- `assets/js/admin.js` — owner panel (login, 2FA, all panels, 30-minute idle logout)
- `assets/js/books-data.js` — 372 books recovered from the original site's list
- `assets/data/content-seed.json` — default text of every editable key (the owner's texts override these)
- `supabase/schema.sql` — tables, history, row-level security, storage rules (idempotent)
- `supabase/policy-test.mjs` — checks a REAL project's permissions with the public anon key only
- `supabase/functions/forward-contact/index.ts` — optional Telegram forwarding (secret in Supabase, never in the site)
- `tests/` — demo smoke test, live-mode test against a mock backend, the phone-size recording script, and the SQL row-level-security test (`tests/sql/`)
- `sw.js`, `manifest.webmanifest` — installable app; network first, cache only when offline

## Tests (run from the repo root, with the site served on 127.0.0.1:8765)

```
python3 -m http.server 8765 --bind 127.0.0.1 &
node tests/smoke-demo.mjs          # demo mode, 390x844: every page, admin panel, edit, undo, uploads, XSS probes, idle logout
node tests/live-mock.mjs           # live mode against a mock backend: REST calls, owner token, 2FA, undo, offline cache
node tests/record-animations.mjs   # phone-size recording of the motion layer
node tests/sql/rls-test.mjs supabase/schema.sql tests/sql/setup.sql   # row-level security on Postgres (needs: npm i @electric-sql/pglite)
SUPABASE_URL=https://PROJECT.supabase.co SUPABASE_ANON_KEY=ANON node supabase/policy-test.mjs   # the REAL project (anon key only)
```

Playwright (`playwright-core`) and a Chromium binary are needed for the browser tests; paths can be set with `PW=` and `CHROME=`.

## Honest limits

- The hidden route (`#/o7f3k2m9qx`, set in `config.js`) and the 3-tap footer are obscurity only. The real protection is the login, the owner allow-list, row-level security and 2FA.
- Visitors' quiz answers are readable in the page (the quiz runs in the browser); phone numbers and addresses are not.
- Visitor writes (contact, comments, quiz) are limited by length checks, a hidden honeypot field and a global hourly cap per table. That cap is a brake for floods, not a per-person limit.
- Push notifications and WhatsApp auto-messages are not possible on the free setup; the admin has a WhatsApp reply button per message.
