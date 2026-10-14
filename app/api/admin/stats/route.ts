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
  migrationNeeded: boolean
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

  const [attRes, planRes, viewsRes, usersTotal, users7, users30, attTotal, att7] = await Promise.all([
    fetchAll<{ test_label: string; composite: number; subject: string; correct_count: number; incorrect_count: number; omitted_count: number }>((from, to) =>
      supabase
        .from('test_attempts')
        .select('test_label, composite, subject, correct_count, incorrect_count, omitted_count')
        .gte('created_at', iso(from30))
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
    fetchAll<{ plan: string | null; premium_until: string | null }>((from, to) =>
      supabase.from('users').select('plan, premium_until').order('created_at', { ascending: false }).range(from, to),
    ),
    fetchAll<{ visitor_id: string; path: string; created_at: string }>((from, to) =>
      supabase
        .from('page_views')
        .select('visitor_id, path, created_at')
        .gte('created_at', iso(from30))
        .order('id', { ascending: false })
        .range(from, to),
    ),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', iso(today - 6 * DAY)),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', iso(from30)),
    supabase.from('test_attempts').select('id', { count: 'exact', head: true }),
    supabase.from('test_attempts').select('id', { count: 'exact', head: true }).gte('created_at', iso(today - 6 * DAY)),
  ])

  const rows = viewsRes.error ? [] : viewsRes.data
  const days: DayPoint[] = []
  const dayVisitors: Set<string>[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(from30 + i * DAY + 5 * 3600_000) // shift into Tashkent date
    days.push({ date: d.toISOString().slice(0, 10), views: 0, visitors: 0 })
    dayVisitors.push(new Set())
  }
  const pages = new Map<string, number>()
  const u7 = new Set<string>()
  const u30 = new Set<string>()
  let last7 = 0
  for (const r of rows) {
    const t = new Date(r.created_at as string).getTime()
    const idx = Math.floor((t - from30) / DAY)
    if (idx < 0 || idx >= 30) continue
    days[idx].views++
    dayVisitors[idx].add(r.visitor_id as string)
    u30.add(r.visitor_id as string)
    if (t >= today - 6 * DAY) {
      last7++
      u7.add(r.visitor_id as string)
    }
    pages.set(r.path as string, (pages.get(r.path as string) ?? 0) + 1)
  }
  days.forEach((d, i) => (d.visitors = dayVisitors[i].size))

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

  const stats: SiteStats = {
    visits: {
      today: days[29].views,
      uniqueToday: days[29].visitors,
      last7,
      unique7: u7.size,
      last30: rows.length,
      unique30: u30.size,
      daily: days,
      topPages: [...pages.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([path, views]) => ({ path, views })),
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
    migrationNeeded: !!viewsRes.error,
  }
  return NextResponse.json(stats)
}
