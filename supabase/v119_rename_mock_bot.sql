-- v119 — Mock nomi o'zgarganda BOTDAGI test nomi ham o'zgaradi.
-- Supabase -> SQL Editor -> New query -> Run. Qayta ishga tushirsa ham xavfsiz.
--
-- v106 dagi admin_rename_mock funksiyasi endi bot_tests.name ni ham yangilaydi va name_dirty=true qo'yadi.
-- Bot (bot_to_supabase.py) name_dirty=true qatorlarni ko'rib, o'z SQLite bazasidagi test nomini almashtiradi
-- va name_dirty ni false qiladi. Shu tufayli bot eski nomni Supabase'ga qaytarib yozib yubormaydi.
-- Nomi " (Math)" bilan tugagan bot testlarida bu qo'shimcha saqlanib qoladi.

alter table bot_tests add column if not exists name_dirty boolean not null default false;

create or replace function public.admin_rename_mock(p_old text, p_new text, p_groups text[] default null)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_new text := btrim(coalesce(p_new, ''));
  v_has_cfg boolean;
  n_q int := 0; n_att int := 0; n_st int := 0; n_rep int := 0; n_log int := 0; n_bot int := 0; n_botname int := 0;
begin
  if v_new = '' or length(v_new) > 160 then
    raise exception 'BAD_NAME';
  end if;
  if v_new = p_old then
    raise exception 'SAME_NAME';
  end if;
  if exists (select 1 from test_configs where test_label = v_new)
     or exists (select 1 from questions where test_label = v_new) then
    raise exception 'NAME_TAKEN';
  end if;

  select exists (select 1 from test_configs where test_label = p_old) into v_has_cfg;
  if not v_has_cfg and not exists (select 1 from questions where test_label = p_old) then
    raise exception 'NOT_FOUND';
  end if;

  if v_has_cfg then
    update test_configs
       set test_label = v_new,
           pdf_path = null,
           pdf_built_at = null,
           course_groups = case
             when (course_groups is null or cardinality(course_groups) = 0)
                  and p_groups is not null and cardinality(p_groups) > 0 then p_groups
             else course_groups end
     where test_label = p_old;
    -- bot_tests.test_label follows automatically (FK ON UPDATE CASCADE)
  else
    update bot_tests set test_label = v_new where test_label = p_old;
    get diagnostics n_bot = row_count;
  end if;

  -- botdagi test nomi ham yangi nomga ko'chadi (bot buni o'zining bazasiga 1 daqiqa ichida oladi)
  update bot_tests
     set name = case when coalesce(name, '') like '% (Math)' then v_new || ' (Math)' else v_new end,
         name_dirty = true
   where test_label = v_new;
  get diagnostics n_botname = row_count;

  update questions        set test_label = v_new where test_label = p_old; get diagnostics n_q = row_count;
  update test_attempts    set test_label = v_new where test_label = p_old; get diagnostics n_att = row_count;
  update mock_starts      set test_label = v_new where test_label = p_old; get diagnostics n_st = row_count;
  update question_reports set test_label = v_new where test_label = p_old; get diagnostics n_rep = row_count;
  update attempt_log      set test_label = v_new where test_label = p_old; get diagnostics n_log = row_count;

  return json_build_object(
    'label', v_new, 'questions', n_q, 'attempts', n_att, 'starts', n_st,
    'reports', n_rep, 'log', n_log, 'hadConfig', v_has_cfg, 'botTests', n_botname
  );
end;
$$;

-- Faqat server (service_role) chaqira oladi — saytdagi oddiy foydalanuvchilar emas.
revoke all on function public.admin_rename_mock(text, text, text[]) from public, anon, authenticated;
grant execute on function public.admin_rename_mock(text, text, text[]) to service_role;
