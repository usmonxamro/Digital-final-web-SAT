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
  // One row per student (best score on the 1600 scale), grouped inside Postgres — see platform_best_scores().
  const { data } = await supabase.rpc('platform_best_scores')
  for (const r of (data ?? []) as { user_id: string; best: number }[]) best.set(r.user_id, r.best)
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
