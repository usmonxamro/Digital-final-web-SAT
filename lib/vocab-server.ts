import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { VocabSubject, VocabWord } from '@/lib/vocab'

/** Kirgan o'quvchining id'si (sayt sessiyasi), yo'q bo'lsa null. */
export async function currentUserId(): Promise<string | null> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value)?.userId ?? null
}

export const NO_VOCAB_TABLE = "Avval Supabase'da v111_vocab.sql ni ishga tushiring."

/* So'zlar ro'yxati xotirada 2 daqiqa saqlanadi: har bir o'quvchi so'rovida bazaga bormaslik uchun (bepul tarif yuklamasi). */
const TTL_MS = 120_000
const cache = new Map<string, { at: number; words: VocabWord[] }>()

export function bustVocabCache() {
  cache.clear()
}

export async function loadWords(subject: VocabSubject): Promise<VocabWord[]> {
  const hit = cache.get(subject)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.words
  const { data, error } = await supabaseAdmin()
    .from('vocab_words')
    .select('id, en, uz, cat, example')
    .eq('subject', subject)
    .eq('active', true)
    .order('id')
    .limit(5000)
  if (error) throw error
  const words = (data ?? []) as VocabWord[]
  cache.set(subject, { at: Date.now(), words })
  return words
}
