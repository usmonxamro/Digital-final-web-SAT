import type { SupabaseClient } from '@supabase/supabase-js'
import { planInfo } from '@/lib/plan'

/**
 * Limit tier for a user id: 'elite' (member of a course group), 'premium' (paid or free-trial Pro) or 'free'.
 * Fails safe to 'free'.
 */
export async function planOf(supabase: SupabaseClient, userId: string): Promise<'elite' | 'premium' | 'free'> {
  const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
  const { count, error } = await supabase.from('course_memberships').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if (!error && (count ?? 0) > 0) return 'elite'
  return planInfo(data).plan
}
