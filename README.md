# Paighaam-e-Tajushshariah — Version B (real mode, with Quiz PRO)

Ek saaf, halka (light) aur sukoon wali site: Taj Library, Aaj ka Paigham, Updates, Taj Quiz, Media, Tawwun, Contact, aur ek owner panel. Sab text, photo, kitab, quiz aur notifications owner admin se badal sakta hai.

- **Demo mode** (config.js me URL/key khali): sab kuch is browser me chalta hai. Login demo / demo. Sirf dikhane ke liye; data sabko nahi dikhta.
- **Live mode** (config.js me Supabase URL + anon key): data database me, owner login + 2FA, row-level security.

## Docs (sabse pehle)
- `docs/OWNER-GUIDE.md` — owner ke liye (Roman Hinglish): database setup (8 steps), edit mode, admin panels, **Quiz** (section 8), **Notifications** (section 9), handover, backup.
- `docs/DOMAIN-GUIDE.md` — .in domain ko GitHub Pages par lagana, DNS records, Supabase URL settings, handover note. Abhi CNAME file nahi hai (naam aane par).
- `docs/KNOWLEDGE.md` — developer note: kaise kaam karta hai, security, tests, kya test nahi hua.

## What is in the repo
- `index.html`, `sw.js` (offline cache + optional Web Push handlers), `manifest.webmanifest`
- `assets/js/config.js` — the only file the owner edits to go live (URL, anon key, optional VAPID public key)
- `assets/js/data.js` — one data layer: demo (localStorage) and live (Supabase REST + RPC), clock, quiz calls
- `assets/js/app.js` — public site; `assets/js/quiz.js` — public quiz (countdown, questions, one attempt, result, board); `assets/js/notify.js` — bell
- `assets/js/admin.js` + `assets/js/quiz-admin.js` — owner panels (quiz switch, calendar, rounds, answers, CSV, alerts)
- `supabase/schema.sql` — the whole backend (idempotent): content, owners, RLS, quiz rounds/questions/answer key/attempts with server-side scoring and time rules, notifications, push subscriptions
- `supabase/policy-test.mjs` — run against a real project with the PUBLIC anon key: checks what a visitor can and cannot do
- `supabase/functions/send-push/index.ts` — optional Web Push sender (owner deploys; NOT tested against real push services)

## Tests (site served on 127.0.0.1:8765, e.g. `python3 -m http.server 8765`)
```
node tests/smoke-demo.mjs        # demo mode, phone 390x844, headless Chromium: 112 checks (quiz, admin, XSS probes, bell)
node tests/live-mock.mjs         # live wiring against a mock backend: 30 checks
cd tests/sql && npm i && node rls-test.mjs ../../supabase/schema.sql setup.sql   # Postgres (PGlite) RLS + quiz rules: 90 checks
node supabase/policy-test.mjs https://PROJECT.supabase.co ANON_KEY              # the real project (run once it exists)
```

## Honest limits
- Real project not yet created by the owner: LIVE mode is not tested against a real Supabase project. The policy test is written but has not been run against one.
- Quiz one-attempt is per phone number typed. Without login, someone can use another number. OTP can be added later.
- Web Push: written, not tested on real phones or push services. iPhone works only after "Add to Home Screen".
- No WhatsApp auto-messages (not possible); the admin has a "WhatsApp par share" link.
- Legal pages, quiz questions, paigham and updates texts are samples or drafts, marked for the owner to replace.
- Hadees, Quran and fatwa text is not written here; the owner adds it.
