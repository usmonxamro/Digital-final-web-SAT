-- SAT AKADEMIYASI — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null unique,
  password_hash text not null,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  created_at timestamptz not null default now()
);

create table if not exists test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  test_label text not null default 'Practice Test 1',
  rw_scaled integer not null,
  math_scaled integer not null,
  composite integer not null,
  correct_count integer not null,
  incorrect_count integer not null,
  omitted_count integer not null,
  elapsed_label text,
  review_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists test_attempts_user_id_idx on test_attempts(user_id);

-- Added later: tells us how to interpret rw_scaled/math_scaled/composite for
-- this row. For 'math'/'english' attempts, the irrelevant *_scaled field is 0
-- and composite equals the single subject's scaled score.
alter table test_attempts add column if not exists subject text not null default 'full'
  check (subject in ('full', 'math', 'english'));

-- Short, single-domain practice drills (distinct from full mock tests above).
-- These feed the weak-skill recommendations but don't count as a "mock test".
create table if not exists skill_drills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  domain text not null,
  correct_count integer not null,
  total_count integer not null,
  review_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists skill_drills_user_id_idx on skill_drills(user_id);
alter table skill_drills enable row level security;

-- Admin-added questions. These extend the built-in pools at runtime (see
-- lib/test-data.ts / app/exam/page.tsx) — no code editing needed to add
-- more questions, just the /admin panel.
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reading', 'math')),
  type text not null default 'mcq' check (type in ('mcq', 'gridin')),
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')),
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
  -- NULL = general skill-bank question (feeds skill drills + extends the
  -- built-in Practice Test 1). A value like 'Practice Test 2' groups
  -- questions into their own, independently selectable full mock test.
  test_label text,
  created_at timestamptz not null default now()
);

-- Self-healing for a `questions` table created before some of these columns
-- were part of the table definition above (the "create table if not
-- exists" above is a no-op once the table already exists, so a column
-- added only inside that block never reaches an already-existing table
-- without an explicit alter like these — safe to re-run any time).
alter table questions add column if not exists type text not null default 'mcq' check (type in ('mcq', 'gridin'));
alter table questions add column if not exists difficulty text check (difficulty in ('Easy', 'Medium', 'Hard'));
alter table questions add column if not exists domain text;
alter table questions add column if not exists passage text;
alter table questions add column if not exists underline text;
alter table questions add column if not exists equations jsonb;
alter table questions add column if not exists image text;
alter table questions add column if not exists choices jsonb;
alter table questions add column if not exists correct text;
alter table questions add column if not exists correct_value text;
alter table questions add column if not exists explanation text;
-- NULL = general skill-bank question; a value like 'Practice Test 2' groups
-- questions into their own, independently selectable full mock test.
alter table questions add column if not exists test_label text;

-- Which module (1 or 2) a question belongs to within its (test_label, kind)
-- group. NULL = no fixed module (general skill-bank questions, or a
-- single continuous block — e.g. a "ketma-ket 44 talik" Math mock with no
-- module split). Added so the admin panel can import/edit Module 1 and
-- Module 2 as two independent, stable batches instead of guessing a split
-- from row order (which Postgres never guarantees without an explicit sort).
alter table questions add column if not exists module_number smallint check (module_number in (1, 2));

create index if not exists questions_kind_idx on questions(kind);
create index if not exists questions_test_label_idx on questions(test_label);
create index if not exists questions_test_label_kind_module_idx on questions(test_label, kind, module_number);
alter table questions enable row level security;

-- Per-test configuration: subject, scoring mode, module duration, and where
-- it appears on the dashboard (Mock testlar vs Course vazifalar). Keyed by
-- the same test_label used on the questions table.
create table if not exists test_configs (
  test_label text primary key,
  -- 'full'    = Reading&Writing + Math, 1600-scale certificate
  -- 'math'    = Math only
  -- 'english' = Reading & Writing only
  subject text not null default 'full' check (subject in ('full', 'math', 'english')),
  -- scored (exact official question count, 200-800 or 400-1600 scale) vs
  -- practice (any question count, no scale — just correct/incorrect + answer key)
  scored boolean not null default true,
  -- 'mock'        = shows under Dashboard -> Mock testlar, countdown timer
  -- 'course_task' = shows under Dashboard -> Course vazifalar, count-UP stopwatch, untimed
  placement text not null default 'mock' check (placement in ('mock', 'course_task')),
  -- Minutes per module. For 'full', english_module_minutes and math_module_minutes
  -- both apply (2 modules each). For single-subject, only the matching field applies.
  english_module_minutes integer not null default 32,
  math_module_minutes integer not null default 35,
  -- Only meaningful when subject = 'math'. 'modules' = standard 2 x 22
  -- timed modules (real Digital SAT structure). 'sequential' = one
  -- continuous block of up to 44 questions, numbered 1..44 on screen,
  -- no module break in between.
  math_layout text not null default 'modules' check (math_layout in ('modules', 'sequential')),
  created_at timestamptz not null default now()
);

-- Self-healing for a `test_configs` table created before these columns
-- existed (see the note above create-table `questions` for why this is
-- needed even though these are already in the table definition above).
alter table test_configs add column if not exists subject text not null default 'full' check (subject in ('full', 'math', 'english'));
alter table test_configs add column if not exists scored boolean not null default true;
alter table test_configs add column if not exists placement text not null default 'mock' check (placement in ('mock', 'course_task'));
alter table test_configs add column if not exists english_module_minutes integer not null default 32;
alter table test_configs add column if not exists math_module_minutes integer not null default 35;
alter table test_configs add column if not exists math_layout text not null default 'modules' check (math_layout in ('modules', 'sequential'));

alter table test_configs enable row level security;

-- Row Level Security: enabled, but all access goes through the server-side
-- service_role key (see lib/supabase.ts), which bypasses these policies.
-- This just makes sure the anon/public key (if you ever add one) can't
-- read or write anything by default.
alter table users enable row level security;
alter table test_attempts enable row level security;

-- Public storage bucket for question images (diagrams, charts, figures).
-- Uploads go through /api/admin/upload-image (service_role, bypasses RLS);
-- reads are public since the bucket itself is public — no policy needed.
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- v36: Draft → Check it now → Publish, and visual question layouts.
-- Safe to re-run. Existing tests stay published (default true); tests saved
-- from the admin panel from now on start as drafts until "Publish".
-- ---------------------------------------------------------------------------
alter table test_configs add column if not exists published boolean not null default true;
-- Block arrangement of a question's prompt paragraphs / tables / figure /
-- equations, set by dragging blocks in the admin exam preview.
-- Shape: { "v": 1, "rows": [["img","p0"],["eq0"],["p1"]] } — see lib/question-layout.ts.
alter table questions add column if not exists layout jsonb;

-- ---------------------------------------------------------------------------
-- v38: security, admins, Pro trial, mock limits, visit stats, video analysis.
-- Safe to re-run.
-- ---------------------------------------------------------------------------

-- 30-day free Pro for everyone (new sign-ups get it automatically; this
-- backfills existing users once).
alter table users add column if not exists premium_until timestamptz;
update users set premium_until = now() + interval '30 days' where premium_until is null;

-- Extra admins (the owner is ADMIN_PHONE in the environment).
alter table users add column if not exists role text not null default 'user';
do $$ begin
  alter table users add constraint users_role_check check (role in ('user', 'admin'));
exception when duplicate_object then null; end $$;

-- YouTube video analysis per mock (only the 11-character video id is stored).
alter table test_configs add column if not exists video_id text;

-- Every started mock — enforces "3 per day, 2 per hour" and ties a graded
-- result to a real start (a result can't be posted without one).
create table if not exists mock_starts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  test_label text not null,
  -- 'mock' counts toward the daily/hourly limit; 'task' (course tasks) doesn't.
  kind text not null default 'mock',
  started_at timestamptz not null default now(),
  graded_at timestamptz
);
alter table mock_starts add column if not exists kind text not null default 'mock';
-- The graded result, so a retry after a lost response gets the same answer.
alter table mock_starts add column if not exists result jsonb;
create index if not exists mock_starts_user_started_idx on mock_starts(user_id, started_at desc);
alter table mock_starts enable row level security;

-- Site visits (one row per page view).
create table if not exists page_views (
  id bigserial primary key,
  visitor_id text not null,
  user_id uuid,
  path text not null,
  referrer text,
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on page_views(created_at desc);
alter table page_views enable row level security;

-- Brute-force / abuse limiter (login, sign-up, admin code, …).
create table if not exists rate_events (
  id bigserial primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_key_created_idx on rate_events(key, created_at desc);
alter table rate_events enable row level security;

-- Phone numbers in one canonical form (digits with an optional leading "+"),
-- so "+998 90 123 45 67" and "+998901234567" are the same account. Rows whose
-- canonical form would collide with another account are left untouched.
update users u
set phone = regexp_replace(u.phone, '[^0-9+]', '', 'g')
where u.phone <> regexp_replace(u.phone, '[^0-9+]', '', 'g')
  and not exists (
    select 1 from users v
    where v.id <> u.id
      and regexp_replace(v.phone, '[^0-9+]', '', 'g') = regexp_replace(u.phone, '[^0-9+]', '', 'g')
  );

-- Digits-only copy of the phone, so the same number in any spelling is found
-- (used for duplicate checks and to identify the owner's account).
alter table users add column if not exists phone_digits text
  generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored;
create index if not exists users_phone_digits_idx on users(phone_digits);

-- v48: scheduled publishing (a draft goes live by itself at publish_at).
alter table test_configs add column if not exists publish_at timestamptz;

-- v50: sign-in with email and Google. A user may now have an email and/or a
-- phone; Google users have no phone and no password.
alter table users add column if not exists email text;
alter table users add column if not exists google_sub text;
alter table users add column if not exists avatar_url text;
alter table users alter column phone drop not null;
alter table users alter column password_hash drop not null;
create unique index if not exists users_email_lower_uidx on users (lower(email)) where email is not null;
create unique index if not exists users_google_sub_uidx on users (google_sub) where google_sub is not null;

-- v54: course membership. Students who are in the Telegram course groups get
-- access to "My Courses" tasks; everyone else sees the course list locked.
-- Admins always have access. Toggle it per student in Admin -> Users.
alter table users add column if not exists course_member boolean not null default false;

-- v55: "Free Mocks" section + free/paid access.
--   section = 'exams' -> All Past Exams (real exam versions)
--   section = 'free'  -> Free Mocks (your own practice tests)
--   access  = 'free' | 'paid' -> paid mocks show a lock and open only for Pro / course students / admins
alter table test_configs add column if not exists section text not null default 'exams' check (section in ('exams', 'free'));
alter table test_configs add column if not exists access text not null default 'free' check (access in ('free', 'paid'));

-- v56: site visit counter (written at most once an hour by the server).
create table if not exists site_stats (
  key text primary key,
  value bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table site_stats enable row level security;

-- v60: course groups (SAT November / December 800/800). A student unlocks a group
-- with a code from the Telegram bot (or an admin adds them by hand).
create table if not exists course_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  group_slug text not null,
  tg_id bigint,                       -- Telegram user id from the bot code (null = added by an admin)
  created_at timestamptz not null default now(),
  unique (user_id, group_slug)
);
create unique index if not exists course_memberships_tg_uidx on course_memberships (group_slug, tg_id) where tg_id is not null;
alter table course_memberships enable row level security;

-- v62: help-centre messages sent from the site (text + optional screenshot).
create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  name text not null default '',
  contact text not null default '',
  message text not null,
  image text,                          -- small JPEG data URL (compressed in the browser)
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table support_messages enable row level security;

-- v66: password reset by e-mail code (6 digits, 15 minutes, max 5 tries).
create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user_idx on password_resets(user_id);
alter table password_resets enable row level security;

-- v71: bell notifications (admin broadcasts + replies to question reports), question reports,
-- and "last time the student opened the bell" for unread counts / new-mock counts.
alter table users add column if not exists notifs_seen_at timestamptz;
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,   -- null = broadcast to every student
  kind text not null default 'admin' check (kind in ('admin', 'reply')),
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);
alter table notifications enable row level security;

create table if not exists question_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  name text not null default '',
  test_label text not null default '',
  module_label text not null default '',
  q_number integer,
  question_id text,
  prompt text not null default '',
  message text not null default '',
  status text not null default 'open' check (status in ('open', 'answered')),
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists question_reports_status_idx on question_reports(status, created_at desc);
alter table question_reports enable row level security;

-- v68: attach any mock to a course group (Admin -> Mocklar -> mockni oching -> "Kurs guruhi").
-- NULL = not attached (the old rule still applies: a label starting with the group title, e.g.
-- "SAT November 800/800 — Week 1", belongs to that group). A value is a slug from lib/course-groups.ts
-- ('nov', 'dec'); such a mock is shown in My Courses of that group only.
alter table test_configs add column if not exists course_group text;

-- v72: recommended time for a "vazifa" (unscored, any number of questions, count-up timer).
-- NULL = nothing recommended. The student sees it once, on the start screen ("Tavsiya etilgan vaqt: 50 daqiqa").
-- (The course_group column from v68 is also needed: run v68 first if you have not.)
alter table test_configs add column if not exists recommended_minutes integer;

-- v73: a mock / task can belong to SEVERAL course groups at once (Admin -> Guruhlar, or the mock's
-- own settings). Replaces the single course_group column of v68 (old values are copied over).
-- Being in a group does NOT hide a normal mock from "All Past Exams" / "Free Mocks".
alter table test_configs add column if not exists course_groups text[] not null default '{}';
update test_configs set course_groups = array[course_group]
  where course_group is not null and course_group <> '' and course_groups = '{}';

-- v75: ONE shared join code per course group. Give it to the whole group; each student types it once
-- (Kurslar -> Kod bilan qo'shilish) and the membership stays on their account.
-- Admin -> Guruhlar shows the code (copy / regenerate / switch off) and lists the group's students.
create table if not exists course_group_codes (
  group_slug text primary key,
  code text not null unique,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table course_group_codes enable row level security;
-- how the student got in: 'code' = shared group code (empty = Telegram personal code or added by an admin)
alter table course_memberships add column if not exists joined_via text;
insert into course_group_codes (group_slug, code) values
  ('nov', 'NOYABR-TGHS9G'),
  ('dec', 'DEKABR-NTRA2W')
on conflict (group_slug) do nothing;

-- v78: your own mock folders ("bo'limlar") in Admin -> Mocklar. A mock can sit in several folders
-- (drag it onto a folder, or press the folder's button on the mock's row) and always stays in the
-- general list too. Folders only organise the admin list.
create table if not exists mock_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table mock_folders enable row level security;
alter table test_configs add column if not exists folder_ids text[] not null default '{}';

-- v79: a mock can be in SEVERAL lists at once (All Past Exams AND Free Mocks), and the teacher decides
-- per mock whether students may download its questions as a PDF after finishing it.
--   sections     -> {'exams'}, {'free'}, {'exams','free'} or {} (null = old rows: the single `section` column is used)
--   pdf_download -> true = "Testni yuklab olish (PDF)" button on the score report
alter table test_configs add column if not exists sections text[];
alter table test_configs add column if not exists pdf_download boolean not null default false;
-- Old rows: copy the single list into the new column so both stay in step.
update test_configs set sections = array[section] where sections is null;
