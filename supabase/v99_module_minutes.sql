-- v99 — Har bir modulga alohida vaqt (yangi mock qo'shishda).
-- Supabase -> SQL Editor -> New query -> Run. Qayta ishga tushirsa ham xavfsiz.
-- Format: {"rw1":35,"rw2":35,"m1":35,"m2":35}  (ketma-ket Math uchun: {"seq":70}). NULL = eski usul (32 / 35 daqiqa).
alter table test_configs add column if not exists module_minutes jsonb;
