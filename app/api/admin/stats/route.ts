import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { tashkentDayStart } from '@/lib/exam-limits'
import { fetchAll } from '@/lib/db-paginate'

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

  const [viewsRes, usersTotal, users7, users30, attTotal, att7] = await Promise.all([
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
    migrationNeeded: !!viewsRes.error,
  }
  return NextResponse.json(stats)
}
