# Telegram bot ↔ sayt: kurs kodlari

Maqsad: kurs guruhingiz (SAT November / December 800/800) a'zosi saytda shu guruhning vazifalarini ochsin.

## 1. Maxfiy so'z (ikkala joyda BIR XIL)
Uzun tasodifiy so'z o'ylab toping (masalan 40 ta belgi).
- **Sayt**: `.env.local` ga `COURSE_CODE_SECRET=...`
- **Bot (Wispbyte)**: muhit o'zgaruvchisi `COURSE_CODE_SECRET=...` va `COURSE_SITE_URL=https://saytingiz`

## 2. Sayt
Supabase → SQL Editor: `supabase/schema.sql` oxiridagi **v60** blokni ishga tushiring (`course_memberships` jadvali).

## 3. Bot
`course_codes.py` mazmunini bot faylingizga qo'shing: `_execute` funksiyasidan keyin, birinchi `@dp.message(...)` dan oldin.
Botning o'quvchi menyusiga tugma qo'shing (`get_main_menu` ichida):
`[KeyboardButton(text="🔑 Saytga kirish kodi")]`

## 4. Guruhlarni bog'lash
Kurs guruhida (siz admin sifatida) yozing: `/kurs nov` yoki `/kurs dec`. Tekshirish: botga `/kurslar`.
Bot guruhda **admin** bo'lsa, a'zolikni eng ishonchli tekshiradi.

## 5. O'quvchi uchun
Botda **🔑 Saytga kirish kodi** → kod → saytda **Kurslar → Kod bilan qo'shilish**.
Bir Telegram o'quvchining kodi faqat bitta sayt akkauntida ishlaydi. Admin → Foydalanuvchilar'da guruhni qo'lda qo'shish/olib tashlash mumkin.

## Xavfsizlik
Bot tokenini kod ichida emas, faqat muhit o'zgaruvchisida saqlang (kod ichidagi token ochiq qolgan bo'lsa, BotFather → /revoke bilan yangilang).
