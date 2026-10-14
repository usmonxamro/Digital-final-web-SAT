import type { QuestionLayout } from '@/lib/question-layout'

export type SectionKind = 'reading' | 'math'
export type ChoiceId = 'A' | 'B' | 'C' | 'D'
export type QuestionType = 'mcq' | 'gridin'
export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type Choice = {
  id: ChoiceId
  /** Plain text answer. */
  text?: string
  /** LaTeX answer rendered with KaTeX. */
  tex?: string
}

export type Question = {
  /** Database row id, when this question came from the admin-managed pool
   *  (never set for the built-in static pools). Threaded through into a
   *  submitted test's review_json so an admin's later answer-key fix can
   *  find and re-score attempts that already answered this exact question. */
  id?: string
  /** 'mcq' (default) or 'gridin' (student-produced response). */
  type?: QuestionType
  difficulty?: Difficulty
  /** Reading only: the passage / stimulus shown on the left. */
  passage?: string
  /** Reading only: a substring of `passage` to underline. */
  underline?: string
  /** The question stem the student answers. */
  prompt: string
  /** Math only: block equations rendered in display mode. */
  equations?: string[]
  /** Required for type 'mcq'. */
  choices?: Choice[]
  /** Required for type 'mcq': the id of the correct choice. */
  correct?: ChoiceId
  /** Required for type 'gridin': accepted answer (compared after normalizing). */
  correctValue?: string
  /** Optional hint shown in the score report's solution breakdown. */
  explanation?: string
  /** Optional: URL of a diagram/figure/chart shown with the question. */
  image?: string
  /** SAT content domain, e.g. "Algebra" or "Craft and Structure". */
  domain?: string
  /** 1 or 2 when the question was imported for a specific module (sent by /api/questions). */
  moduleNumber?: 1 | 2
  /** Optional visual arrangement of prompt paragraphs / tables / figure /
   *  equations, set in the admin's exam preview. See lib/question-layout.ts. */
  layout?: QuestionLayout | null
}

export type TestModule = {
  id: string
  kind: SectionKind
  /** Full header label, e.g. "Section 1, Module 1: Reading and Writing". */
  label: string
  /** Short label used in the question-grid popup. */
  shortLabel: string
  durationSec: number
  /** Number of questions presented in this module. */
  total: number
  /** Authored question pool; cycled to fill `total`. */
  pool: Question[]
}

/** Returns the question for a given index within a module (pool is cycled). */
export function questionAt(module: TestModule, index: number): Question {
  return module.pool[index % module.pool.length]
}

/** Parses a grid-in style numeric string ("2/3", "-4.5", ".667") to a number. */
function parseGridNumeric(input: string): number | null {
  const s = input.trim()
  if (!s || s === '-' || s === '.' || s === '/') return null
  if (s.includes('/')) {
    const parts = s.split('/')
    if (parts.length !== 2) return null
    const num = Number(parts[0])
    const den = Number(parts[1])
    if (!isFinite(num) || !isFinite(den) || den === 0) return null
    return num / den
  }
  const n = Number(s)
  return isFinite(n) ? n : null
}

/** Number of digits after the decimal point in a plain (non-fraction) numeric string. */
function decimalPlacesOf(input: string): number {
  const dot = input.indexOf('.')
  if (dot === -1) return 0
  return input.length - dot - 1
}

/** Checks one accepted grid-in value string against the student's answer, per the real
 *  Digital SAT student-produced response rules (see isCorrectAnswer's doc comment). */
function matchesGridVariant(correctStr: string, answer: string): boolean {
  const target = parseGridNumeric(correctStr)
  const user = parseGridNumeric(answer)
  if (target == null || user == null) return false

  const EPS = 1e-9

  // Fractions are exact by definition.
  if (answer.includes('/')) {
    return Math.abs(user - target) < EPS
  }

  // An exact decimal match is always accepted, regardless of length.
  if (Math.abs(user - target) < EPS) return true

  // Otherwise the value doesn't terminate within the box: the full
  // 5-character budget (excluding a leading minus) must be used.
  const digitsOnly = answer.replace(/^-/, '')
  const MAX_DIGIT_BUDGET = 5
  if (digitsOnly.length !== MAX_DIGIT_BUDGET) return false

  const places = decimalPlacesOf(answer)
  if (places === 0) return false
  const factor = Math.pow(10, places)
  const truncated = Math.trunc(target * factor) / factor
  const rounded = Math.round(target * factor) / factor
  return Math.abs(user - truncated) < EPS || Math.abs(user - rounded) < EPS
}

/**
 * Checks whether a stored answer string is correct for a given question.
 *
 * For grid-in (student-produced response) questions, this follows the real
 * Digital SAT student-produced response rules:
 *  - Fractions are exact by definition and accepted if numerically equal.
 *  - An exact decimal match is always accepted, no matter how short
 *    (e.g. "3.5", "3.50", "7/2" for a target of 3.5).
 *  - If the value does not terminate within the available space, the
 *    student must fill the FULL 5-character budget (not counting a leading
 *    minus sign) with a decimal that correctly truncates or rounds the
 *    exact value — shorter, under-filled entries (e.g. "0.66" or ".67" for
 *    2/3) are rejected even though they look like valid truncations,
 *    because they don't use the full available precision.
 *  - A question with more than one valid numeric answer (e.g. two roots of
 *    a quadratic) can store `correctValue` as a comma-separated list
 *    ("3,4" or "1/2, 0.5") — matching ANY listed variant counts as correct.
 */
export function isCorrectAnswer(question: Question, answer: string | undefined): boolean {
  if (!answer) return false

  if (question.type !== 'gridin') {
    return answer === question.correct
  }

  const variants = (question.correctValue ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  if (variants.length === 0) return false

  return variants.some((variant) => matchesGridVariant(variant, answer))
}
