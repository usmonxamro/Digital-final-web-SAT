import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { buildSectionResult } from '@/lib/scoring'
import { isMissingTable } from '@/lib/db-errors'
import { fetchAll } from '@/lib/db-paginate'
import {
  isCorrectAnswer,
  type ChoiceId,
  type Question,
} from '@/lib/test-data'

type Kind = 'reading' | 'math'
export type AnswerKey = { correct?: ChoiceId; correctValue?: string; explanation?: string }

const MAX_ITEMS = 200
/** Internal label of the built-in sample test (never a real test_label). */
const CAP: Record<Kind, number> = { reading: 27, math: 22 }

type Row = {
  id: string
  kind: Kind
  type: string
  correct: string | null
  correct_value: string | null
  explanation: string | null
  domain: string | null
  module_number: number | null
}

/** How many questions of `kind` the exam page actually shows for this test. */
function presentedCount(rows: Pick<Row, 'kind' | 'module_number'>[], kind: Kind, practice: boolean, sequentialMath: boolean): number {
  const list = rows.filter((r) => r.kind === kind)
  if (practice) return list.length
  if (kind === 'math' && sequentialMath) return Math.min(44, list.length)
  const m1 = list.filter((r) => r.module_number === 1).length
  const m2 = list.filter((r) => r.module_number === 2).length
  if (m1 + m2 > 0) return Math.min(CAP[kind], m1) + Math.min(CAP[kind], m2)
  // Legacy test without module numbers: split in half on the page.
  const half = Math.ceil(list.length / 2)
  return list.length <= 1 ? list.length : Math.min(CAP[kind], half) + Math.min(CAP[kind], list.length - half)
}

/**
 * Grades a finished exam ON THE SERVER. The answer key never reaches the
 * browser before this point: /api/questions strips it, and this endpoint
 * returns it only for the questions of the test that was actually started.
 *
 * Everything that decides the score comes from the server: which test (from
 * the start record), its settings (test_configs), its question list and the
 * number of questions shown. The browser only says which answer it picked for
 * which question; questions it doesn't mention count as omitted.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const rawItems: unknown = body?.items
  if (!Array.isArray(rawItems) || rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  }
  const startId = typeof body.startId === 'string' && /^[0-9a-f-]{36}$/i.test(body.startId) ? body.startId : null

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Server sozlanmagan.' }, { status: 503 })
  }

  /* ----------------------------- the start record ---------------------------- */
  let label: string
  let wallSec: number | null = null
  if (startId) {
    const { data: start } = await supabase.from('mock_starts').select('*').eq('id', startId).maybeSingle()
    if (!start || start.user_id !== session.userId) {
      return NextResponse.json({ error: 'Imtihon topilmadi.' }, { status: 403 })
    }
    if (start.graded_at) {
      // A retry after a lost response gets the stored result back.
      if (start.result) return NextResponse.json(start.result)
      return NextResponse.json({ error: 'Bu imtihon natijasi allaqachon saqlangan.' }, { status: 409 })
    }
    label = start.test_label as string
    if (start.started_at) wallSec = Math.max(0, Math.round((Date.now() - new Date(start.started_at as string).getTime()) / 1000))
  } else {
    const { error: probe } = await supabase.from('mock_starts').select('id').limit(1)
    if (!probe || !isMissingTable(probe)) {
      return NextResponse.json({ error: 'Imtihon boshlanmagan.' }, { status: 400 })
    }
    // v38 SQL not run yet: fall back to the label the page sends.
    label = typeof body.testLabel === 'string' && body.testLabel.trim() ? body.testLabel.trim().slice(0, 120) : ''
  }

  /* ------------------------- the test and its questions ---------------------- */
  let subject: 'full' | 'math' | 'english' = 'full'
  let scoringMode: 'full' | 'single' | 'practice' = 'full'
  let rows: Row[] = []
  const totals: Record<Kind, number> = { reading: 0, math: 0 }

  // Only the questions the page actually submitted are loaded (no 1000-row cap),
  // always filtered to THIS test, so a foreign id is simply ignored.
  const submittedIds = [
    ...new Set(
      (rawItems as Record<string, unknown>[])
        .map((r) => (r && typeof r.qid === 'string' && /^[0-9a-f-]{36}$/i.test(r.qid) ? r.qid : null))
        .filter((x): x is string => !!x),
    ),
  ]
  const cols = 'id, kind, type, correct, correct_value, explanation, domain, module_number'
  async function loadSubmitted(testLabel: string | null) {
    const out: Row[] = []
    for (let i = 0; i < submittedIds.length; i += 100) {
      let q = supabase!.from('questions').select(cols).in('id', submittedIds.slice(i, i + 100))
      q = testLabel ? q.eq('test_label', testLabel) : q.is('test_label', null)
      const { data } = await q
      out.push(...((data ?? []) as Row[]))
    }
    return out
  }

  {
    const [{ data: cfg }, loaded, shape] = await Promise.all([
      supabase.from('test_configs').select('*').eq('test_label', label).maybeSingle(),
      loadSubmitted(label),
      fetchAll<Pick<Row, 'kind' | 'module_number'>>((from, to) =>
        supabase!.from('questions').select('kind, module_number').eq('test_label', label).order('id').range(from, to),
      ),
    ])
    rows = loaded
    subject = cfg?.subject === 'math' || cfg?.subject === 'english' ? cfg.subject : 'full'
    // Same rule as the exam page: a full test is always scored as a full test.
    const practice = subject !== 'full' && (cfg?.placement === 'course_task' || cfg?.scored === false)
    scoringMode = practice ? 'practice' : subject === 'full' ? 'full' : 'single'
    const sequential = subject === 'math' && cfg?.math_layout === 'sequential'
    if (subject !== 'math') totals.reading = presentedCount(shape.data, 'reading', practice, sequential)
    if (subject !== 'english') totals.math = presentedCount(shape.data, 'math', practice, sequential)
  }
  const byId = new Map(rows.map((r) => [r.id, r]))

  /* --------------------------------- grading -------------------------------- */
  const keys: Record<string, AnswerKey> = {}
  const tally: Record<Kind, { c: number; i: number }> = { reading: { c: 0, i: 0 }, math: { c: 0, i: 0 } }
  const seen = new Set<string>()
  const review: Record<string, unknown>[] = []

  for (const raw of rawItems as Record<string, unknown>[]) {
    if (!raw || typeof raw !== 'object') continue
    const answer = typeof raw.answer === 'string' && raw.answer ? raw.answer.slice(0, 12) : undefined
    let kind: Kind | null = null
    let q: Question | null = null
    let qid: string | null = null
    let domain = 'General'

    if (typeof raw.qid === 'string' && byId.has(raw.qid)) {
      const row = byId.get(raw.qid)!
      // Every question of a test appears once.
      if (seen.has(row.id)) continue
      seen.add(row.id)
      kind = row.kind
      qid = row.id
      domain = row.domain ?? 'General'
      q = { type: row.type, correct: row.correct ?? undefined, correctValue: row.correct_value ?? undefined } as Question
      keys[row.id] = {
        correct: (row.correct as ChoiceId) ?? undefined,
        correctValue: row.correct_value ?? undefined,
        explanation: row.explanation ?? undefined,
      }
    }
    if (!kind || !q || totals[kind] === 0) continue

    const ok = isCorrectAnswer(q, answer)
    if (answer) {
      if (ok) tally[kind].c++
      else tally[kind].i++
    }
    review.push({ questionId: qid, sectionKind: kind, domain, answer: answer ?? null, correct: ok, omitted: !answer })
  }

  const section = (k: Kind) => {
    const c = Math.min(tally[k].c, totals[k])
    const i = Math.min(tally[k].i, totals[k] - c)
    return buildSectionResult(c, i, totals[k] - c - i, totals[k])
  }
  const rw = section('reading')
  const math = section('math')
  const composite = subject === 'math' ? math.scaled : subject === 'english' ? rw.scaled : rw.scaled + math.scaled
  // wallSec: real time since the exam was started (server clock) — the PDF-download check never trusts the browser alone.
  const result = { keys, rw, math, composite, subject, scoringMode, wallSec }

  /* ------------------------- record it exactly once ------------------------- */
  if (startId) {
    const { data: claimed } = await supabase
      .from('mock_starts')
      .update({ graded_at: new Date().toISOString() })
      .eq('id', startId)
      .is('graded_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ error: 'Bu imtihon natijasi allaqachon saqlangan.' }, { status: 409 })
    }
    await supabase.from('mock_starts').update({ result }).eq('id', startId) // best-effort (column may be missing)
    await supabase.from('mock_starts').update({ progress: null, progress_at: null }).eq('id', startId) // saved progress no longer needed
  }

  if (scoringMode !== 'practice') {
    const { error } = await supabase.from('test_attempts').insert({
      user_id: session.userId,
      test_label: label,
      subject,
      rw_scaled: subject === 'math' ? 0 : rw.scaled,
      math_scaled: subject === 'english' ? 0 : math.scaled,
      composite,
      correct_count: rw.correct + math.correct,
      incorrect_count: rw.incorrect + math.incorrect,
      omitted_count: rw.omitted + math.omitted,
      elapsed_label: typeof body.elapsedLabel === 'string' ? body.elapsedLabel.slice(0, 20) : null,
      review_json: review,
    })
    if (error) console.error('Failed to save attempt:', error.message)
  }

  return NextResponse.json(result)
}
