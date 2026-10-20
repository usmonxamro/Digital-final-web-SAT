-- v96 — Sayt natijalari ham umumiy `attempt_log` jurnaliga tushadi (2-bosqich). Qayta ishga tushirsa ham xavfsiz.
-- Supabase -> SQL Editor -> New query -> Run.

-- Sayt savollari raqam bilan emas, id bilan ishlaydi — shuning uchun xato savollar id ro'yxati sifatida ham saqlanadi.
alter table attempt_log add column if not exists wrong_qids text[] not null default '{}';
alter table attempt_log add column if not exists web_attempt_id uuid;      -- test_attempts.id (qayta ko'chirishda dublikat bo'lmasligi uchun)
create unique index if not exists attempt_log_web_attempt_uidx on attempt_log(web_attempt_id) where web_attempt_id is not null;

-- Eski sayt natijalarini ko'chirish (test_attempts.review_json dan). Faqat review_json bor qatorlar.
insert into attempt_log (source, user_id, test_label, correct, total, score_text, answers, wrong_qids, submitted_at, web_attempt_id)
select 'web', t.user_id, t.test_label,
       t.correct_count, t.correct_count + t.incorrect_count + t.omitted_count,
       t.composite::text,
       (select coalesce(jsonb_object_agg(e ->> 'questionId', e -> 'answer'), '{}'::jsonb)
          from jsonb_array_elements(t.review_json) e where e ->> 'questionId' is not null),
       (select coalesce(array_agg(e ->> 'questionId'), '{}')
          from jsonb_array_elements(t.review_json) e
         where e ->> 'questionId' is not null and (e ->> 'correct') = 'false'),
       t.created_at, t.id
  from test_attempts t
 where t.review_json is not null and jsonb_typeof(t.review_json) = 'array'
on conflict do nothing;

-- Sayt savollari bo'yicha: necha urinish, necha xato, qaysi mavzu (domain)
create or replace view v_web_question_stats with (security_invoker = true) as
with a as (select test_label, wrong_qids, answers from attempt_log where source = 'web'),
     n as (select test_label, count(*) attempts from a group by 1),
     g as (select test_label, k as question_id, count(*) answered
             from a cross join lateral jsonb_object_keys(a.answers) k group by 1, 2),
     w as (select test_label, unnest(wrong_qids) question_id, count(*) wrong from a group by 1, 2)
select g.test_label, g.question_id, q.domain, q.difficulty,
       n.attempts, coalesce(w.wrong, 0) as wrong,
       round(100.0 * coalesce(w.wrong, 0) / n.attempts, 1) as wrong_pct
  from g
  join n using (test_label)
  left join w on w.test_label = g.test_label and w.question_id = g.question_id
  left join questions q on q.id::text = g.question_id;

-- Telegram bilan bog'langan sayt o'quvchilari uchun bitta ko'rinish (kim botda ham, saytda ham nechta mock yechgan)
create or replace view v_student_overview with (security_invoker = true) as
select a.tg_id, a.fullname, a.user_id,
       count(*) filter (where l.source = 'bot') as bot_attempts,
       count(*) filter (where l.source = 'web') as web_attempts,
       max(l.submitted_at) as last_activity
  from tg_accounts a
  left join attempt_log l on l.tg_id = a.tg_id or (a.user_id is not null and l.user_id = a.user_id)
 group by a.tg_id, a.fullname, a.user_id;

revoke all on v_web_question_stats, v_student_overview from anon, authenticated;
