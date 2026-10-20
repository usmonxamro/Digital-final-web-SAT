-- v94 — Telegram bot ma'lumotlarini Supabase'ga ko'chirish uchun jadvallar (1-faza).
-- Faqat YANGI jadval/view qo'shadi, mavjud jadvallarga tegmaydi. Qayta ishga tushirsa ham xavfsiz.
-- Supabase -> SQL Editor -> New query -> hammasini qo'yib Run.

-- 1) Telegram akkauntlar (+ sayt akkaunti bilan bog'lash joyi)
create table if not exists tg_accounts (
  tg_id      bigint primary key,
  username   text,
  fullname   text,
  name_set   boolean not null default false,
  user_id    uuid references users(id) on delete set null,   -- sayt akkaunti (kurs kodi orqali bog'lanadi)
  created_at timestamptz not null default now()
);
create index if not exists tg_accounts_user_idx on tg_accounts(user_id);

-- 2) Telegram guruhlar va a'zolar
create table if not exists tg_groups (
  chat_id     bigint primary key,
  title       text,
  course_slug text,                                          -- saytdagi kurs guruhi ('nov', 'dec') bilan bog'lash
  added_at    timestamptz
);
create table if not exists tg_group_members (
  chat_id   bigint not null references tg_groups(chat_id) on delete cascade,
  tg_id     bigint not null references tg_accounts(tg_id) on delete cascade,
  fullname  text,
  username  text,
  joined_at timestamptz,
  primary key (chat_id, tg_id)
);
create index if not exists tg_group_members_tg_idx on tg_group_members(tg_id);

-- 3) Botdagi testlar (javob kalitlari). test_label bo'sh bo'lsa — bu mock saytda hali yo'q.
create table if not exists bot_tests (
  code           text primary key,
  name           text,
  kind           text,                                       -- modulli_44 | ketmaket_44 | ixtiyoriy
  level          text,
  answers        jsonb not null,
  question_count integer not null default 0,
  test_label     text references test_configs(test_label) on update cascade on delete set null,
  created_at     timestamptz
);
create index if not exists bot_tests_label_idx on bot_tests(test_label);

-- 4) Qaysi mock qaysi guruhga berilgan
create table if not exists group_mock_assignments (
  bot_code    text   not null references bot_tests(code) on delete cascade,
  chat_id     bigint not null references tg_groups(chat_id) on delete cascade,
  assigned_at timestamptz,
  primary key (bot_code, chat_id)
);

-- 5) UMUMIY urinishlar jurnali: bot ham, sayt ham shu yerga yoziladi.
--    Har javob uchun alohida qator YO'Q (baza tez to'lib ketmasligi uchun): bitta urinish = bitta qator,
--    javoblar jsonb'da, xato raqamlari wrong_nos massivida.
create table if not exists attempt_log (
  id           bigint generated always as identity primary key,
  source       text not null check (source in ('bot','web')),
  tg_id        bigint references tg_accounts(tg_id) on delete set null,
  user_id      uuid   references users(id)          on delete set null,
  chat_id      bigint,                                       -- bot: qaysi guruhdan yechilgan (null = shaxsiy)
  bot_code     text   references bot_tests(code)    on delete set null,
  test_label   text,                                         -- sayt mocki nomi (web uchun)
  correct      integer,
  total        integer,
  score_text   text,
  answers      jsonb,                                        -- {"1":"C","2":"336",...}
  wrong_nos    integer[] not null default '{}',
  submitted_at timestamptz not null,
  legacy_id    bigint,                                       -- botdagi results.id (qayta ko'chirishda dublikat bo'lmasligi uchun)
  check (bot_code is not null or test_label is not null),
  unique (source, legacy_id)
);
create index if not exists attempt_log_tg_idx    on attempt_log(tg_id, submitted_at desc);
create index if not exists attempt_log_user_idx  on attempt_log(user_id, submitted_at desc);
create index if not exists attempt_log_code_idx  on attempt_log(bot_code);
create index if not exists attempt_log_label_idx on attempt_log(test_label);

-- Faqat server (service_role) kiradi — saytdagi qolgan jadvallar kabi
alter table tg_accounts            enable row level security;
alter table tg_groups              enable row level security;
alter table tg_group_members       enable row level security;
alter table bot_tests              enable row level security;
alter table group_mock_assignments enable row level security;
alter table attempt_log            enable row level security;

-- 6) Telegram akkauntni sayt akkaunti bilan bog'lash: o'quvchi kurs kodi orqali kirgan bo'lsa (course_memberships.tg_id)
update tg_accounts a
   set user_id = m.user_id
  from (select distinct on (tg_id) tg_id, user_id
          from course_memberships where tg_id is not null
         order by tg_id, created_at) m
 where a.tg_id = m.tg_id and a.user_id is null;

-- 7) Hisobotlar uchun view'lar
-- Mock kaliti: botdagi test saytdagi mockka ulangan bo'lsa — sayt nomi, bo'lmasa 'bot:<kod>'
create or replace view v_attempts as
select l.*, coalesce(l.test_label, bt.test_label, 'bot:' || l.bot_code) as mock_key
  from attempt_log l left join bot_tests bt on bt.code = l.bot_code;

-- Har bir mock savoli bo'yicha: necha urinish, necha xato
create or replace view v_question_stats as
with a as (select mock_key, wrong_nos from v_attempts),
     n as (select mock_key, count(*) attempts from a group by 1),
     w as (select mock_key, unnest(wrong_nos) q_no, count(*) wrong from a group by 1, 2)
select w.mock_key, w.q_no, n.attempts, w.wrong,
       round(100.0 * w.wrong / n.attempts, 1) as wrong_pct
  from w join n using (mock_key);

-- Guruh a'zolari: berilgan mockni yechdimi (qaysi guruhdan yechganidan qat'i nazar — avval yechgan bo'lsa ham "bajargan")
create or replace view v_group_progress as
select gm.chat_id, g.title as group_title, gm.tg_id, coalesce(gm.fullname, a.fullname) as fullname,
       m.bot_code, bt.name as mock_name,
       exists (select 1 from attempt_log r where r.tg_id = gm.tg_id and r.bot_code = m.bot_code) as done
  from tg_group_members gm
  join tg_groups g               on g.chat_id = gm.chat_id
  join group_mock_assignments m  on m.chat_id = gm.chat_id
  join bot_tests bt              on bt.code = m.bot_code
  left join tg_accounts a        on a.tg_id = gm.tg_id;
