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
): Promise<{ rescored: number }> {
  if (!testLabel) return { rescored: 0 }

  try {
    const { data: attempts, error } = await supabase
      .from('test_attempts')
      .select('id, subject, review_json')
      .eq('test_label', testLabel)
    if (error || !attempts) return { rescored: 0 }

    let rescored = 0
    for (const attempt of attempts) {
      const review = (attempt.review_json as ReviewEntry[] | null) ?? []
      if (!Array.isArray(review) || review.length === 0) continue

      let touched = false
      const nextReview = review.map((entry) => {
        if (!entry || entry.questionId !== questionId || entry.omitted) return entry
        const nowCorrect = isCorrectAnswer(updatedQuestion, entry.answer ?? undefined)
        if (nowCorrect === entry.correct) return entry
        touched = true
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
      if (!updateError) rescored++
    }

    return { rescored }
  } catch {
    return { rescored: 0 }
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
