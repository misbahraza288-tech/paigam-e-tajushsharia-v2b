# Custom domain (.in) — owner ke liye guide

Ye guide owner ke liye hai (Roman Hinglish). Domain ka naam abhi tay nahi hai, isliye neeche jahan `yourdomain.in` likha hai wahan apna domain likh lein.

> **TEMPLATE STEP (abhi CNAME file mat banayein):** domain ka naam confirm hone ke baad hi repo ke root par `CNAME` file banayein. Us file me sirf ek line hogi: `yourdomain.in` (bina http, bina slash). Jab tak naam nahi aata, ye file repo me nahi hai — ye jaan-bujh kar hai.

---

## 1. Pehle ye cheez taiyar rakhein

- Domain ka **DNS panel** kholne ka login (jahan domain kharida: GoDaddy, BigRock, Hostinger, Namecheap, etc.).
- Apna **GitHub** login (jis account par ye repo hai).
- Apna **Supabase** login (database wala).
- Ek kaam ek baar me: pehle GitHub Pages, phir DNS, phir Supabase.

## 2. GitHub Pages par domain jodein

1. GitHub par repo kholein → **Settings → Pages**.
2. **Custom domain** ke box me `yourdomain.in` likhein (www wala nahi, seedha naam) → **Save**.
3. GitHub ek **DNS check** chalata hai. Pehle warning aayegi ("DNS check unsuccessful") — ye normal hai jab tak DNS na lagaya ho.
4. Repo ke root par `CNAME` file apne aap ban jati hai jab aap ye Save karte hain. Agar nahi bani, to upar wala TEMPLATE step dekhein.
5. DNS lagne ke baad **Enforce HTTPS** ka box tick karein (kuch minute se kuch ghante lag sakte hain; tab tak wo grey rahega).

## 3. DNS records (domain ke panel me)

Domain provider ke DNS page par ye records daalein. Pehle se koi purana A record `@` ke liye ho to use hata dein.

| Type | Name (Host) | Value | Kya karta hai |
|---|---|---|---|
| A | `@` (ya blank) | `185.199.108.153` | apex (`yourdomain.in`) |
| A | `@` | `185.199.109.153` | apex (dusra) |
| A | `@` | `185.199.110.153` | apex (teesra) |
| A | `@` | `185.199.111.153` | apex (chautha) |
| CNAME | `www` | `GITHUB-USERNAME.github.io` | `www.yourdomain.in` |

- `GITHUB-USERNAME` wo GitHub username hai jis account par repo hai (abhi: `misbahraza288-tech`; owner ka account ho to uska username).
- IP list GitHub ke official docs se li gayi hai. Lagane se pehle GitHub Pages docs me current list ek baar dekh lein.
- Agar aap IPv6 bhi chahte hain to AAAA records GitHub docs me diye hain (optional).

## 4. Check karein (wait ke baad)

- **Wait time:** aam taur par 10 minute se 1 ghanta; kabhi 24–48 ghante bhi (DNS duniya me phailne me).
- Computer ke terminal me: `dig +short yourdomain.in` → upar wale IP dikhne chahiye. `dig +short www.yourdomain.in` → `GITHUB-USERNAME.github.io` ke aas-paas wala jawab.
- Browser me `https://yourdomain.in` kholein. Lock ka nishaan dikhna chahiye.
- Ye sab chal jaye tab hi **Enforce HTTPS** tick karein.

## 5. Supabase me naya address batayein

Ye zaroori hai taaki login aur kuch links naye domain par chalein:

1. Supabase → **Authentication → URL Configuration**.
   - **Site URL:** `https://yourdomain.in`
   - **Redirect URLs:** `https://yourdomain.in/*` add karein (purana GitHub Pages wala link bhi rakh sakte hain).
2. **CORS:** Supabase ki REST API me site ke liye CORS ki alag setting nahi chahiye (owner ka anon key hi browser me jata hai). Lekin **Edge Function** (`send-push`) ke secret `ALLOWED_ORIGIN` ko naye address par badal dein: `https://yourdomain.in`. (Supabase → Edge Functions → Secrets.)
3. `assets/js/config.js` me kuch badalna nahi hai — Supabase ka URL wahi rahega.

## 6. Ek zaroori baat

- Naya domain naya "address" hai. Phone par purana cache alag hota hai, to pehli baar naya link kholne par thoda time lag sakta hai.
- Purana GitHub Pages link band nahi hota. Dono chal sakte hain.
- Domain ka renewal (har saal) domain provider par hota hai. Expire ho gaya to site domain par nahi khulegi. Calendar me reminder laga dein.

---

## 7. Handover note: kiske account me kya rahe

Ye site owner ki hai. Misbah ne setup kiya; aage ki malikiyat owner ke paas honi chahiye.

| Cheez | Kiske naam par | Kya karna hai |
|---|---|---|
| Domain (`yourdomain.in`) | **Owner ke** registrar account par | Registrar par owner ka email/phone; Misbah ka access nahi |
| GitHub repo | **Owner ke** GitHub account par | Repo ko transfer karein (GitHub → Settings → Danger zone → Transfer ownership) ya owner naya repo banaye |
| GitHub Pages | Repo ke saath | Custom domain wahi rahega |
| Supabase project | **Owner ke** Supabase account par | Owner ka account banayein, project transfer karein ya owner ko Owner role de dein |
| Owner ka login (email + password + 2FA) | **Owner** ke paas | Password Tab/Misbah ko na bhejein |
| Edge Function secrets (service role, VAPID private key) | **Owner ke** Supabase project me | Kisi chat/file me na likhein |

Handover ke baad:
1. Owner ke account par repo, Supabase project aur domain aa gaye ya nahi, check karein.
2. Misbah ko GitHub collaborator aur Supabase project se **remove** karein.
3. Owner ka 2FA on karein (OWNER-GUIDE step 7).

---

## 8. Agar kuch na chale

- **"DNS check unsuccessful"** → A records ya CNAME galat hain. `dig` se check karein.
- **"Domain is already taken"** → kisi aur GitHub account par ye domain pehle se lagaa hai. GitHub → Settings → Pages me domain verification karein.
- **HTTPS option grey hai** → wait karein; DNS ke baad certificate banne me kuch ghante lag sakte hain.
- **Site purana address dikhati hai** → browser cache; hard reload karein ya private window me kholein.
