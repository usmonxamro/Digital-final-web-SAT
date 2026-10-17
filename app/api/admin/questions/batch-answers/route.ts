import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { rescoreAttemptsForQuestion } from '@/lib/rescoring'
import type { ChoiceId, Question } from '@/lib/test-data'
import { invalidateCounts } from '@/lib/mock-catalog'

const VALID_CHOICE_IDS: ChoiceId[] = ['A', 'B', 'C', 'D']


type AnswerPatch = { id: string; correct?: ChoiceId; correctValue?: string }

/**
 * Bulk "Javob kiritish" save: the admin fills in a whole sheet of answers
 * client-side (no per-click network round trip, matching the Telegram bot's
 * webapp flow — fill everything, submit once) and this endpoint writes them
 * all in a single request, re-scoring any already-submitted attempts whose
 * answer key actually changed.
 */
export async function POST(req: NextRequest) {
  invalidateCounts()
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }

  const body = await req.json().catch(() => null)
  const answers: unknown = body?.answers
  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: "'answers' bo'sh emas massiv bo'lishi kerak." }, { status: 400 })
  }

  const patches: AnswerPatch[] = []
  for (const raw of answers) {
    if (!raw || typeof raw !== 'object' || typeof (raw as { id?: unknown }).id !== 'string') {
      return NextResponse.json({ error: "Har bir yozuvda 'id' bo'lishi kerak." }, { status: 400 })
    }
    const a = raw as { id: string; correct?: unknown; correctValue?: unknown }
    const patch: AnswerPatch = { id: a.id }
    if (a.correct !== undefined && a.correct !== null && a.correct !== '') {
      if (!VALID_CHOICE_IDS.includes(a.correct as ChoiceId)) {
        return NextResponse.json({ error: `"${a.id}": "correct" A/B/C/D dan biri bo'lishi kerak.` }, { status: 400 })
      }
      patch.correct = a.correct as ChoiceId
    }
    if (typeof a.correctValue === 'string' && a.correctValue.trim() !== '') {
      patch.correctValue = a.correctValue.trim()
    }
    patches.push(patch)
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server sozlanmagan.' }, { status: 503 })
  }

  const ids = patches.map((p) => p.id)
  const { data: beforeRows, error: beforeErr } = await supabase
    .from('questions')
    .select('id, correct, correct_value, test_label')
    .in('id', ids)

  if (beforeErr) {
    return NextResponse.json({ error: `O'qishda xatolik: ${beforeErr.message}` }, { status: 500 })
  }

  const beforeById = new Map((beforeRows ?? []).map((r) => [r.id, r]))
  const results: { id: string; ok: boolean; error?: string }[] = []

  // Phase 1 — write the answer keys. Independent rows, so run them in small
  // parallel chunks (a whole 4-module mock is up to ~98 rows; one-by-one was
  // needlessly slow).
  const CHUNK = 12
  for (let i = 0; i < patches.length; i += CHUNK) {
    const chunk = patches.slice(i, i + CHUNK)
    const settled = await Promise.all(
      chunk.map(async (patch) => {
        const { error } = await supabase
          .from('questions')
          .update({
            correct: patch.correct ?? null,
            correct_value: patch.correctValue ?? null,
          })
          .eq('id', patch.id)
        return { patch, error }
      }),
    )
    for (const { patch, error } of settled) {
      results.push(error ? { id: patch.id, ok: false, error: error.message } : { id: patch.id, ok: true })
    }
  }

  // Phase 2 — re-score already-submitted attempts for answers that actually
  // changed. Kept SEQUENTIAL on purpose: different questions can belong to the
  // same attempt row, and concurrent read-modify-write re-scoring would race.
  let rescoredTotal = 0
  const okIds = new Set(results.filter((r) => r.ok).map((r) => r.id))
  for (const patch of patches) {
    if (!okIds.has(patch.id)) continue
    const before = beforeById.get(patch.id)
    const answerChanged =
      before && (before.correct !== (patch.correct ?? null) || before.correct_value !== (patch.correctValue ?? null))
    if (answerChanged) {
      const updatedForRescore = { correct: patch.correct, correctValue: patch.correctValue } as Question
      const result = await rescoreAttemptsForQuestion(supabase, patch.id, before!.test_label ?? null, updatedForRescore)
      rescoredTotal += result.rescored
    }
  }

  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    return NextResponse.json(
      { error: `${failed.length} ta savolni saqlashda xatolik yuz berdi.`, results, rescored: rescoredTotal },
      { status: 207 },
    )
  }

  return NextResponse.json({ ok: true, results, rescored: rescoredTotal })
}
