-- v117: «Shubhali savollar» — kaliti yoki matni shubhali savollar bir joyda yig'iladi (Mock tuzish → Shubhali).
-- Shubhali savolga twin yaratilmaydi: avval admin kalitni tekshiradi/tuzatadi, so'ng u «yopiladi».
create table if not exists question_flags (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,              -- savol oilasi (original savolning id'si)
  question_id uuid,                     -- shubhali savolning o'zi
  kind text not null default 'key',     -- key = kalit shubhali, text = matn/import buzilgan
  reason text not null,                 -- nima uchun shubhali (qisqa tushuntirish)
  suggested text,                       -- taxminiy to'g'ri javob (bo'lsa)
  status text not null default 'open',  -- open | fixed (tuzatildi) | ok (tekshirildi, to'g'ri)
  source text not null default 'claude',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (family_id)
);
create index if not exists question_flags_status_idx on question_flags (status);
alter table question_flags enable row level security;
