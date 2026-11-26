import { supabaseAdmin } from '@/lib/supabase'

/**
 * Site visit counter. The database (site_stats, key = 'visits') is the single
 * source of truth: every visit is one atomic `+1` (increment_visits(), see
 * supabase/v120_visits_stats.sql) and every reader gets the same number, no
 * matter which serverless instance answers. Nothing is kept in memory.
 */
export async function addVisit(): Promise<void> {
  try {
    await supabaseAdmin().rpc('increment_visits')
  } catch {
    // best-effort: a lost visit must never break the page
  }
}

export async function getVisits(): Promise<number> {
  try {
    const { data } = await supabaseAdmin().from('site_stats').select('value').eq('key', 'visits').maybeSingle()
    return Number(data?.value ?? 0)
  } catch {
    return 0
  }
}
