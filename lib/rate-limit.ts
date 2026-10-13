import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Best-effort client IP (Vercel / proxies put it in x-forwarded-for). */
export function clientIp(req: NextRequest | Request): string {
  const h = req.headers
  // Behind Cloudflare the real visitor address is in cf-connecting-ip.
  const cf = h.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  return fwd || h.get('x-real-ip') || 'unknown'
}

/**
 * Sliding-window limiter backed by the `rate_events` table, so it holds across
 * serverless instances. Records the attempt FIRST and then counts, so a burst
 * of parallel requests can't all slip under the limit. Returns true when the
 * action is allowed. If the table is missing (SQL not run yet) it fails open.
 */
export async function rateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  try {
    const { data: mine, error: insErr } = await supabase.from('rate_events').insert({ key }).select('id').single()
    if (insErr || !mine) return true
    const since = new Date(Date.now() - windowSec * 1000).toISOString()
    const { count, error } = await supabase
      .from('rate_events')
      .select('id', { count: 'exact', head: true })
      .eq('key', key)
      .gte('created_at', since)
    if (error) return true
    if (Math.random() < 0.02) {
      await supabase
        .from('rate_events')
        .delete()
        .lt('created_at', new Date(Date.now() - 2 * 86400_000).toISOString())
    }
    if ((count ?? 0) > limit) {
      // Over the limit: don't let blocked attempts keep extending the window.
      await supabase.from('rate_events').delete().eq('id', mine.id)
      return false
    }
    return true
  } catch {
    return true
  }
}

/** Clears a key's history (e.g. after a successful login). */
export async function resetRateLimit(supabase: SupabaseClient, key: string) {
  try {
    await supabase.from('rate_events').delete().eq('key', key)
  } catch {
    // ignore
  }
}

/** Cheap per-instance limiter for high-volume, low-value endpoints (page-view tracking). */
const memory = new Map<string, { n: number; reset: number }>()
export function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const e = memory.get(key)
  if (!e || e.reset < now) {
    if (memory.size > 10_000) memory.clear()
    memory.set(key, { n: 1, reset: now + windowMs })
    return true
  }
  e.n++
  return e.n <= limit
}
