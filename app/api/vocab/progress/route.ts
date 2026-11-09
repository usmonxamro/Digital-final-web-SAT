import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isMissingTable } from '@/lib/db-errors'
import { currentUserId, NO_VOCAB_TABLE } from '@/lib/vocab-server'
import { nextState, type LeitnerState } from '@/lib/vocab'

const MAX_RESULTS = 100
/** Bitta o'quvchidan juda tez-tez kelayotgan so'rovlarni xotirada (bazaga yozmasdan) cheklaydi. */
const last = new Map<string, number>()

/**
 * POST { results: [{ id: so'z id, ok: true|false }] } → intervalli takrorlash holatini yangilaydi.
 * Quiz TUGAGANDA bir marta chaqiriladi (har javobda emas) — baza va Vercel yuklamasini kamaytiradi.
 */
export async function POST(req: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })

  const now = Date.now()
  if (now - (last.get(userId) ?? 0) < 1500) return NextResponse.json({ error: 'Biroz kuting.' }, { status: 429 })
  last.set(userId, now)
  if (last.size > 2000) for (const [k, t] of last) if (now - t > 60_000) last.delete(k)

  const body = (await req.json().catch(() => null)) as { results?: { id?: unknown; ok?: unknown }[] } | null
  const results = (body?.results ?? [])
    .filter((r) => Number.isInteger(r?.id) && typeof r?.ok === 'boolean')
    .slice(0, MAX_RESULTS) as { id: number; ok: boolean }[]
  if (!results.length) return NextResponse.json({ ok: true, saved: 0 })

  const student = `u:${userId}`
  const ids = [...new Set(results.map((r) => r.id))]
  try {
    const sb = supabaseAdmin()
    const [{ data: valid }, { data: prev, error: pErr }] = await Promise.all([
      sb.from('vocab_words').select('id').in('id', ids),
      sb.from('vocab_progress').select('word_id, box, right_n, wrong_n, last_wrong_at, due_at').eq('student', student).in('word_id', ids),
    ])
    if (pErr) throw pErr
    const ok = new Set((valid ?? []).map((v) => v.id as number))
    const state = new Map<number, LeitnerState>()
    for (const p of prev ?? []) state.set(p.word_id as number, p as LeitnerState)
    for (const r of results) {
      if (!ok.has(r.id)) continue
      state.set(r.id, nextState(state.get(r.id), r.ok, new Date()))
    }
    const rows = [...state.entries()]
      .filter(([id]) => ok.has(id))
      .map(([word_id, s]) => ({ student, word_id, ...s, updated_at: new Date().toISOString() }))
    if (rows.length) {
      const { error } = await sb.from('vocab_progress').upsert(rows, { onConflict: 'student,word_id' })
      if (error) throw error
    }
    return NextResponse.json({ ok: true, saved: rows.length })
  } catch (e) {
    if (isMissingTable(e as { code?: string; message?: string })) return NextResponse.json({ error: NO_VOCAB_TABLE }, { status: 503 })
    return NextResponse.json({ error: 'Saqlab bo‘lmadi.' }, { status: 500 })
  }
}
