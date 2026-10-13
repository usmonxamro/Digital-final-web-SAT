# Cloudflare qo'shish (DDoS / bot himoyasi) — qadamlar

Sayt kodi Cloudflare orqasida ishlashga tayyor: `lib/rate-limit.ts` mehmonning haqiqiy IP manzilini
`cf-connecting-ip` sarlavhasidan oladi (login / ro'yxatdan o'tish limitlari to'g'ri ishlaydi).
Cloudflare'ni o'zi esa kod bilan emas, domen sozlamalarida yoqiladi:

1. https://dash.cloudflare.com → **Add a site** → domeningizni kiriting (bepul "Free" tarif yetadi).
2. Cloudflare bergan 2 ta **nameserver**ni domen sotib olgan joyingizda (registrar) almashtiring.
3. **DNS** bo'limida saytga olib boradigan yozuv (Vercel uchun: `CNAME  @/www → cname.vercel-dns.com`)
   yonidagi bulut belgisini **Proxied (to'q sariq)** qiling.
4. **SSL/TLS → Overview → Full (strict)**.
5. **Security → Settings**: Security Level = *Medium*, **Bot Fight Mode = On**.
6. **Security → WAF → Rate limiting rules** (bepul tarifda 1 ta qoida):
   `URI Path` *starts with* `/api/auth/` → 10 so'rov / 10 soniya / bir IP → *Block 10 daqiqa*.
7. **Security → WAF → Custom rules**: admin yo'lingizni (`ADMIN_PATH`) faqat o'zingiz ishlatadigan
   mamlakat/IP uchun ochish mumkin (ixtiyoriy).
8. **Caching → Configuration**: *Browser Cache TTL* = Respect Existing Headers. `/api/*` keshlanmasin
   (Cache Rule: URI Path starts with `/api/` → Bypass cache).
9. Vercel'da: **Settings → Domains** ga domenni qo'shing. Agar Cloudflare "Proxied" bo'lsa Vercel
   "Invalid configuration" ko'rsatishi mumkin — SSL Full (strict) bo'lsa bu normal va ishlaydi.

Google orqali kirish uchun redirect manzili: `https://SAYT.uz/api/auth/google/callback`
(Google Cloud Console → Credentials → OAuth client → *Authorized redirect URIs*).
