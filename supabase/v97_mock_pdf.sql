-- v97 — Tayyor (oldindan yaratilgan) PDF'lar. Qayta ishga tushirsa ham xavfsiz.
-- Supabase -> SQL Editor -> New query -> Run.
alter table test_configs add column if not exists pdf_path text;          -- Storage'dagi fayl yo'li (null = tayyor PDF yo'q)
alter table test_configs add column if not exists pdf_built_at timestamptz;

-- Maxfiy bucket: fayllar faqat sayt bergan qisqa muddatli havola orqali yuklanadi
insert into storage.buckets (id, name, public)
values ('mock-pdfs', 'mock-pdfs', false)
on conflict (id) do nothing;
