import type { SupabaseClient } from '@supabase/supabase-js'
import { isCorrectAnswer, type Question } from '@/lib/test-data'
import { scaleScore } from '@/lib/scoring'

/** Shape of one entry in test_attempts.review_json — see app/exam/page.tsx's
 *  submission payload. questionId is the admin-managed question's DB id
 *  (null for questions from the built-in static pool, which can't be
 *  re-scored this way since they have no row an admin could edit). */
type ReviewEntry = {
  questionId: string | null
  sectionKind: 'reading' | 'math'
  domain?: string
  answer: string | null
  correct: boolean
  omitted: boolean
}

/**
 * When an admin fixes a question's answer key (via the "Javob kiritish"
 * answer-entry mode or the by-id JSON editor), any already-submitted test
 * attempt that answered this exact question was scored against the old,
 * wrong key. This finds every such attempt and re-scores it: re-checks just
 * this question's correctness against the corrected answer, then rebuilds
 * the section/composite scaled scores from the whole review array — exactly
 * mirroring the scoring done client-side in app/exam/page.tsx at submission
 * time, so a re-scored attempt looks identical to one that had always used
 * the corrected key.
 *
 * Scoped to test_attempts sharing this question's test_label (mock-test
 * attempts only — skill-bank questions, which have no test_label, aren't
 * tied to a single test_attempts row this way and are left alone).
 * Best-effort: never throws, since this runs as a side effect of a PATCH
 * that should succeed regardless.
 */
export async function rescoreAttemptsForQuestion(
  supabase: SupabaseClient,
  questionId: string,
  testLabel: string | null,
  updatedQuestion: Question,
): Promise<{ rescored: number; changes: RescoreChange[] }> {
  const changes: RescoreChange[] = []
  if (!testLabel) return { rescored: 0, changes }

  try {
    const { data: qRow } = await supabase.from('questions').select('prompt').eq('id', questionId).maybeSingle()
    const preview = previewOf((qRow?.prompt as string | undefined) ?? '')

    const { data: attempts, error } = await supabase
      .from('test_attempts')
      .select('id, user_id, subject, composite, review_json')
      .eq('test_label', testLabel)
    if (error || !attempts) return { rescored: 0, changes }

    let rescored = 0
    for (const attempt of attempts) {
      const review = (attempt.review_json as ReviewEntry[] | null) ?? []
      if (!Array.isArray(review) || review.length === 0) continue

      let touched = false
      let nowCorrectFlag = false
      let kind: 'reading' | 'math' = 'math'
      const nextReview = review.map((entry) => {
        if (!entry || entry.questionId !== questionId || entry.omitted) return entry
        const nowCorrect = isCorrectAnswer(updatedQuestion, entry.answer ?? undefined)
        if (nowCorrect === entry.correct) return entry
        touched = true
        nowCorrectFlag = nowCorrect
        kind = entry.sectionKind
        return { ...entry, correct: nowCorrect }
      })
      if (!touched) continue

      const rw = tallySection(nextReview, 'reading')
      const math = tallySection(nextReview, 'math')
      const rwScaled = scaleScore(rw.correct, rw.total)
      const mathScaled = scaleScore(math.correct, math.total)
      const subject = attempt.subject as 'full' | 'math' | 'english'
      const composite = subject === 'full' ? rwScaled + mathScaled : subject === 'math' ? mathScaled : rwScaled

      const { error: updateError } = await supabase
        .from('test_attempts')
        .update({
          review_json: nextReview,
          rw_scaled: rwScaled,
          math_scaled: mathScaled,
          composite,
          correct_count: rw.correct + math.correct,
          incorrect_count: rw.incorrect + math.incorrect,
          omitted_count: rw.omitted + math.omitted,
        })
        .eq('id', attempt.id)
      if (!updateError) {
        rescored++
        changes.push({
          attemptId: attempt.id as string,
          userId: (attempt as { user_id?: string }).user_id ?? '',
          testLabel,
          sectionKind: kind,
          preview,
          nowCorrect: nowCorrectFlag,
          before: (attempt as { composite?: number }).composite ?? 0,
          after: composite,
        })
      }
    }

    return { rescored, changes }
  } catch {
    return { rescored: 0, changes }
  }
}

/** One re-scored attempt: which student, what happened to the answer, and the score before/after. */
export type RescoreChange = {
  attemptId: string
  userId: string
  testLabel: string
  sectionKind: 'reading' | 'math'
  /** First words of the question, so the student knows which one it was. */
  preview: string
  nowCorrect: boolean
  before: number
  after: number
}

function previewOf(prompt: string) {
  const t = prompt.replace(/\$+/g, '').replace(/\\[a-zA-Z]+/g, '').replace(/\s+/g, ' ').trim()
  return t.length > 70 ? `${t.slice(0, 70).trim()}…` : t
}

/**
 * Tells every affected student, in their bell, that an answer key was corrected and what it did to their score.
 * Several corrected questions in the same attempt (one "Javob kiritish" save) become ONE message.
 * Best-effort: never throws.
 */
export async function notifyRescoredStudents(supabase: SupabaseClient, changes: RescoreChange[]): Promise<number> {
  try {
    const byAttempt = new Map<string, RescoreChange[]>()
    for (const c of changes) {
      if (!c.userId) continue
      byAttempt.set(c.attemptId, [...(byAttempt.get(c.attemptId) ?? []), c])
    }
    const rows: { user_id: string; kind: string; title: string; body: string }[] = []
    for (const list of byAttempt.values()) {
      const first = list[0]
      // before = the score before the FIRST corrected question of this attempt, after = the final one
      const before = list[0].before
      const after = list[list.length - 1].after
      const gained = list.filter((c) => c.nowCorrect).length
      const lost = list.length - gained
      const scoreLine = before === after ? `Ballingiz o‘zgarmadi: ${after}.` : `Yangi ballingiz: ${after} (avval ${before}).`
      if (list.length === 1) {
        const sec = first.sectionKind === 'reading' ? 'Reading & Writing' : 'Math'
        const quote = first.preview ? ` «${first.preview}»` : ''
        rows.push(
          first.nowCorrect
            ? {
                user_id: first.userId,
                kind: 'admin',
                title: 'Javobingiz to‘g‘ri deb topildi ✅',
                body: `«${first.testLabel}» testidagi ${sec} savoli${quote} uchun javob kaliti tuzatildi. Sizning javobingiz to‘g‘ri deb topildi. ${scoreLine}`,
              }
            : {
                user_id: first.userId,
                kind: 'admin',
                title: 'Javob kaliti tuzatildi',
                body: `«${first.testLabel}» testidagi ${sec} savoli${quote} uchun javob kaliti tuzatildi — endi sizning javobingiz noto‘g‘ri hisoblanadi. ${scoreLine}`,
              },
        )
      } else {
        const parts = [gained > 0 ? `${gained} tasida javobingiz to‘g‘ri deb topildi` : '', lost > 0 ? `${lost} tasida noto‘g‘ri hisoblandi` : ''].filter(Boolean)
        rows.push({
          user_id: first.userId,
          kind: 'admin',
          title: gained > 0 ? 'Javoblaringiz qayta tekshirildi ✅' : 'Javob kaliti tuzatildi',
          body: `«${first.testLabel}» testida ${list.length} ta savolning javob kaliti tuzatildi: ${parts.join(', ')}. ${scoreLine}`,
        })
      }
    }
    if (rows.length === 0) return 0
    const { error } = await supabase.from('notifications').insert(rows)
    return error ? 0 : rows.length
  } catch {
    return 0
  }
}

function tallySection(review: ReviewEntry[], kind: 'reading' | 'math') {
  let correct = 0
  let incorrect = 0
  let omitted = 0
  let total = 0
  for (const entry of review) {
    if (!entry || entry.sectionKind !== kind) continue
    total++
    if (entry.omitted) omitted++
    else if (entry.correct) correct++
    else incorrect++
  }
  return { correct, incorrect, omitted, total }
}
