import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Answer-key completeness of one mock. A mock may only go live (Publish, scheduled publish,
 * test-config "published: true") when EVERY question has its correct answer — otherwise students
 * silently get those questions counted as wrong.
 */
export type KeyCheck = {
  ok: boolean
  total: number
  missing: number
  /** Per module, only the ones with something missing. */
  gaps: { kind: 'reading' | 'math'; module: number | null; missing: number; total: number }[]
}

type Row = { kind: string; module_number: number | null; type: string | null; correct: string | null; correct_value: string | null }

export function isMissingKey(r: Pick<Row, 'type' | 'correct' | 'correct_value'>): boolean {
  return r.type === 'gridin' ? !(r.correct_value ?? '').trim() : !r.correct
}

/** Reads the mock's questions and reports which ones have no answer key. Throws on a database error. */
export async function checkAnswerKeys(supabase: SupabaseClient, testLabel: string): Promise<KeyCheck> {
  const { data, error } = await supabase
    .from('questions')
    .select('kind, module_number, type, correct, correct_value')
    .eq('test_label', testLabel)
    .limit(5000)
  if (error) throw new Error(error.message)

  const groups = new Map<string, { kind: 'reading' | 'math'; module: number | null; missing: number; total: number }>()
  let missing = 0
  for (const r of (data ?? []) as Row[]) {
    const key = `${r.kind}:${r.module_number ?? 0}`
    const g = groups.get(key) ?? { kind: r.kind === 'reading' ? 'reading' : 'math', module: r.module_number, missing: 0, total: 0 }
    g.total++
    if (isMissingKey(r)) {
      g.missing++
      missing++
    }
    groups.set(key, g)
  }
  return {
    ok: missing === 0,
    total: (data ?? []).length,
    missing,
    gaps: [...groups.values()].filter((g) => g.missing > 0),
  }
}

/** Human-readable (Uzbek) explanation of why a mock cannot be published yet. */
export function keyGapMessage(c: KeyCheck): string {
  const where = c.gaps
    .map((g) => `${g.kind === 'reading' ? 'English' : 'Math'}${g.module ? ` ${g.module}-modul` : ''}: ${g.missing} ta`)
    .join(', ')
  return (
    `Javob kaliti to'liq emas — ${c.missing} ta savolda to'g'ri javob kiritilmagan (jami ${c.total} ta savoldan; ${where}). ` +
    `Avval «Javob kiritish» jadvalida hamma javobni belgilang, keyin Publish qiling.`
  )
}
