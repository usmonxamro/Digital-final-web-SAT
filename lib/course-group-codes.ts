import { randomInt } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { groupBySlug } from '@/lib/course-groups'

/**
 * One shared JOIN CODE per course group (e.g. NOYABR-TGHS9G). The teacher gives it to the whole
 * Telegram group; each student types it once on the site (Kurslar → Kod bilan qo'shilish) and the
 * membership is stored on their account — they are never asked again.
 *
 * Stored in `course_group_codes` (v75). Regenerating a code stops NEW students from using the old
 * one; students who already joined keep their access.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O, 1/I/L — easy to read from a chat message
const PREFIX: Record<string, string> = { nov: 'NOYABR', dec: 'DEKABR' }

export function newJoinCode(slug: string): string {
  let tail = ''
  for (let i = 0; i < 6; i++) tail += ALPHABET[randomInt(ALPHABET.length)]
  return `${PREFIX[slug] ?? slug.toUpperCase()}-${tail}`
}

/** "  noyabr – tghs9g " → "NOYABR-TGHS9G" */
export function normalizeJoinCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, '')
}

export type GroupCodeRow = { group_slug: string; code: string; active: boolean }

/** Which group (if any) this shared code opens. Inactive codes open nothing. */
export async function groupForJoinCode(
  supabase: SupabaseClient,
  raw: string,
): Promise<{ slug: string } | 'missing-table' | null> {
  const code = normalizeJoinCode(raw)
  if (!/^[A-Z0-9]{2,12}-[A-Z0-9]{4,12}$/.test(code)) return null
  const { data, error } = await supabase.from('course_group_codes').select('group_slug, active').eq('code', code).maybeSingle()
  if (error) return error.code === '42P01' || error.code === 'PGRST205' ? 'missing-table' : null
  if (!data || !data.active || !groupBySlug(data.group_slug as string)) return null
  return { slug: data.group_slug as string }
}

/** Insert a fresh code for a group (retries on the very unlikely collision). */
export async function createJoinCode(supabase: SupabaseClient, slug: string, active = true) {
  for (let i = 0; i < 5; i++) {
    const code = newJoinCode(slug)
    const { error } = await supabase
      .from('course_group_codes')
      .upsert({ group_slug: slug, code, active, updated_at: new Date().toISOString() }, { onConflict: 'group_slug' })
    if (!error) return { code, error: null }
    if (error.code !== '23505') return { code: null, error }
  }
  return { code: null, error: { message: 'collision' } }
}
