/**
 * Approximate SAT-style raw-to-scaled score conversion.
 * Real SAT curves are irregular and non-public per form; this uses a smooth
 * curve (200-800) that rewards higher accuracy more steeply, which is a
 * reasonable stand-in for practice purposes.
 */
export function scaleScore(correct: number, total: number): number {
  if (total <= 0) return 200
  const pct = Math.min(1, Math.max(0, correct / total))
  const curved = Math.pow(pct, 0.85)
  const raw = 200 + curved * 600
  return Math.min(800, Math.max(200, Math.round(raw / 10) * 10))
}

export type SectionResult = {
  correct: number
  incorrect: number
  omitted: number
  total: number
  scaled: number
}

export function buildSectionResult(
  correctCount: number,
  incorrectCount: number,
  omittedCount: number,
  total: number,
): SectionResult {
  return {
    correct: correctCount,
    incorrect: incorrectCount,
    omitted: omittedCount,
    total,
    scaled: scaleScore(correctCount, total),
  }
}
