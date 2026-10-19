-- SAT kitobi savollar banki. Supabase -> SQL Editor -> Run (bir marta).
-- Mavjud "questions" jadvaliga TEGMAYDI (mock va skill-drill lar buzilmaydi).
create table if not exists question_bank (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique,          -- kitobdagi Question ID (qayta yuklashda dublikat bo'lmaydi)
  domain text not null check (domain in ('Algebra','Advanced Math','Problem-Solving and Data Analysis','Geometry and Trigonometry')),
  topic text not null,                     -- masalan "Linear functions"
  topic_code text not null,                -- LE1, LF, SYS, PCT ... (o'xshash savol topish uchun kalit)
  number integer not null,                 -- kitobdagi tartib raqami (topic ichida)
  difficulty text not null check (difficulty in ('Easy','Medium','Hard')),
  type text not null check (type in ('mcq','gridin')),
  prompt text not null,
  equations jsonb,
  image text,
  choices jsonb,
  correct text,                            -- mcq: A-D
  correct_value text,                      -- gridin: javob
  explanation text,
  needs_check boolean not null default false,
  note text,
  source text not null default 'book',
  created_at timestamptz not null default now()
);
create index if not exists question_bank_topic_idx on question_bank(topic_code, difficulty);
create index if not exists question_bank_domain_idx on question_bank(domain);
alter table question_bank enable row level security;   -- policy yo'q: faqat service_role (server) o'qiydi/yozadi

-- "O'xshash savol" taklifi uchun tayyor funksiya (keyin API dan chaqirasiz):
-- select * from similar_bank_questions('LF','Medium', array['<allaqachon-ko''rilgan-id>']::uuid[], 3);
create or replace function similar_bank_questions(p_topic_code text, p_difficulty text, p_exclude uuid[] default '{}', p_limit int default 3)
returns setof question_bank language sql stable as $$
  select * from question_bank
  where topic_code = p_topic_code and needs_check = false and not (id = any(p_exclude))
  order by (difficulty = p_difficulty) desc, random()
  limit p_limit;
$$;

-- v88: admin tahrir qilgan savollar (qayta import ularni ustiga yozmaydi).
alter table question_bank add column if not exists edited_at timestamptz;

-- v89: o'quvchi tomondagi "Questions bank" progressi.
create table if not exists bank_answers (
  user_id uuid not null references users(id) on delete cascade,
  question_id uuid not null references question_bank(id) on delete cascade,
  correct boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table bank_answers enable row level security;
