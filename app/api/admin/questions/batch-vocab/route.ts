import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { cleanVocab } from '@/lib/question-vocab'
import { bustVocabCache } from '@/lib/vocab-server'

/**
 * Bulk save of question vocabularies: body `{ items: [{ id, vocab: [{ w, uz, ex? }] }] }` (an empty `vocab` clears it).
 * GET ?label=<mock> lists that mock's questions with their current vocabulary — the sheet to fill in.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const items: unknown = body?.items
  if (!Array.isArray(items)) return NextResponse.json({ error: "'items' massiv bo'lishi kerak." }, { status: 400 })

  const supabase = supabaseAdmin()
  let saved = 0
  const failed: string[] = []
  for (const raw of items) {
    const id = raw && typeof raw === 'object' ? (raw as { id?: unknown }).id : null
    if (typeof id !== 'string') continue
    const list = cleanVocab((raw as { vocab?: unknown }).vocab)
    const { error } = await supabase.from('questions').update({ vocab: list.length ? list : null }).eq('id', id)
    if (error) failed.push(id)
    else saved++
  }
  // ---- the site's word list learns from the admin ----
  let addedToDictionary = 0
  let correctedInDictionary = 0
  let learned = 0
  let learningOn = true
  const dict: unknown = body?.dictionary // [{ w, uz }]: new words typed by hand AND translations the admin corrected
  if (Array.isArray(dict) && dict.length) {
    const wanted = cleanVocab(dict, 300)
    if (wanted.length) {
      const { data: have } = await supabase.from('vocab_words').select('id, en, uz').eq('subject', 'math').limit(5000)
      const byEn = new Map((have ?? []).map((r) => [String(r.en).toLowerCase(), r as { id: number; en: string; uz: string }]))
      const fresh: { subject: string; en: string; uz: string; cat: string; source: string }[] = []
      for (const v of wanted) {
        const row = byEn.get(v.w.toLowerCase())
        if (!row) fresh.push({ subject: 'math', en: v.w, uz: v.uz, cat: 'Umumiy', source: 'admin' })
        else if (row.uz.trim() !== v.uz) {
          const { error } = await supabase.from('vocab_words').update({ uz: v.uz, needs_review: false, updated_at: new Date().toISOString() }).eq('id', row.id)
          if (!error) correctedInDictionary++
        }
      }
      if (fresh.length) {
        const { error } = await supabase.from('vocab_words').insert(fresh)
        if (!error) addedToDictionary = fresh.length
      }
    }
  }
  const fb = (body?.feedback ?? {}) as { picked?: unknown; skipped?: unknown; hide?: unknown }
  const names = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase()).slice(0, 400) : [])
  const picked = names(fb.picked)
  const skipped = names(fb.skipped)
  const hide = names(fb.hide)
  if (picked.length || skipped.length || hide.length) {
    const { data: rows, error } = await supabase.from('vocab_words').select('id, en, q_picked, q_skipped').eq('subject', 'math').limit(5000)
    if (error) learningOn = false // v115 not run yet
    else {
      const byEn = new Map((rows ?? []).map((r) => [String(r.en).toLowerCase(), r as { id: number; q_picked: number; q_skipped: number }]))
      const patch = new Map<number, { q_picked?: number; q_skipped?: number; q_hidden?: boolean }>()
      const cur = (r: { id: number; q_picked: number; q_skipped: number }) => patch.get(r.id) ?? { q_picked: r.q_picked, q_skipped: r.q_skipped }
      for (const w of picked) {
        const r = byEn.get(w)
        if (r) patch.set(r.id, { ...cur(r), q_picked: (cur(r).q_picked ?? 0) + 1 })
      }
      for (const w of skipped) {
        const r = byEn.get(w)
        if (r) patch.set(r.id, { ...cur(r), q_skipped: (cur(r).q_skipped ?? 0) + 1 })
      }
      for (const w of hide) {
        const r = byEn.get(w)
        if (r) patch.set(r.id, { ...cur(r), q_hidden: true })
      }
      for (const [id, p] of patch) {
        const { error: e2 } = await supabase.from('vocab_words').update(p).eq('id', id)
        if (!e2) learned++
      }
    }
  }
  if (addedToDictionary || correctedInDictionary || learned) bustVocabCache()
  if (saved === 0 && failed.length) return NextResponse.json({ error: "Saqlanmadi (v114 SQL ishga tushirilganmi?).", failed }, { status: 500 })
  return NextResponse.json({ saved, failed, addedToDictionary, correctedInDictionary, learned, learningOn })
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const label = req.nextUrl.searchParams.get('label')?.trim()
  if (!label) return NextResponse.json({ error: "'label' kerak." }, { status: 400 })
  const { data, error } = await supabaseAdmin()
    .from('questions')
    .select('id, kind, module_number, prompt, passage, underline, vocab')
    .eq('test_label', label)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data ?? [] })
}
