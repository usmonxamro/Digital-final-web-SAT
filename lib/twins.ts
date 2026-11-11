import type { Question } from '@/lib/test-data'

/** A "twin": the same question with other numbers. Stored once per family, reused by every review mock. */
export type Twin = Question & {
  familyId: string
  sourceId: string | null
  variant: number
  keyChecked: boolean
  needsFigure: boolean
  kind: 'reading' | 'math'
}

type Row = Record<string, unknown>

export function rowToTwin(r: Row): Twin {
  return {
    id: r.id as string,
    familyId: r.family_id as string,
    sourceId: (r.source_id as string) ?? null,
    variant: Number(r.variant ?? 1),
    keyChecked: r.key_checked === true,
    needsFigure: r.needs_figure === true,
    kind: r.kind === 'reading' ? 'reading' : 'math',
    type: ((r.type as string) ?? 'mcq') as Question['type'],
    difficulty: (r.difficulty as Question['difficulty']) ?? undefined,
    domain: (r.domain as string) ?? undefined,
    passage: (r.passage as string) ?? undefined,
    underline: (r.underline as string) ?? undefined,
    prompt: (r.prompt as string) ?? '',
    equations: (r.equations as string[]) ?? undefined,
    image: (r.image as string) ?? undefined,
    choices: (r.choices as Question['choices']) ?? undefined,
    correct: (r.correct as Question['correct']) ?? undefined,
    correctValue: (r.correct_value as string) ?? undefined,
    explanation: (r.explanation as string) ?? undefined,
    layout: (r.layout as Question['layout']) ?? undefined,
  }
}

/** Question fields → question_twins / questions columns. */
export function questionColumns(q: Question) {
  return {
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
    layout: q.layout ?? null,
  }
}

/** The family a question row belongs to: copies remember their root, originals are their own root. */
export const familyOf = (r: { id?: unknown; family_id?: unknown }) => ((r.family_id as string) || (r.id as string))
