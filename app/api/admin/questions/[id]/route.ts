import { NextRequest, NextResponse } from 'next/server'
import { invalidateMockPdf, invalidateMockPdfForQuestions } from '@/lib/mock-pdf-cache'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { validateQuestions } from '@/lib/admin-schema'
import { rescoreAttemptsForQuestion, notifyRescoredStudents } from '@/lib/rescoring'
import type { Question } from '@/lib/test-data'
import { invalidateCounts } from '@/lib/mock-catalog'


/**
 * Single-question lookup/edit/delete, keyed by the question's own database
 * id (a uuid Supabase generates automatically — never typed by the admin).
 * Backs the admin panel's "savol ID bo'yicha qidirish" tool: paste an id
 * you already have (e.g. copied from a module's edit view), jump straight
 * to that one question, fix a typo, save — without re-pasting the whole
 * 22/27/44-question module.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const { id } = await params

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server sozlanmagan.' }, { status: 503 })
  }

  const { data, error } = await supabase.from('questions').select('*').eq('id', id).maybeSingle()
  if (error) {
    return NextResponse.json({ error: `Qidirishda xatolik: ${error.message}` }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: `"${id}" ID'li savol topilmadi.` }, { status: 404 })
  }

  const question = {
    id: data.id,
    kind: data.kind,
    type: data.type,
    difficulty: data.difficulty ?? undefined,
    domain: data.domain ?? undefined,
    passage: data.passage ?? undefined,
    underline: data.underline ?? undefined,
    prompt: data.prompt,
    equations: data.equations ?? undefined,
    image: data.image ?? undefined,
    choices: data.choices ?? undefined,
    correct: data.correct ?? undefined,
    correctValue: data.correct_value ?? undefined,
    explanation: data.explanation ?? undefined,
    layout: data.layout ?? undefined,
    testLabel: data.test_label ?? undefined,
    moduleNumber: data.module_number ?? undefined,
  }
  return NextResponse.json({ question })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  invalidateCounts()
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const { id } = await params

  const body = await req.json().catch(() => null)
  const question: unknown = body?.question
  // A question may still be without its answer key (it is filled in on the answer sheet).
  const errors = validateQuestions([question], { requireAnswers: false })
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message, errors }, { status: 400 })
  }
  const q = question as Question

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server sozlanmagan.' }, { status: 503 })
  }

  // Fetch the current answer key + test_label before overwriting, so we can
  // tell whether this PATCH actually changed the answer (and, if so, which
  // mock test's already-submitted attempts need re-scoring below).
  const { data: before } = await supabase
    .from('questions')
    .select('correct, correct_value, test_label')
    .eq('id', id)
    .maybeSingle()

  const update: Record<string, unknown> = {
    type: q.type ?? 'mcq',
    difficulty: q.difficulty ?? null,
    domain: q.domain ?? null,
    passage: q.passage ?? null,
    underline: q.underline ?? null,
    prompt: q.prompt,
    equations: q.equations ?? null,
    image: q.image ?? null,
    choices: q.choices ?? null,
    correct: q.correct ?? null,
    correct_value: q.correctValue ?? null,
    explanation: q.explanation ?? null,
  }
  if ('layout' in q) update.layout = q.layout ?? null
  const { error } = await supabase.from('questions').update(update).eq('id', id)

  if (error) {
    return NextResponse.json({ error: `Saqlashda xatolik: ${error.message}` }, { status: 500 })
  }

  await invalidateMockPdf(supabase, [before?.test_label])

  // The answer key changed (e.g. via "Javob kiritish" or a manual fix) —
  // re-score any already-submitted attempt of this mock test that answered
  // this exact question, so a student who was actually right (against the
  // now-corrected key) gets their score updated instead of staying wrong
  // forever. Best-effort and silent: never blocks the save response.
  let rescored = 0
  let notified = 0
  const answerChanged =
    before && (before.correct !== (q.correct ?? null) || before.correct_value !== (q.correctValue ?? null))
  if (answerChanged) {
    const result = await rescoreAttemptsForQuestion(supabase, id, before!.test_label ?? null, q)
    rescored = result.rescored
    notified = await notifyRescoredStudents(supabase, result.changes)
  }

  return NextResponse.json({ ok: true, rescored, notified })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  invalidateCounts()
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const { id } = await params

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server sozlanmagan.' }, { status: 503 })
  }

  await invalidateMockPdfForQuestions(supabase, [id]) // before the row is gone, to still know its mock
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: `O'chirishda xatolik: ${error.message}` }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
