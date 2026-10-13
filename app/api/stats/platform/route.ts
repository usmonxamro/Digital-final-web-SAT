import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getVisits } from '@/lib/site-visits'

/**
 * Platform-wide numbers for the dashboard: how many students have joined and
 * where the current student ranks (by best SAT score on the 1600 scale).
 * Computed at most once every 15 minutes and kept in memory — every student's
 * dashboard reuses the same result instead of scanning the tables again.
 */
type Snapshot = { at: number; total: number; best: Map<string, number> }
const TTL_MS = 15 * 60_000
let cache: Snapshot | null = null
let inflight: Promise<Snapshot> | null = null

async function build(): Promise<Snapshot> {
  const supabase = supabaseAdmin()
  const { count } = await supabase.from('users').select('id', { count: 'exact', head: true })
  const best = new Map<string, number>()
  const PAGE = 1000
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data } = await supabase
      .from('test_attempts')
      .select('user_id, composite, subject')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    for (const r of data ?? []) {
      const id = r.user_id as string
      // Single-subject tests count on the 1600 scale (the other section = 200).
      const c = (r.composite as number) + (r.subject === 'full' ? 0 : 200)
      if (c > (best.get(id) ?? 0)) best.set(id, c)
    }
    if (!data || data.length < PAGE) break
  }
  return { at: Date.now(), total: count ?? 0, best }
}

async function snapshot(): Promise<Snapshot> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache
  if (!inflight) {
    inflight = build()
      .then((s) => (cache = s))
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export async function GET() {
  try {
    const snap = await snapshot()
    const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
    const mine = session ? snap.best.get(session.userId) : undefined
    let rank: number | null = null
    if (mine) {
      rank = 1
      for (const v of snap.best.values()) if (v > mine) rank++
    }
    return NextResponse.json({ totalUsers: snap.total, ranked: snap.best.size, rank, visits: await getVisits() })
  } catch {
    return NextResponse.json({ totalUsers: null, ranked: 0, rank: null, visits: null })
  }
}
