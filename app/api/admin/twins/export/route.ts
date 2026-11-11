import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { assemblePdfItems } from '@/lib/mock-pdf-items'
import { rowToQuestion } from '@/lib/bot-question-map'
import type { Question } from '@/lib/test-data'
import { familyOf } from '@/lib/twins'

/**
 * GET ?label=MOCK[&missing=1] → the mock's Math questions in exam order, in the admin import JSON format plus
 * "sourceId" — paste into GPT / Claude with the twin prompt, then import the answer in «Mock tuzish → Twinlar».
 * missing=1 → only questions whose family has no twin yet.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const label = req.nextUrl.searchParams.get('label')?.trim()
  if (!label) return NextResponse.json({ error: 'label kerak' }, { status: 400 })
  const onlyMissing = !!req.nextUrl.searchParams.get('missing')
  const sb = supabaseAdmin()
  const [{ data: cfg }, { data: rows, error }] = await Promise.all([
    sb.from('test_configs').select('subject, placement, scored, math_layout').eq('test_label', label).maybeSingle(),
    sb.from('questions').select('*').eq('test_label', label).eq('kind', 'math').order('created_at').order('id'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const famOf = new Map((rows ?? []).map((r) => [r.id as string, familyOf(r)]))
  let have = new Set<string>()
  if (onlyMissing) {
    const { data: tw } = await sb.from('question_twins').select('family_id').in('family_id', [...new Set(famOf.values())])
    have = new Set((tw ?? []).map((t) => t.family_id as string))
  }
  const qs = (rows ?? []).map(rowToQuestion)
  const items = await assemblePdfItems(
    cfg ? { subject: cfg.subject, placement: cfg.placement, scored: cfg.scored, mathLayout: cfg.math_layout } : { subject: 'math' },
    async (k) => (k === 'math' ? qs : []),
  )
  const out = items
    .map((it, i) => ({ no: i + 1, q: it.question as Question & { kind?: string } }))
    .filter(({ q }) => !onlyMissing || !have.has(famOf.get(q.id as string) ?? ''))
    .map(({ no, q }) => {
      const { id, kind: _k, moduleNumber: _m, layout: _l, ...rest } = q
      void _k
      void _m
      void _l
      return { sourceId: id, no, ...rest }
    })
  return NextResponse.json(out)
}
