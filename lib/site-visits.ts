import { supabaseAdmin } from '@/lib/supabase'

/**
 * Site visit counter. Visits are counted in memory and written to the
 * database (site_stats, key = 'visits') at most once an hour — the database is
 * never touched per visit. The number shown = value in the database + visits
 * counted since the last write.
 */
const HOUR = 60 * 60_000
let base: number | null = null // value last read from / written to the database
let pending = 0 // visits counted since then
let lastFlush = 0
let inflight: Promise<void> | null = null

export function addVisit() {
  pending++
}

async function flush(): Promise<void> {
  const sending = pending
  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase.from('site_stats').select('value').eq('key', 'visits').maybeSingle()
    if (error) throw error
    const next = Number(data?.value ?? 0) + sending
    const { error: upErr } = await supabase.from('site_stats').upsert({ key: 'visits', value: next, updated_at: new Date().toISOString() })
    if (upErr) throw upErr
    base = next
    pending -= sending
  } catch {
    // Table missing (SQL not run) or database busy: keep counting in memory, retry next hour.
  } finally {
    lastFlush = Date.now()
  }
}

export async function getVisits(): Promise<number> {
  if (lastFlush === 0 || Date.now() - lastFlush >= HOUR) {
    if (!inflight) {
      inflight = flush().finally(() => {
        inflight = null
      })
    }
    await inflight
  }
  return (base ?? 0) + pending
}
