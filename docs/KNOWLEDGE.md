# Knowledge note — how Version B works (for the next person who touches it)

## Modes
- `config.js` empty URL/key → DEMO (localStorage in the visitor's browser; demo login demo/demo; banner shown).
- URL + anon key → LIVE (Supabase REST and Auth). No demo banner, no demo login, no demo data.
- The browser only ever holds the **anon (public) key**. Never put a service_role key in the repo, the site or a chat.

## Content model
- Every visible text has a stable key (`hero.title`, `explore.library.body`, …). The default is in the page code and in `assets/data/content-seed.json`.
- `site_content` (key, value, updated_at, updated_by) holds the owner's overrides. A key with no row shows its default.
- Link targets are stored at `<key>.url` (for example `hero.learn.url`) and only https, http, mailto, tel, `#/…` and `assets/…` are ever used as an href.
- `site_assets` holds image URLs by slot (`logo`, `home.hero.image`). Files live in the `media` Storage bucket (public read by URL, owner-only upload, 3 MB and jpeg/png/webp limits).
- `site_settings` (one row, `id = 'site'`) holds sections on/off, accent (curated light palette), animations (full/light/off), stats, Ta'awun, social links, quiz rules, text sizes.
- `content_history` is written by a trigger on every change (old value, new value, who, when). Undo writes the old value back as a new change.

## Who can write
- `owners` is the allow-list. `is_owner()` is true when `auth.uid()` is listed (and, with `require_mfa = true`, only in an aal2 session, i.e. after the 2FA code).
- Visitors (anon): read published content; INSERT one contact message, one quiz entry or one pending comment. Checks: lengths, email shape, phone digits, score ≤ total, honeypot column empty, and a global hourly brake per table (100 messages, 100 comments, 300 quiz entries).
- Visitors cannot read messages, quiz entries (phone, address), pending comments, the change history, the owners list, or list the media bucket.
- The client inserts with `Prefer: return=minimal` and sends its own id. A visitor cannot read back what it wrote, so a RETURNING clause would be refused.

## Auth and session
- Owner ID = email. Password set by the owner in Supabase (or in its user screen). Nobody else sees it; no hash or password is in the code.
- Login: `/auth/v1/token?grant_type=password`. If the user has a verified TOTP factor, the code step runs: challenge, then verify, which returns an aal2 token.
- Tokens live in sessionStorage only and are never logged. Refresh happens before expiry. The panel logs out after 30 minutes without a tap or key press.
- 2FA enrolment (admin → Security): `POST /auth/v1/factors` returns the QR; verify with a code. Then `update public.owners set require_mfa = true …` (SQL, once).

## Offline and failures
- Public reads are cached in localStorage (`taj-cache-v2-*`). If the backend is unreachable, the last good content is shown. The site never shows a blank page because of the network.
- Service worker: network first for same-origin files (so a new config.js reaches visitors at once); the cache is only used when offline. Supabase is never cached.

## Security headers and output
- CSP meta (script-src 'self' only; no inline event handlers; connect-src limited to Supabase and noembed for YouTube titles; frame-src YouTube and Drive). Note: `frame-ancestors` is not honoured in a meta tag; set it as a response header on the host if the owner wants it.
- All user-supplied text is escaped before it goes into HTML. Injected HTML probes (img onerror, script, svg onload) are tested in `tests/smoke-demo.mjs`.

## Tests and what they cover
- `tests/sql/rls-test.mjs` runs the real `schema.sql` on Postgres (PGlite) with small stubs for Supabase's `auth` and `storage` schemas: 49 checks of anon vs owner vs other user vs MFA. Stubs are not Supabase itself.
- `supabase/policy-test.mjs` checks a REAL project over HTTP with the anon key. It writes one "POLICY-TEST" message. Run it after setup.
- `tests/live-mock.mjs` drives the live client against a mock backend (not Supabase): reads, anon insert, login, MFA, owner token on writes, undo, upload, offline cache.
- `tests/smoke-demo.mjs` drives demo mode at 390x844 through every panel and public page (78 checks).

## Not tested here
- A real Supabase project (none exists yet). Real MFA apps, real e-mail flows, real Storage size limits (enforced by Storage, not the database), real CDN caching.

## Handover
See docs/OWNER-GUIDE.md section 5. Summary: new owner user + owners row; remove the old owner; transfer the GitHub repo and (if wanted) the Supabase project; the config holds only the URL and anon key, so nothing secret moves.

## Changing the hidden route
`adminRoute` in `assets/js/config.js`. Changing it does not change the security; it only changes what a visitor would have to guess.
