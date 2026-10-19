import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingTable } from '@/lib/db-errors'

/** The four book sections. `file` loads the bundled JSON lazily so the route stays small. */
export const BANK_DOMAINS = [
  { key: 'algebra', label: 'Algebra', domain: 'Algebra', load: () => import('@/lib/bank-data/bank-1-algebra.json') },
  { key: 'advanced-math', label: 'Advanced Math', domain: 'Advanced Math', load: () => import('@/lib/bank-data/bank-2-advanced-math.json') },
  {
    key: 'problem-solving-data-analysis',
    label: 'Problem-Solving and Data Analysis',
    domain: 'Problem-Solving and Data Analysis',
    load: () => import('@/lib/bank-data/bank-3-problem-solving-data-analysis.json'),
  },
  {
    key: 'geometry-trigonometry',
    label: 'Geometry and Trigonometry',
    domain: 'Geometry and Trigonometry',
    load: () => import('@/lib/bank-data/bank-4-geometry-trigonometry.json'),
  },
] as const

type BookChoice = { id: string; text?: string; tex?: string; image_file?: string }
type BookQuestion = {
  source_id: string
  domain: string
  topic: string
  topic_code: string
  number: number
  difficulty: string
  type: 'mcq' | 'gridin'
  prompt: string
  equations?: unknown
  image_file?: string
  choices?: BookChoice[]
  answer: string
  explanation?: string | null
  needs_check?: boolean
  note?: string | null
}

/** SVGs live in /public/bank, so a plain site-relative URL is the image address (no Storage upload needed). */
const img = (file: string) => `/bank/${file}`

export async function loadBookRows(key: string, skipNeedsCheck: boolean) {
  const d = BANK_DOMAINS.find((x) => x.key === key)
  if (!d) throw new Error(`Noma'lum bo'lim: ${key}`)
  const mod = await d.load()
  const all = ((mod as unknown as { default: BookQuestion[] }).default ?? (mod as unknown as BookQuestion[])) as BookQuestion[]
  const rows = []
  for (const q of all) {
    if (skipNeedsCheck && q.needs_check) continue
    rows.push({
      source_id: q.source_id,
      domain: q.domain,
      topic: q.topic,
      topic_code: q.topic_code,
      number: q.number,
      difficulty: q.difficulty,
      type: q.type,
      prompt: q.prompt,
      equations: q.equations ?? null,
      image: q.image_file ? img(q.image_file) : null,
      choices: q.choices
        ? q.choices.map((c) => ({
            id: c.id,
            ...(c.text ? { text: c.text } : {}),
            ...(c.tex ? { tex: c.tex } : {}),
            ...(c.image_file ? { image: img(c.image_file) } : {}),
          }))
        : null,
      correct: q.type === 'mcq' ? q.answer : null,
      correct_value: q.type === 'gridin' ? q.answer : null,
      explanation: q.explanation ?? null,
      needs_check: !!q.needs_check,
      note: q.note ?? null,
      source: 'book',
    })
  }
  return { rows, bundled: all.length }
}

export type BankStatus = {
  tableMissing: boolean
  domains: { key: string; label: string; inFile: number; inDb: number; needsCheck: number }[]
}

export async function bankStatus(supabase: SupabaseClient): Promise<BankStatus> {
  const domains: BankStatus['domains'] = []
  let tableMissing = false
  for (const d of BANK_DOMAINS) {
    const { rows, bundled } = await loadBookRows(d.key, false)
    let inDb = 0
    if (!tableMissing) {
      const { count, error } = await supabase.from('question_bank').select('id', { count: 'exact', head: true }).eq('domain', d.domain)
      if (error) {
        if (isMissingTable(error)) tableMissing = true
        else throw new Error(error.message)
      } else inDb = count ?? 0
    }
    domains.push({ key: d.key, label: d.label, inFile: bundled, inDb, needsCheck: rows.filter((r) => r.needs_check).length })
  }
  return { tableMissing, domains }
}

/** Upserts one section by `source_id`, so running it again updates instead of duplicating. */
export async function importBankDomain(supabase: SupabaseClient, key: string, skipNeedsCheck: boolean) {
  const { rows } = await loadBookRows(key, skipNeedsCheck)
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('question_bank').upsert(rows.slice(i, i + 100), { onConflict: 'source_id' })
    if (error) {
      if (isMissingTable(error)) throw new Error('question_bank jadvali yo\'q. Avval Supabase SQL Editor\'da supabase/question_bank.sql ni Run qiling.')
      throw new Error(`${i + 1}-qatorda xato: ${error.message}`)
    }
  }
  return rows.length
}
