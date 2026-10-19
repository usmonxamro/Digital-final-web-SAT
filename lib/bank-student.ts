import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from '@/lib/db-paginate'

export type BankMeta = { id: string; domain: string; topic_code: string; topic: string; difficulty: string }

let cache: { at: number; rows: BankMeta[] } | null = null

/** Verified questions only (needs_check = false), light columns; cached for 5 minutes per server instance. */
export async function bankMeta(supabase: SupabaseClient): Promise<BankMeta[] | null> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.rows
  const { data, error } = await fetchAll<BankMeta>((from, to) =>
    supabase
      .from('question_bank')
      .select('id, domain, topic_code, topic, difficulty')
      .eq('needs_check', false)
      .order('id')
      .range(from, to),
  )
  if (error) return null
  cache = { at: Date.now(), rows: data }
  return data
}

/** What the student has answered so far: question id → was the last answer right. Empty if the table is missing. */
export async function bankAnswers(supabase: SupabaseClient, userId: string): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>()
  const { data, error } = await fetchAll<{ question_id: string; correct: boolean }>((from, to) =>
    supabase.from('bank_answers').select('question_id, correct').eq('user_id', userId).order('question_id').range(from, to),
  )
  if (!error) for (const r of data) out.set(r.question_id, r.correct)
  return out
}
