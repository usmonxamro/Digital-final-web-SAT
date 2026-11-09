import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isMissingTable } from '@/lib/db-errors'
import { currentUserId, loadWords, NO_VOCAB_TABLE } from '@/lib/vocab-server'
import type { VocabProgress, VocabSubject } from '@/lib/vocab'

export type VocabSessionData = {
  words: { id: number; en: string; uz: string; cat: string; example?: string | null }[]
  progress: VocabProgress[]
}

/**
 * GET ?subject=math → quiz uchun so'zlar (keshlangan) + shu o'quvchining taraqqiyoti.
 * Telegram akkaunti bilan bog'langan bo'lsa, botdagi taraqqiyot ham qo'shiladi (har bir so'z bo'yicha eng yangisi olinadi).
 * Bitta sessiya = shu bitta so'rov + oxirida bitta POST; savollar brauzerda tuziladi.
 */
export async function GET(req: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })

  const subject: VocabSubject = req.nextUrl.searchParams.get('subject') === 'english' ? 'english' : 'math'
  try {
    const words = await loadWords(subject)

    const sb = supabaseAdmin()
    const students = [`u:${userId}`]
    const { data: accs } = await sb.from('tg_accounts').select('tg_id').eq('user_id', userId).limit(5)
    for (const a of accs ?? []) students.push(`t:${a.tg_id}`)

    const { data: rows, error } = await sb
      .from('vocab_progress')
      .select('word_id, box, right_n, wrong_n, last_wrong_at, due_at, updated_at')
      .in('student', students)
      .limit(5000)
    if (error) throw error

    const best = new Map<number, VocabProgress & { updated_at: string }>()
    for (const r of (rows ?? []) as (VocabProgress & { updated_at: string })[]) {
      const cur = best.get(r.word_id)
      if (!cur || r.updated_at > cur.updated_at) best.set(r.word_id, r)
    }
    const ids = new Set(words.map((w) => w.id))
    const progress = [...best.values()].filter((p) => ids.has(p.word_id)).map(({ updated_at: _u, ...p }) => p)

    return NextResponse.json({ words, progress } satisfies VocabSessionData, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    const err = e as { code?: string; message?: string }
    if (isMissingTable(err)) return NextResponse.json({ error: NO_VOCAB_TABLE, setup: true }, { status: 503 })
    return NextResponse.json({ error: "Lug'atni yuklab bo'lmadi." }, { status: 500 })
  }
}
