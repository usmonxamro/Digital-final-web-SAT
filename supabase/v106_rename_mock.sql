-- v106 — Mock nomini o'zgartirish (Admin → Mocklar → mockni oching → "Nomini o'zgartirish").
-- Supabase -> SQL Editor -> New query -> Run. Qayta ishga tushirsa ham xavfsiz.
--
-- Mockning nomi (test_label) bir nechta jadvalda kalit sifatida turadi. Bu funksiya hammasini
-- BITTA tranzaksiyada almashtiradi: biror joyda xato chiqsa, hech narsa o'zgarmaydi.
--   test_configs (bot_tests unga ON UPDATE CASCADE bilan bog'langan), questions, test_attempts,
--   mock_starts, question_reports, attempt_log.
-- Tayyor PDF eski nom bilan qurilgan — u qayta yasaladi (pdf_path tozalanadi).
-- p_groups: eski nom "SAT November 800/800 — ..." kabi guruh nomi bilan boshlangani uchun guruhga
--   tegishli bo'lgan vazifa yangi nomda ham o'sha guruhda qolsin (course_groups bo'sh bo'lsa yoziladi).

create or replace function public.admin_rename_mock(p_old text, p_new text, p_groups text[] default null)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_new text := btrim(coalesce(p_new, ''));
  v_has_cfg boolean;
  n_q int := 0; n_att int := 0; n_st int := 0; n_rep int := 0; n_log int := 0; n_bot int := 0;
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

  update questions        set test_label = v_new where test_label = p_old; get diagnostics n_q = row_count;
  update test_attempts    set test_label = v_new where test_label = p_old; get diagnostics n_att = row_count;
  update mock_starts      set test_label = v_new where test_label = p_old; get diagnostics n_st = row_count;
  update question_reports set test_label = v_new where test_label = p_old; get diagnostics n_rep = row_count;
  update attempt_log      set test_label = v_new where test_label = p_old; get diagnostics n_log = row_count;

  return json_build_object(
    'label', v_new, 'questions', n_q, 'attempts', n_att, 'starts', n_st,
    'reports', n_rep, 'log', n_log, 'hadConfig', v_has_cfg
  );
end;
$$;

-- Faqat server (service_role) chaqira oladi — saytdagi oddiy foydalanuvchilar emas.
revoke all on function public.admin_rename_mock(text, text, text[]) from public, anon, authenticated;
grant execute on function public.admin_rename_mock(text, text, text[]) to service_role;
