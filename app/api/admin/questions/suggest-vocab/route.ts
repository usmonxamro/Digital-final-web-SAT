import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { cleanVocab } from '@/lib/question-vocab'
import { suggestForMock } from '@/lib/vocab-suggest'

/**
 * "Ro‘yxatdan avto-taklif": body `{ label, kind }` → for each question of that section (exam order) the words of the site's
 * word list (vocab_words) found in its text, the vocabulary already saved on it, and unfamiliar words the admin may add by hand.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const label = typeof body?.label === 'string' ? body.label.trim() : ''
  const kind = body?.kind === 'reading' || body?.kind === 'math' ? body.kind : null
  if (!label || !kind) return NextResponse.json({ error: "Mock va bo'lim kerak." }, { status: 400 })

  const supabase = supabaseAdmin()
  const [{ data: qs, error }, { data: words }] = await Promise.all([
    supabase
      .from('questions')
      .select('id, module_number, prompt, passage, choices, vocab')
      .eq('kind', kind)
      .eq('test_label', label)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    supabase.from('vocab_words').select('en, uz, q_picked, q_skipped, q_hidden').eq('subject', 'math').eq('active', true).limit(5000),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = [...(qs ?? [])].sort((a, b) => (a.module_number ?? 1) - (b.module_number ?? 1))
  if (rows.length === 0) return NextResponse.json({ error: `«${label}» mockida bu bo'limda savol yo'q.` }, { status: 404 })

  let dict = (words ?? []) as { en: string; uz: string; q_picked?: number; q_skipped?: number; q_hidden?: boolean }[]
  let learning = true
  if (!words) {
    // v115 columns not created yet → plain list, no learning
    learning = false
    const { data: plain } = await supabase.from('vocab_words').select('en, uz').eq('subject', 'math').eq('active', true).limit(5000)
    dict = (plain ?? []) as typeof dict
  }
  const sugg = suggestForMock(rows, dict.map((w) => ({ en: w.en, uz: w.uz, picked: w.q_picked, skipped: w.q_skipped, hidden: w.q_hidden })))
  return NextResponse.json({
    dictionary: dict.length,
    learning,
    questions: rows.map((r, i) => ({
      id: String(r.id),
      n: i + 1,
      prompt: String(r.prompt ?? '').replace(/\s+/g, ' ').slice(0, 160),
      existing: cleanVocab(r.vocab),
      suggestions: sugg[i].suggestions,
      unknown: sugg[i].unknown,
    })),
  })
}
