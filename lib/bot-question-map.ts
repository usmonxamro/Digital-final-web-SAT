import type { SupabaseClient } from '@supabase/supabase-js'
import { assemblePdfItems } from '@/lib/mock-pdf-items'
import type { Question } from '@/lib/test-data'

export type MappedQuestion = Question & { no: number; kind: 'reading' | 'math' }

type Row = Record<string, unknown>

export function rowToQuestion(r: Row): Question & { kind: 'reading' | 'math' } {
  return {
    id: r.id as string,
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
    moduleNumber: r.module_number === 1 || r.module_number === 2 ? (r.module_number as 1 | 2) : undefined,
  }
}

/**
 * The bot numbers a site mock's Math questions 1..N in exam order (see lib/bot-publish.ts).
 * Returns the site questions behind those numbers, or null when the bot test is not linked to a site mock.
 */
export async function botTestQuestions(sb: SupabaseClient, code: string): Promise<{ testLabel: string; items: MappedQuestion[] } | null> {
  const { data: bt } = await sb.from('bot_tests').select('test_label').eq('code', code).maybeSingle()
  const label = (bt?.test_label as string | null) ?? null
  if (!label) return null
  const { data: cfg } = await sb.from('test_configs').select('subject, placement, scored, math_layout').eq('test_label', label).maybeSingle()
  if (!cfg) return null
  const load = async (kind: 'reading' | 'math'): Promise<Question[]> => {
    const { data } = await sb
      .from('questions')
      .select('*')
      .eq('kind', kind)
      .eq('test_label', label)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    return (data ?? []).map(rowToQuestion)
  }
  const [reading, math] = await Promise.all([load('reading'), load('math')])
  const items = (
    await assemblePdfItems(
      { subject: cfg.subject, placement: cfg.placement, scored: cfg.scored, mathLayout: cfg.math_layout },
      async (kind) => (kind === 'math' ? math : reading),
    )
  ).filter((it) => it.sectionKind === 'math')
  return {
    testLabel: label,
    items: items.map((it, i) => ({ ...(it.question as Question), no: i + 1, kind: 'math' as const })),
  }
}
