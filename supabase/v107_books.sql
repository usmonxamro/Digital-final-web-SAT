-- v107 — Mualliflik kitoblari: yopiq "books" bucket va yuklab olishlar jurnali.
-- Supabase -> SQL Editor -> New query -> Run. Qayta ishga tushirsa ham xavfsiz.
--
-- 1) "books" bucket YOPIQ (public = false): kitob PDF'i hech qanday ochiq havolaga ega emas.
--    Yuklab olish /api/books/download orqali, faqat tizimga kirgan foydalanuvchiga,
--    60 soniya amal qiladigan imzolangan havola bilan beriladi.
-- 2) Kitob faylini yuklash: Supabase -> Storage -> books -> Upload file
--    Fayl nomi AYNAN shunday bo'lsin:  SAT Math by Usmon.pdf
-- 3) book_downloads — kim qaysi kitobni qachon yuklab olgani (statistika uchun).

insert into storage.buckets (id, name, public)
values ('books', 'books', false)
on conflict (id) do update set public = false;

create table if not exists book_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  book_slug text not null,
  created_at timestamptz not null default now()
);

create index if not exists book_downloads_slug_idx on book_downloads (book_slug, created_at desc);
create index if not exists book_downloads_user_idx on book_downloads (user_id, created_at desc);

-- Barcha kirish server tomondagi service_role kaliti orqali (RLS'ni chetlab o'tadi).
alter table book_downloads enable row level security;
