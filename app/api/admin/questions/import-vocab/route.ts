import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { cleanVocab } from '@/lib/question-vocab'
import { parseVocabSource } from '@/lib/vocab-parse'

/**
 * "Lug‘at yuklash" for one mock: body `{ label, kind: 'reading'|'math', text, dryRun? }`.
 * `text` is the TeX of a vocabulary PDF (\entry{word}{meaning}), JSON, or "12: word = meaning; ..." lines.
 * The question numbers map onto the mock's questions of that section in exam order (module 1 first, then module 2).
 * dryRun only reports what would happen.
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
  const text = typeof body?.text === 'string' ? body.text : ''
  const dryRun = body?.dryRun === true
  if (!label || !kind || !text.trim()) return NextResponse.json({ error: "Mock, bo'lim va lug'at matni kerak." }, { status: 400 })

  const parsed = parseVocabSource(text)
  if (parsed.byNumber.size === 0) return NextResponse.json({ error: "Matndan lug'at topilmadi. Format: «12: word = tarjima; word2 = tarjima» yoki .tex (\\entry{...}{...})." }, { status: 422 })

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('questions')
    .select('id, module_number, prompt, created_at')
    .eq('kind', kind)
    .eq('test_label', label)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = [...(data ?? [])].sort((a, b) => (a.module_number ?? 1) - (b.module_number ?? 1)) // stable: keeps insertion order inside a module
  if (rows.length === 0) return NextResponse.json({ error: `«${label}» mockida bu bo'limda savol yo'q.` }, { status: 404 })

  const plan: { id: string; n: number; prompt: string; vocab: ReturnType<typeof cleanVocab> }[] = []
  const outOfRange: number[] = []
  for (const [n, list] of [...parsed.byNumber.entries()].sort((a, b) => a[0] - b[0])) {
    const row = rows[n - 1]
    const vocab = cleanVocab(list)
    if (!row) {
      outOfRange.push(n)
      continue
    }
    if (vocab.length) plan.push({ id: String(row.id), n, prompt: String(row.prompt ?? '').replace(/\s+/g, ' ').slice(0, 90), vocab })
  }
  const withoutVocab = rows.length - plan.length
  const summary = {
    format: parsed.format,
    questions: rows.length,
    matched: plan.length,
    withoutVocab,
    outOfRange,
    sample: plan.slice(0, 3).map((p) => ({ n: p.n, prompt: p.prompt, words: p.vocab.slice(0, 4).map((v) => `${v.w} — ${v.uz}`) })),
  }
  if (dryRun) return NextResponse.json({ ...summary, dryRun: true })

  let saved = 0
  const failed: number[] = []
  for (let i = 0; i < plan.length; i += 10) {
    const chunk = plan.slice(i, i + 10)
    const res = await Promise.all(chunk.map((p) => supabase.from('questions').update({ vocab: p.vocab }).eq('id', p.id)))
    res.forEach((r, k) => (r.error ? failed.push(chunk[k].n) : saved++))
  }
  if (saved === 0 && failed.length) return NextResponse.json({ error: "Saqlanmadi (v114 SQL ishga tushirilganmi?)." }, { status: 500 })
  return NextResponse.json({ ...summary, saved, failed })
}
