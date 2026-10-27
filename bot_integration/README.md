# Telegram bot ↔ sayt: kurs guruhlari

## Tayyor fayl
`bot_updated.py` — sizning botingizning TO'LIQ yangilangan nusxasi (3750 qator + kurs kodi tizimi).
Eski `bot.py` o'rniga qo'ying (bazani `sat_system.db` o'zgartirmang — yangi jadvallar o'zi yaratiladi).
Qo'shilganlar: `🌐 Sayt orqali vazifalar` tugmasi, `/kurs`, `/kurslar`, `/kod`. Token endi FAQAT `BOT_TOKEN` muhit o'zgaruvchisidan olinadi.
(Faqat qo'shimcha qismni o'zingiz qo'shmoqchi bo'lsangiz: `course_codes.py`.)

## 1. Muhit o'zgaruvchilari (Wispbyte)
- `BOT_TOKEN` — bot tokeni (eskisi kodda ochiq qolgan edi: BotFather → /revoke bilan YANGILANG)
- `COURSE_CODE_SECRET` — uzun tasodifiy so'z, saytdagi bilan BIR XIL
- `COURSE_SITE_URL=https://satbyusmon.com`

Saytda (`.env.local` / hosting): `COURSE_CODE_SECRET=...` (bot bilan bir xil).

## 2. Sayt SQL
Supabase → SQL Editor: `supabase/schema.sql` oxiridagi v60, v62, v66 bloklar.

## 3. Guruhlarni bog'lash
Kurs guruhida (siz admin sifatida): `/kurs nov` yoki `/kurs dec`. Tekshirish: botga `/kurslar`.
Bot guruhda **admin** bo'lsa, a'zolikni eng ishonchli tekshiradi.

## 4. O'quvchi uchun
Botda **🌐 Sayt orqali vazifalar** → saytga o'tish tugmasi + a'zo bo'lgan guruhlari uchun "🔑 kod olish".
Saytda: **Kurslar → Kod bilan qo'shilish**.

## Qoidalar
- Kod faqat guruh a'zosiga (Telegramdan jonli tekshiriladi) va har guruh uchun alohida beriladi; NOV kodi faqat November guruhini ochadi.
- Kod bir marta beriladi; qayta bosilsa yangi emas, o'sha kod eslatma bilan ko'rsatiladi.
- Sayt kodni faqat bitta akkauntga bog'laydi — boshqa akkaunt shu kod bilan kira olmaydi.
- Pro obuna kurs guruhini ochmaydi. Qo'lda: Admin → Foydalanuvchilar. Akkaunt almashtirish kerak bo'lsa, admin guruhni olib tashlaydi — o'sha kod qayta ishlatiladi.

## v67 yangilanishi
- `bot_updated.py` — yangi (joriy) bot versiyasi ustiga qayta yig'ilgan: sayt kodi (`course_codes.py`) + admin statistikasi (`group_stats.py`) kiritilgan.
- Admin menyusida **📈 O'quvchilar statistikasi**: guruhni tanlang → har bir o'quvchi nechta vazifa bajargan/bajarmagan va har bir mockni nechta o'quvchi ishlagan/ishlamagan ro'yxati.

## v107 — 📚 Bepul kitob (referal tizimi)
Saytdagi kitob hozircha faqat shu bot orqali beriladi: o'quvchi botdan **shaxsiy havola** oladi → 5 ta do'sti havola orqali botga kirib, majburiy kanallarga (`REQUIRED_CHANNELS`) obuna bo'lsa → bot kitobni **avtomatik** yuboradi.

**Sozlash (bir marta):**
1. Yangi `bot_updated.py` ni Wispbyte'ga qo'ying (jadvallar o'zi yaratiladi: `book_referrals`, `book_delivered`).
2. Kitob PDF'ini **botga yuboring** (admin akkauntingizdan) va fayl **sarlavhasiga** `/setbook` deb yozing. Bot "✅ Kitob fayli o'rnatildi" deydi. Fayl serverda saqlanmaydi — faqat Telegram `file_id` eslab qolinadi.
3. Tekshirish: botda **📚 Bepul kitob** tugmasi (yoki `/kitob`), admin uchun `/kitob_stat`.

**Qoidalar:**
- Faqat botga **yangi** kirgan va kanallarga obuna bo'lgan do'st hisoblanadi (botda avvaldan bor odam yoki o'zini o'zi taklif qilish sanalmaydi).
- Kitob berilishidan oldin 5 ta do'stning obunasi qayta tekshiriladi (chiqib ketgan sanalmaydi).
- Har bir kishiga avtomatik faqat bir marta yuboriladi; keyin "📥 Kitobni qayta olish" tugmasi bor.
- Fayl hali o'rnatilmagan bo'lsa-yu kimdir 5 ta do'st to'plasa — adminlarga eslatma ketadi, `/setbook` qilingach kutib turganlarga avtomatik yuboriladi.

**Tuzatish:** filtr klasslari (`IsAdmin`, `IsPrivateChat`…) ishlatilishidan oldin e'lon qilinishi uchun yuqoriga ko'chirildi — avval fayl import paytida `NameError` bergan.
