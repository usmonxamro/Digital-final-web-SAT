-- v100 — Saytda yaratilgan mock botga ham tushishi uchun.
-- Supabase -> SQL Editor -> New query -> Run. Qayta ishga tushirsa ham xavfsiz.
--   origin        : 'bot' (botda yaratilgan) yoki 'site' (saytdan botga uzatilgan)
--   bot_synced_at : bot saytdan kelgan testni o'z bazasiga olgan vaqt (bo'sh = hali olmagan)
alter table bot_tests add column if not exists origin text not null default 'bot';
alter table bot_tests add column if not exists bot_synced_at timestamptz;
