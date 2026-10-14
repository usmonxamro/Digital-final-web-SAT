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
