-- v115 — Lug'at avto-taklifi "o'rganadi": admin qaysi so'zlarni tanlaydi / rad etadi / doim yashiradi.
-- Supabase -> SQL Editor -> New query -> hammasini qo'yib Run. Qayta ishga tushirsa ham xavfsiz.
-- Bu ustunlarsiz ham tizim ishlaydi (tarjima tuzatishlari va yangi so'zlar saqlanadi), faqat "o'rganish" o'chiq turadi.
alter table vocab_words add column if not exists q_picked  integer not null default 0;   -- admin savolga qo'lda qo'shgan marta
alter table vocab_words add column if not exists q_skipped integer not null default 0;   -- taklif qilingan, admin olib tashlagan marta
alter table vocab_words add column if not exists q_hidden  boolean not null default false; -- savol lug'atida HECH QACHON taklif qilinmasin (quizda qoladi)
