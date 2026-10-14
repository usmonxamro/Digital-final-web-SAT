import type { SupabaseClient } from '@supabase/supabase-js'
import { planInfo } from '@/lib/plan'

/** 'premium' (paid or free-trial Pro) or 'free' for a user id. Fails safe to 'free'. */
export async function planOf(supabase: SupabaseClient, userId: string): Promise<'premium' | 'free'> {
  const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
  return planInfo(data).plan
}
