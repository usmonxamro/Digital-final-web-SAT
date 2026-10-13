import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingColumn } from '@/lib/db-columns'
import { validateQuestions } from '@/lib/admin-schema'
import type { Question, SectionKind } from '@/lib/test-data'


export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }

  const body = await req.json().catch(() => null)
  const kind: SectionKind | undefined = body?.kind
  const questions: unknown = body?.questions
  const testLabel: string | null = body?.testLabel?.trim() || null
  const moduleNumberRaw = body?.moduleNumber
  const moduleNumber: 1 | 2 | null = moduleNumberRaw === 1 || moduleNumberRaw === 2 ? moduleNumberRaw : null
  // When true, first deletes any existing rows for this exact
  // (test_label, kind, module_number) group before inserting — used by the
  // "testni tahrirlash" flow to replace a single module's questions
  // wholesale instead of appending duplicates.
  const replace: boolean = body?.replace === true

  if (kind !== 'reading' && kind !== 'math') {
    return NextResponse.json({ error: "\"kind\" \"reading\" yoki \"math\" bo'lishi kerak." }, { status: 400 })
  }

  // Answers aren't required at import time — the admin panel's "Javob
  // kiritish" (answer-entry) mode fills them in afterward, question by
  // question, via PATCH on /api/admin/questions/[id]. Structural validity
  // (prompt, choices, a provided answer being a real A/B/C/D) is still checked.
  const errors = validateQuestions(questions, { requireAnswers: false })
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message, errors }, { status: 400 })
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server sozlanmagan.' },
      { status: 503 },
    )
  }

  if (replace) {
    let delQuery = supabase.from('questions').delete().eq('kind', kind)
    delQuery = testLabel ? delQuery.eq('test_label', testLabel) : delQuery.is('test_label', null)
    delQuery = moduleNumber ? delQuery.eq('module_number', moduleNumber) : delQuery.is('module_number', null)
    const { error: delError } = await delQuery
    if (delError) {
      return NextResponse.json({ error: `Eski savollarni o'chirishda xatolik: ${delError.message}` }, { status: 500 })
    }
  }

  // A mock test's answer key is always entered by hand afterward, through
  // "Javob kiritish" — never trusted from an AI-generated JSON import, since
  // that's exactly where wrong answer keys have come from. Any correct /
  // correctValue the pasted JSON happens to carry is dropped on import;
  // skill-bank questions (testLabel null, no per-module answer-entry UI)
  // are unaffected, since there's no other way to fill those in.
  const forceManualAnswers = !!testLabel
  // Every row of this one INSERT would otherwise get the identical
  // `created_at` (Postgres now() is per-transaction), and the exam / admin
  // lists order by created_at — so ties came back in arbitrary order (and a
  // later UPDATE, e.g. saving answers, can move a row in the heap and
  // reshuffle it again). That is why questions (and the figures attached to
  // them) appeared under different numbers than in the pasted JSON. Stamp each
  // row with its own increasing timestamp so the JSON order is the order.
  const baseTime = Date.now()
  const rows = (questions as Question[]).map((q, i) => ({
    created_at: new Date(baseTime + i).toISOString(),
    kind,
    type: q.type ?? 'mcq',
    difficulty: q.difficulty ?? null,
    domain: q.domain ?? null,
    passage: q.passage ?? null,
    underline: q.underline ?? null,
    prompt: q.prompt,
    equations: q.equations ?? null,
    image: q.image ?? null,
    choices: q.choices ?? null,
    correct: forceManualAnswers ? null : q.correct ?? null,
    correct_value: forceManualAnswers ? null : q.correctValue ?? null,
    explanation: q.explanation ?? null,
    test_label: testLabel,
    module_number: moduleNumber,
  }))

  // Keep a question's saved block arrangement across JSON edits / re-imports.
  // Only sent when some question has one, so a database without the v36
  // `layout` column keeps working exactly as before.
  const withLayout = (questions as Question[]).some((q) => q.layout)
  const insertRows = withLayout
    ? rows.map((r, i) => ({ ...r, layout: (questions as Question[])[i].layout ?? null }))
    : rows
  let { data, error } = await supabase.from('questions').insert(insertRows).select('id')
  if (error && withLayout && isMissingColumn(error, 'layout')) {
    ;({ data, error } = await supabase.from('questions').insert(rows).select('id'))
  }

  if (error) {
    return NextResponse.json({ error: `Bazaga saqlashda xatolik: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, inserted: data?.length ?? 0 })
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server sozlanmagan.' },
      { status: 503 },
    )
  }

  const testLabel = req.nextUrl.searchParams.get('testLabel')
  const kind = req.nextUrl.searchParams.get('kind')
  const moduleParam = req.nextUrl.searchParams.get('module')

  // Full-question lookup for one module (or one test's kind), used by the
  // admin panel to prefill a module's existing questions before editing —
  // includes the row id, since editing/deleting a single question uses it.
  if (kind === 'reading' || kind === 'math') {
    let query = supabase.from('questions').select('*').eq('kind', kind).order('created_at', { ascending: true }).order('id', { ascending: true })
    query = testLabel ? query.eq('test_label', testLabel) : query.is('test_label', null)
    if (moduleParam === '1' || moduleParam === '2') {
      query = query.eq('module_number', Number(moduleParam))
    }
    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: `Savollarni olishda xatolik: ${error.message}` }, { status: 500 })
    }
    const questions = (data ?? []).map((row) => ({
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
      correct: row.correct ?? undefined,
      correctValue: row.correct_value ?? undefined,
      explanation: row.explanation ?? undefined,
      layout: row.layout ?? undefined,
      moduleNumber: row.module_number ?? undefined,
    }))
    return NextResponse.json({ questions })
  }

  // No filters: a lightweight recent-activity listing (used by the search-by-ID tool).
  const { data } = await supabase
    .from('questions')
    .select('id, kind, domain, difficulty, prompt, test_label, module_number, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  return NextResponse.json({ questions: data ?? [] })
}
