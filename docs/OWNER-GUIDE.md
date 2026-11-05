# Owner guide — Paighaam-e-Tajushshariah (real mode)

Ye guide owner ke liye hai. Koi coding nahi karni padegi. Sab kuch site ke andar se hoga.

---

## 1. Pehli baar: live database setup (8 steps, ~20 minute)

Abhi site **demo mode** me hai: data sirf us phone/browser me save hota hai. Asli (sabko dikhne wala) save ke liye ye 8 steps karein.

1. **Free account:** supabase.com par email se account banayein. "New project" dabayein, naam `paighaam`. **Database password khud kahin safe likh lein** (kisi ko na bhejein, Tab ko bhi nahi).
2. **SQL chalayein:** project khulne par left menu me **SQL Editor → New query**. Repo ki file `supabase/schema.sql` ka poora text paste karein aur **Run** dabayein. Error aaye to screenshot bhejein. Dobara chalane se koi nuksan nahi hota. **Ek baar ka note:** ye file pehli baar chalane par purani (live se pehle ki) quiz tables `quiz_entries` aur `quiz_questions` hata deti hai. Agar aap ne in tables me koi asli data daala hai, to pehle Admin → Security se backup (JSON) download kar lein.
3. **Owner user banayein:** **Authentication → Users → Add user → Create new user**. Email (ye aapka ID hai) aur password (ye sirf aap jaanenge). "Auto Confirm User" ko tick karein.
4. **Owner ko allow karein:** SQL Editor me ye line chalayein, `APNA-EMAIL` ki jagah apna email likh kar:
   `insert into public.owners (user_id) select id from auth.users where email = 'APNA-EMAIL' on conflict do nothing;`
5. **Public sign-up band karein:** **Authentication → Providers → Email** me "Allow new users to sign up" ko OFF karein. Taaki koi bahar se account na bana sake.
6. **URL aur key config me daalein:** **Project Settings → API** se "Project URL" aur "anon public" key copy karein (service_role key kabhi nahi!). Phir GitHub repo me `assets/js/config.js` kholein, `supabaseUrl` aur `supabaseAnonKey` ki jagah paste karein, aur **Commit changes** dabayein. Ek minute me site live mode me aa jaati hai (demo ki patti hat jaati hai).
7. **2FA (authenticator) chalayein:** Supabase ki Authentication settings me Multi-Factor (TOTP) on karein. Phir site ke **Admin panel → Security → "2FA chalu karein"**, QR apne Google Authenticator / Microsoft Authenticator se scan karein, app ka 6-digit code daal kar "Chalu karein" dabayein. Phir SQL Editor me (APNA-EMAIL badal kar): `update public.owners set require_mfa = true where user_id = (select id from auth.users where email = 'APNA-EMAIL');` — ab har login par code maangega.
8. **Test karein:** apne computer ke terminal me (Node 18+ ho to): `SUPABASE_URL=https://APNA-PROJECT.supabase.co SUPABASE_ANON_KEY=APNI-ANON-KEY node supabase/policy-test.mjs` — sab lines **PASS** honi chahiye. Phir site kholiye, footer ki copyright line par 3 baar jaldi tap karein, login karein, aur ek text badal kar dekhein ki site par dikhta hai. Policy test ek message "POLICY-TEST" chhod sakta hai: Admin → Messages me use delete kar dein.

Agar kisi step par atak jayein to wahi step ka screenshot bhejein.

---

## 2. Visual edit mode (pencil se edit)

1. Admin panel me login karein (site ke sabse neeche copyright line par 3 baar tap).
2. **Dashboard → "Site kholo"** dabayein. Site khulegi, har text ke upar gold **pencil** dikhega.
3. Pencil par tap karein, text badlein, **Save** dabayein. Ye turant sabko dikhega.
4. Link badalna ho to usi pencil box me "Link" wala khana bhi dikhega.
5. Ghalti ho gayi? **History** tab me jaayein, wahan badlav ki list hai. **Undo** dabayein, purana text wapas.

Photos: **Images** tab me "Change photo" dabayein, phone se photo chunein. Site photo ko chhota (compress) aur sahi size me crop karke laga degi. Bade photo ki limit 15 MB.

---

## 3. Admin panel me kya kahan hai

- **Dashboard:** kitni kitabein, naye messages, comments approval ke liye, aaj ke quiz.
- **Texts:** site ke har text ki list (search kar sakte hain). Save, aur "Default par wapas".
- **Images:** logo aur hero photo.
- **Books:** kitab add, edit, delete, ↑ ↓ se order. Cover photo ya link. Read link https:// se shuru hona chahiye.
- **Paigham:** 30 din ka Aaj ka Paigham, date wise. Raat 12 baje (IST) se apne aap next din ka text aata hai. Asli Quran/Hadees ka text aap khud likhein; hum kuch nahi likhte.
- **Updates:** timeline me naye updates.
- **Quiz:** quiz chalu/band ka switch, calendar (month, din par tap karke round add/edit), list, sawal (har sawal ke 4 option aur ek sahi jawab), jawab (naam, address, phone sirf aap dekh sakte hain), winner, pin, hide, CSV download. Detail neeche section 8.
- **Alerts:** bell ke notifications: kaun se event par apne aap notification bane (on/off), naya notification likhna (abhi ya schedule), WhatsApp par share button, phone push. Detail neeche section 9.
- **Media:** YouTube link paste karein (title apne aap aata hai), gallery photos.
- **Messages:** "Read" dabayein. "WhatsApp reply" button se seedha reply karein.
- **Comments:** Approve / Reject / Delete. Approve kiya comment hi public dikhta hai.
- **Sections:** har section ko on/off karein. Band karne par wo site se turant hat jaata hai.
- **Look & stats:** accent rang (light palette se), text size, animation (Full / Light / Off), stats numbers, Ta'awun progress, follow links, quiz rules.
- **History:** har badlav ki list, Undo ke saath.
- **Security:** 2FA, backup download, logout.

Login 30 minute tak kuch na karne par apne aap band ho jaata hai.

---

## 4. Ta'awun aur donation

Is site par koi payment ya bank/UPI detail nahi hai. Ta'awun ka progress bar sirf number dikhata hai, aap khud update karte hain (Look & stats → Ta'awun). Bank details ka text aap khud likh sakte hain, par wo owner ki zimmedari hai.

---

## 5. Hand over: site ko owner ko dena (Misbah se real owner ko)

Ye steps tab karein jab site ka asli malik (owner) taiyar ho.

1. **Owner ko Supabase me user banayein:** Authentication → Users → Add user (owner ka email aur password). SQL me: `insert into public.owners (user_id) select id from auth.users where email = 'OWNER-EMAIL' on conflict do nothing;` aur 2FA ke baad `require_mfa = true`.
2. **Misbah ka access hatayein:** SQL me: `delete from public.owners where user_id = (select id from auth.users where email = 'MISBAH-EMAIL');` Phir Authentication → Users me Misbah ka user delete karein (ya password reset karke band karein).
3. **Project owner ko dein:** Supabase: Project Settings → General me "Transfer project" (agar ye option dikhe, owner ki organisation me), ya owner apna naya project banaye aur 1-5 steps dobara chalaye. Backup JSON (neeche) se content wapas aa jayega.
4. **GitHub repo owner ko dein:** GitHub me repo → Settings → Transfer ownership, owner ka username daalein. Pages settings wahan dobara check karein.
5. **Config:** `assets/js/config.js` me sirf URL aur anon key hai. Koi secret key nahi. Transfer ke baad URL same rahega.
6. Owner ek baar login karke Security tab me apna 2FA chalu karein.

---

## 6. Backup aur export

- **Admin → Security → "Backup (JSON) download":** sab content (kitabein, paigham, updates, quiz sawal, gallery, settings, texts) ek JSON file me. Mahine me ek baar download karke safe rakhein.
- **Photos:** Supabase me Storage → media bucket se photos download kar sakte hain (JSON me sirf unke links hain).
- **Messages aur quiz entries:** Supabase Table Editor se CSV export ho sakti hai (sirf project owner ke liye).
- Free Supabase plan par automatic backup nahi hota, isliye ye manual backup zaroori hai.

---

## 7. Agar kuch gadbad ho

- **Login nahi ho raha:** password reset: Supabase → Authentication → Users → user par right click → "Send password recovery", ya Users me password change karein.
- **Code nahi aa raha (2FA):** Authenticator app me time sahi hona chahiye (phone ka automatic time on karein). Agar phone kho gaya: Supabase → Authentication → Users → user → MFA factors delete karein, phir Security tab se dobara enrol karein.
- **Site demo dikha rahi hai:** config.js me URL/key khali hain. Step 6 dobara karein.
- **"Ijazat nahi" error:** owner row check karein: SQL Editor me `select * from public.owners;` (aapka user_id dikhna chahiye).
- **Visitors ko purana text dikh raha:** browser me page refresh karein. Site offline ho to pichhla saved content dikhta hai.

Koi bhi error ka exact message (copy karke) bhejein, wahi kaam aata hai.

---

## 8. Quiz kaise chalega (owner ke liye)

**Switch:** Admin → Quiz → "Quiz chalu hai?" Haan/Nahi. Nahi karne par visitors ko "Quiz abhi band hai" dikhta hai aur koi jawab nahi liya jata (ye server bhi rokta hai, sirf screen nahi).

**Round banana:**
1. Admin → Quiz → Calendar me jis din quiz hai uspar tap karein → "+ Is din naya round". Ya "+ Naya round".
2. **Naam** (round ka title), **Shuru** aur **Khatam** (IST me). Khatam, shuru ke baad ka hona chahiye.
3. **Sawal:** har sawal ka text, **4 option** (A, B, C, D), aur **radio se ek sahi jawab**. Explanation optional hai (round khatam hone ke baad dikhta hai).
4. **Publish karein** tick karein tab visitors ko dikhega. Bina tick ke ye draft hai (sirf aap dekhte hain).
5. Save. Status apne aap badalta hai: **scheduled → live → ended**.

**Visitor ko kya dikhta hai:**
- Shuru se pehle: "Quiz shuru hone me" + bada clock (din : ghante : minute : second).
- Round ke beech: "Quiz khatam hone me" + sawal + form. Sahi jawab chhupe rehte hain.
- Jawab jama hone ke baad: "Aapka jawab jama ho gaya" + ghumti hui clock (agle round ya result ka time).
- Round khatam hone ke baad: sahi jawab, explanation, aur leaderboard (agar aap ne allow kiya ho).

**Time server ki ghadi se chalta hai.** Visitor ke phone ka time badalne se quiz nahi badalta.

**Ek jawab, ek baar:** ek round me ek mobile number se sirf ek jawab. Dubara bharne par server mana karta hai.

**Honest limit (zaroor padhein):** ek number par rok sakte hain, par koi bhi doosra number daal kar dobara bhar sakta hai. Ye bina login ke 100% nahi rukta. Agar aap aur sakhti chahte hain to baad me OTP (SMS code) laga sakte hain — Supabase me phone login. Abhi ke liye ye "ek number, ek baar" hai.

**Naam, address, mobile:** sirf quiz ke liye liye jate hain. Sirf aap (admin) dekh sakte hain. Visitor ko sirf pehla naam (aur shehar, agar aap ne allow kiya) leaderboard par dikhta hai. Aap kisi bhi entry ko "Entry hatayein" se delete kar sakte hain. Form ke neeche privacy note bhi dikhta hai.

**Leaderboard:**
- Sabse zyada sahi jawab wale upar. Barabar ho to jisne pehle jawab diya wo upar.
- Admin → Quiz → Board: public on/off, "round ke beech bhi" (live) on/off, shehar dikhayein on/off, kitne log dikhein (5 / 10 / 20).
- Kisi entry ko **Pin** karke upar rakh sakte hain, **Board se chhupayein** se public board se hata sakte hain.
- **Winner banayein** se winner ka badge lagta hai.
- **Board reset** winner/pin/hide hatata hai (jawab nahi). **Sab jawab hatayein** poora round ka data delete karta hai (wapas nahi aata).

**Sawal badalna:** jis round par jawab aa chuke hain, uske sawal lock ho jaate hain (score galat na ho). Title aur time badal sakte hain.

**CSV:** Admin → Quiz → round → "CSV download": naam, address, phone, shehar, score, winner. Excel me khul jata hai.

**Sample sawal:** shuruaat me jo sawal hain unpar "SAMPLE — owner to replace" likha hai. Inhe apne asli sawal se badal dein. Hadees ya Quran ka text hum nahi likhte.

---

## 9. Notifications (bell aur phone alert)

**Bell (bina kisi setup ke):** site ke upar bell icon hai. Naya notification aaye to number (badge) dikhta hai. Ye sab visitors ko dikhta hai.

**Kaun se event par apne aap notification bane:** Admin → Alerts me har event ka On/Off:
- naya quiz round scheduled
- quiz 10 minute me shuru (soon)
- quiz shuru ho gaya (started)
- naya update
- Aaj ka Paigham (default Off)
- nayi kitab (default Off)

**Khud notification bhejein:** Admin → Alerts me title, body, kahan le jaaye (home, quiz, paigham...). "Abhi" ya time choose karein (IST). Schedule karne par wo time aane par hi dikhta hai.

**WhatsApp:** WhatsApp par apne aap message jaane ki suvidha nahi hai (ye WhatsApp ki rule hai). Har notification aur quiz ke saath **"WhatsApp par share"** button hai: dabane par WhatsApp khulta hai, aap group/contact chun kar bhej dein.

**Phone alert (Web Push) — optional, zaroori nahi:**
- Ye sirf **live setup** ke baad chalega (demo mode me nahi).
- Android aur computer browser par chalta hai.
- **iPhone par sirf tab:** jab site Safari me **"Home Screen par Add"** karke app ki tarah khuli ho (iOS 16.4 ya naya).
- **Ye abhi real phones aur push service par test nahi hua.** Pehle ek apne phone par try karke dekhein.
- Setup: (a) VAPID key pair banayein (koi bhi VAPID generator, ya Node me `npx web-push generate-vapid-keys`). (b) **Public** key `assets/js/config.js` me `vapidPublicKey` me daalein. (c) **Private** key aur service role key sirf Supabase ke Edge Function secrets me (kabhi code/chat me nahi). (d) `supabase/functions/send-push` Edge Function deploy karein (`supabase functions deploy send-push`). (e) Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:aapka email), ALLOWED_ORIGIN (aapki site ka https address).
- Visitor "Phone par alert chahiye" dabayein → permission → subscription `push_subscriptions` me save hota hai. Aap Alerts me notification ke saath "Phone push" dabayein.
- Jo phone alert band kar de, uska subscription sender khud hata deta hai.

