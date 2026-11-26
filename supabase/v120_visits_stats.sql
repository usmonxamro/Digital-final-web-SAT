-- v120: lightweight, consistent visit counting + SQL-side statistics.
--
-- * increment_visits(): atomic +1 on site_stats('visits') — every instance sees the same number.
-- * admin_visit_stats(): the admin "Statistika" visit numbers computed inside Postgres
--   (30 Tashkent days) so the server no longer downloads every page_views row.
-- * platform_best_scores(): best score per student for the dashboard rank (one row per student).
-- * purge_old_page_views(): keeps page_views to the last 90 days.

create or replace function increment_visits()
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into site_stats (key, value, updated_at)
  values ('visits', 1, now())
  on conflict (key) do update set value = site_stats.value + 1, updated_at = now()
  returning value;
$$;

create or replace function admin_visit_stats(p_today timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select (p_today at time zone 'Asia/Tashkent')::date as d0
  ),
  pv as (
    select visitor_id, path, (created_at at time zone 'Asia/Tashkent')::date as d
    from page_views, bounds
    where created_at >= p_today - interval '29 days'
      and created_at <  p_today + interval '1 day'
  ),
  days as (
    select g::date as d
    from bounds, generate_series(bounds.d0 - 29, bounds.d0, interval '1 day') g
  ),
  daily as (
    select days.d,
           count(pv.visitor_id) as views,
           count(distinct pv.visitor_id) as visitors
    from days left join pv on pv.d = days.d
    group by days.d
  )
  select jsonb_build_object(
    'daily', (select jsonb_agg(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'views', views, 'visitors', visitors) order by d) from daily),
    'last7', (select count(*) from pv, bounds where pv.d >= bounds.d0 - 6),
    'unique7', (select count(distinct visitor_id) from pv, bounds where pv.d >= bounds.d0 - 6),
    'last30', (select count(*) from pv),
    'unique30', (select count(distinct visitor_id) from pv),
    'topPages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'views', c) order by c desc)
      from (select path, count(*) as c from pv group by path order by c desc limit 8) t
    ), '[]'::jsonb)
  );
$$;

create or replace function platform_best_scores()
returns table (user_id uuid, best integer)
language sql
stable
security definer
set search_path = public
as $$
  select user_id, max(composite + case when subject = 'full' then 0 else 200 end)::integer as best
  from test_attempts
  group by user_id
  having max(composite + case when subject = 'full' then 0 else 200 end) > 0;
$$;

create or replace function purge_old_page_views()
returns void
language sql
security definer
set search_path = public
as $$
  delete from page_views where created_at < now() - interval '90 days';
$$;

-- Only the server (service role) may call these.
revoke all on function increment_visits() from public, anon, authenticated;
revoke all on function admin_visit_stats(timestamptz) from public, anon, authenticated;
revoke all on function platform_best_scores() from public, anon, authenticated;
revoke all on function purge_old_page_views() from public, anon, authenticated;
grant execute on function increment_visits() to service_role;
grant execute on function admin_visit_stats(timestamptz) to service_role;
grant execute on function platform_best_scores() to service_role;
grant execute on function purge_old_page_views() to service_role;
