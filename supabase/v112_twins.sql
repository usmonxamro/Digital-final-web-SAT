-- v112: «Egizak savollar» (twins) + savol oilalari (families)
-- Har bir original savol — oila boshi (family root). Twin = sonlari o'zgartirilgan nusxa, bir marta saqlanadi
-- va istalgan takrorlash mockida qayta ishlatiladi. Mockka nusxa qilinganda nusxa o'z oilasini eslab qoladi,
-- shuning uchun xatolar oila bo'yicha yig'iladi va baza "bir xil savollar" bilan to'lib ketmaydi.

create table if not exists question_twins (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,              -- oila boshi: original savolning questions.id
  source_id uuid,                       -- aynan qaysi savoldan yasalgan
  variant smallint not null default 1,  -- 1, 2, 3 … (0 = original)
  kind text not null default 'math',
  type text not null default 'mcq',
  difficulty text,
  domain text,
  passage text,
  underline text,
  prompt text not null,
  equations jsonb,
  image text,
  choices jsonb,
  correct text,
  correct_value text,
  explanation text,
  layout jsonb,
  key_checked boolean not null default false,  -- admin kalitni tasdiqladimi
  needs_figure boolean not null default false, -- chizmadagi sonlar o'zgargan — yangi rasm kerak
  created_at timestamptz not null default now(),
  unique (family_id, variant)
);
create index if not exists question_twins_family_idx on question_twins (family_id);
alter table question_twins enable row level security;

-- Mockdagi har bir savol qaysi oilaga tegishli (null = o'zi oila boshi) va qaysi variant ekanini biladi.
alter table questions add column if not exists family_id uuid;
alter table questions add column if not exists variant smallint not null default 0;
alter table questions add column if not exists twin_id uuid;
create index if not exists questions_family_idx on questions (family_id);
