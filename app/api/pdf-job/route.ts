import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { assemblePdfItems } from '@/lib/mock-pdf-items'
import type { Question } from '@/lib/test-data'

/**
 * Questions of one mock for the PDF job (the teacher's computer runs `build_mock_pdfs.py`, which opens /pdf-job and
 * prints it to a vector PDF). Protected by the PDF_JOB_KEY secret from the server environment — without it (or without
 * the variable being set) this answers 404. The answer key is never included: the PDF holds questions only.
 */
function keyOk(given: string | null): boolean {
  const secret = process.env.PDF_JOB_KEY ?? ''
  if (secret.length < 16 || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  const label = req.nextUrl.searchParams.get('label')?.trim()
  if (!keyOk(req.nextUrl.searchParams.get('key')) || !label) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
    const supabase = supabaseAdmin()
    const { data: cfg } = await supabase.from('test_configs').select('subject, placement, scored, math_layout').eq('test_label', label).maybeSingle()
    const rows = await Promise.all(
      (['reading', 'math'] as const).map(async (kind) => {
        const { data } = await supabase
          .from('questions')
          .select('*')
          .eq('kind', kind)
          .eq('test_label', label)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
        return (data ?? []).map(
          (row): Question => ({
            id: row.id,
            type: row.type,
            difficulty: row.difficulty ?? undefined,
            domain: row.domain ?? undefined,
            passage: row.passage ?? undefined,
            underline: row.underline ?? undefined,
            prompt: row.prompt,
            equations: row.equations ?? undefined,
            image: row.image ?? undefined,
            choices: row.choices ?? undefined,
            layout: row.layout ?? undefined,
            moduleNumber: row.module_number === 1 || row.module_number === 2 ? row.module_number : undefined,
          }),
        )
      }),
    )
    const config = cfg ? { subject: cfg.subject, placement: cfg.placement, scored: cfg.scored, mathLayout: cfg.math_layout } : null
    // `items`: the questions in exam order with their module labels (used by the LaTeX engine of the PDF job);
    // `reading` / `math` + `config`: the raw lists (used by the browser engine, /pdf-job).
    const items = await assemblePdfItems(config, async (kind) => (kind === 'math' ? rows[1] : rows[0]))
    return NextResponse.json({ config, reading: rows[0], math: rows[1], items })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
