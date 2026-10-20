-- v95 — Shubhali javob kalitlarini aniqlash.
-- Supabase -> SQL Editor -> New query -> Run. Qayta ishga tushirsa ham xavfsiz.
--
-- Mantiq: har bir (test, savol) uchun qancha o'quvchi yechgan, nechtasi to'g'ri topgan va
-- xato javoblar ichida eng ko'p yozilgan javob qaysi. Agar ko'pchilik bir xil javob bergan-u,
-- kalitga deyarli hech kim mos kelmasa — kalitda xato (yoki savolning o'zida muammo) bo'lishi mumkin.
create or replace view v_suspect_keys with (security_invoker = true) as
with a as (
  select l.bot_code,
         kv.key::int as q_no,
         upper(replace(trim(kv.value #>> '{}'), ' ', '')) as given,
         (kv.key::int = any (l.wrong_nos)) as is_wrong
    from attempt_log l
   cross join lateral jsonb_each(l.answers) kv
   where l.bot_code is not null and kv.key ~ '^[0-9]+$'
),
g as (
  select bot_code, q_no, given, count(*) as c, bool_or(is_wrong) as is_wrong
    from a group by 1, 2, 3
),
t as (
  select bot_code, q_no, sum(c)::int as attempts,
         coalesce(sum(c) filter (where not is_wrong), 0)::int as correct
    from g group by 1, 2
),
top as (
  select distinct on (bot_code, q_no) bot_code, q_no, given as top_wrong_answer, c as top_wrong_count
    from g
   where is_wrong and given not in ('-', '')
   order by bot_code, q_no, c desc
),
r as (
  select t.bot_code, bt.name as mock_name, t.q_no,
         bt.answers ->> t.q_no::text as key_answer,
         t.attempts, t.correct,
         round(100.0 * t.correct / t.attempts)                     as correct_pct,
         top.top_wrong_answer, top.top_wrong_count,
         round(100.0 * coalesce(top.top_wrong_count, 0) / t.attempts) as top_wrong_pct
    from t
    join bot_tests bt on bt.code = t.bot_code
    left join top using (bot_code, q_no)
)
select *,
       case
         when attempts >= 8 and correct_pct <= 20 and top_wrong_pct >= 60
              then '1-EHTIMOL KALIT XATO'          -- ko'pchilik bir xil javob bergan, kalitga deyarli hech kim mos emas
         when attempts >= 8 and correct_pct <= 10
              then '2-HECH KIM YECHMAGAN'           -- kalit yoki savol matnini tekshiring
         when attempts >= 8 and correct_pct <= 30 and top_wrong_pct >= 50
              then '3-TEKSHIRING'
       end as flag
  from r;

revoke all on v_suspect_keys from anon, authenticated;
