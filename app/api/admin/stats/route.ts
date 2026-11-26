import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { tashkentDayStart } from '@/lib/exam-limits'
import { fetchAll } from '@/lib/db-paginate'
import { planInfo } from '@/lib/plan'

export type DayPoint = { date: string; views: number; visitors: number }
export type SiteStats = {
  visits: {
    today: number
    uniqueToday: number
    last7: number
    unique7: number
    last30: number
    unique30: number
    daily: DayPoint[]
    topPages: { path: string; views: number }[]
  }
  users: { total: number; new7: number; new30: number }
  attempts: { total: number; last7: number }
  /** Aggregate only — no per-student data or certificate files are stored. */
  insights: {
    plans: { pro: number; trial: number; free: number }
    last30Attempts: number
    avgFull: number | null
    accuracy: number | null
    buckets: { label: string; count: number }[]
    topMocks: { label: string; count: number }[]
  }
  /** The 4 numbers that show how well the site turns visitors into students (Tashkent days). */
  funnel: { today: FunnelPeriod; d7: FunnelPeriod; d30: FunnelPeriod }
  migrationNeeded: boolean
}
export type FunnelPeriod = {
  /** Unique visitors (anonymous browser ids). */
  visitors: number
  /** New accounts created in the period. */
  registrations: number
  /** Students who opened (started) at least one mock, and the number of starts. */
  startedUsers: number
  startedTotal: number
  /** Students who finished at least one mock, and the number of finished mocks. */
  completedUsers: number
  completedTotal: number
}

const DAY = 86400_000

/** Site-wide numbers for the admin "Statistika" tab (Tashkent days). */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const supabase = supabaseAdmin()
  const today = tashkentDayStart()
  const from30 = today - 29 * DAY
  const iso = (t: number) => new Date(t).toISOString()

  const [attRes, planRes, viewsRes, usersTotal, users7, users30, attTotal, att7, usersToday, startsRes] = await Promise.all([
    fetchAll<{ test_label: string; user_id: string; created_at: string; composite: number; subject: string; correct_count: number; incorrect_count: number; omitted_count: number }>((from, to) =>
      supabase
        .from('test_attempts')
        .select('test_label, user_id, created_at, composite, subject, correct_count, incorrect_count, omitted_count')
        .gte('created_at', iso(from30))
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
    fetchAll<{ plan: string | null; premium_until: string | null }>((from, to) =>
      supabase.from('users').select('plan, premium_until').order('created_at', { ascending: false }).range(from, to),
    ),
    supabase.rpc('admin_visit_stats', { p_today: iso(today) }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', iso(today - 6 * DAY)),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', iso(from30)),
    supabase.from('test_attempts').select('id', { count: 'exact', head: true }),
    supabase.from('test_attempts').select('id', { count: 'exact', head: true }).gte('created_at', iso(today - 6 * DAY)),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', iso(today)),
    fetchAll<{ user_id: string; started_at: string }>((from, to) =>
      supabase.from('mock_starts').select('user_id, started_at').gte('started_at', iso(from30)).order('started_at', { ascending: false }).range(from, to),
    ),
  ])

  // Visit numbers are computed inside Postgres (admin_visit_stats) — no page_views rows are downloaded.
  const v = (viewsRes.error ? null : viewsRes.data) as {
    daily: DayPoint[]
    last7: number
    unique7: number
    last30: number
    unique30: number
    topPages: { path: string; views: number }[]
  } | null
  // If the SQL function is missing (migration not run) keep 30 empty days so the panel still renders.
  const days: DayPoint[] =
    v?.daily ??
    Array.from({ length: 30 }, (_, i) => ({
      date: new Date(from30 + i * DAY + 5 * 3600_000).toISOString().slice(0, 10),
      views: 0,
      visitors: 0,
    }))
  const last7 = v?.last7 ?? 0
  const unique7 = v?.unique7 ?? 0
  const last30 = v?.last30 ?? 0
  const unique30 = v?.unique30 ?? 0
  const todayPoint: DayPoint = days[days.length - 1]

  const plans = { pro: 0, trial: 0, free: 0 }
  for (const u of planRes.error ? [] : planRes.data) {
    const info = planInfo(u)
    if (info.plan === 'free') plans.free++
    else if (info.trialDaysLeft) plans.trial++
    else plans.pro++
  }
  const atts = attRes.error ? [] : attRes.data
  const fulls = atts.filter((a) => a.subject === 'full' && a.composite > 0)
  const buckets = [
    { label: '< 1000', count: 0 },
    { label: '1000–1199', count: 0 },
    { label: '1200–1399', count: 0 },
    { label: '1400+', count: 0 },
  ]
  for (const a of fulls) buckets[a.composite < 1000 ? 0 : a.composite < 1200 ? 1 : a.composite < 1400 ? 2 : 3].count++
  let cor = 0
  let tot = 0
  const mockCount = new Map<string, number>()
  for (const a of atts) {
    cor += a.correct_count
    tot += a.correct_count + a.incorrect_count + a.omitted_count
    mockCount.set(a.test_label, (mockCount.get(a.test_label) ?? 0) + 1)
  }

  // ---- funnel: visitors → registrations → started a mock → finished a mock ----
  const starts = startsRes.error ? [] : startsRes.data
  const period = (since: number, visitors: number, registrations: number): FunnelPeriod => {
    const st = starts.filter((r) => new Date(r.started_at).getTime() >= since)
    const co = atts.filter((r) => new Date(r.created_at).getTime() >= since)
    return {
      visitors,
      registrations,
      startedUsers: new Set(st.map((r) => r.user_id)).size,
      startedTotal: st.length,
      completedUsers: new Set(co.map((r) => r.user_id)).size,
      completedTotal: co.length,
    }
  }
  const funnel = {
    today: period(today, todayPoint.visitors, usersToday.count ?? 0),
    d7: period(today - 6 * DAY, unique7, users7.count ?? 0),
    d30: period(from30, unique30, users30.count ?? 0),
  }

  const stats: SiteStats = {
    visits: {
      today: todayPoint.views,
      uniqueToday: todayPoint.visitors,
      last7,
      unique7,
      last30,
      unique30,
      daily: days,
      topPages: v?.topPages ?? [],
    },
    users: { total: usersTotal.count ?? 0, new7: users7.count ?? 0, new30: users30.count ?? 0 },
    attempts: { total: attTotal.count ?? 0, last7: att7.count ?? 0 },
    insights: {
      plans,
      last30Attempts: atts.length,
      avgFull: fulls.length ? Math.round(fulls.reduce((n, a) => n + a.composite, 0) / fulls.length) : null,
      accuracy: tot ? Math.round((cor / tot) * 100) : null,
      buckets,
      topMocks: [...mockCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, count })),
    },
    funnel,
    migrationNeeded: !!viewsRes.error,
  }
  return NextResponse.json(stats)
}
