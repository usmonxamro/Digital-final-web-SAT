-- v111 — Lug'atlar (Vocabulary): sayt va Telegram bot BIR XIL so'zlar bazasidan foydalanadi.
-- Supabase -> SQL Editor -> New query -> hammasini qo'yib Run. Qayta ishga tushirsa ham xavfsiz.
-- Keyin v111_vocab_seed.sql ni ishga tushiring (boshlang'ich 591 ta so'z).

-- 1) So'zlar. subject: 'math' (SAT Math) yoki 'english' (kelajakda SAT English uchun alohida bo'lim).
create table if not exists vocab_words (
  id           bigint generated always as identity primary key,
  subject      text not null default 'math' check (subject in ('math', 'english')),
  en           text not null,
  uz           text not null,
  cat          text not null default 'Umumiy',
  example      text,                                   -- mock savolidan olingan inglizcha gap (kontekst quiz uchun)
  example_src  text,                                   -- qaysi mockdan olingani (test_label)
  needs_review boolean not null default false,         -- tarjimasini tekshirish kerak (admin panelda belgi chiqadi)
  active       boolean not null default true,          -- false = admin "o'chirgan" (yashirin); botda ham, saytda ham chiqmaydi
  source       text not null default 'list' check (source in ('list', 'mock', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists vocab_words_subject_en_uidx on vocab_words (subject, lower(en));
create index if not exists vocab_words_active_idx on vocab_words (subject, active);

-- 2) O'quvchi taraqqiyoti (intervalli takrorlash, Leitner qutilari).
--    student: 'u:<sayt user uuid>' (saytdan) yoki 't:<telegram id>' (botdan).
--    Har bir (o'quvchi, so'z) uchun BITTA qator — baza tez o'smaydi; har bir javob alohida saqlanmaydi.
create table if not exists vocab_progress (
  student       text   not null,
  word_id       bigint not null references vocab_words(id) on delete cascade,
  box           smallint not null default 0,           -- 0 = yangi/xato, 5 = yaxshi o'zlashtirilgan
  right_n       integer not null default 0,
  wrong_n       integer not null default 0,
  last_wrong_at timestamptz,
  due_at        timestamptz not null default now(),    -- shu vaqtdan keyin qayta so'raladi
  updated_at    timestamptz not null default now(),
  primary key (student, word_id)
);
create index if not exists vocab_progress_due_idx on vocab_progress (student, due_at);
create index if not exists vocab_progress_wrong_idx on vocab_progress (word_id) where wrong_n > 0;

-- 3) Yangi mocklardan topilgan, hali tarjimasi yo'q so'zlar (admin tarjima yozib qo'shadi yoki rad etadi).
create table if not exists vocab_candidates (
  subject     text not null default 'math',
  word        text not null,
  docs        integer not null default 0,              -- nechta savolda uchragan
  example     text,
  example_src text,
  status      text not null default 'new' check (status in ('new', 'ignored', 'added')),
  updated_at  timestamptz not null default now(),
  primary key (subject, word)
);

-- Faqat server (service_role) kiradi — saytdagi qolgan jadvallar kabi
alter table vocab_words      enable row level security;
alter table vocab_progress   enable row level security;
alter table vocab_candidates enable row level security;
