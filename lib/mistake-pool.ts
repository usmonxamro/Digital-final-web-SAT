import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from '@/lib/db-paginate'
import { assemblePdfItems } from '@/lib/mock-pdf-items'
import { rowToQuestion } from '@/lib/bot-question-map'
import type { Question } from '@/lib/test-data'
import { familyOf, rowToTwin, type Twin } from '@/lib/twins'

/** One question family in the «Xatolar bazasi»: every copy of the question (and its twins) counted together. */
export type PoolItem = {
  family: string
  question: Question & { kind: 'reading' | 'math'; testLabel?: string }
  misses: number
  seen: number
  rate: number
  lastAt: string | null
  labels: string[]
  students: number
  twins: Twin[]
}

type Att = {
  source: string
  bot_code: string | null
  chat_id: number | null
  tg_id: number | null
  user_id: string | null
  test_label: string | null
  wrong_nos: number[] | null
  wrong_qids: string[] | null
  submitted_at: string
}

/**
 * Collects every wrong answer — Telegram bot (question numbers → site questions) and site (question ids) —
 * into question families. A family = an original question + all its copies in review mocks + its twins,
 * so the pool never fills with "the same question again" however many review rounds there are.
 */
export async function buildMistakePool(
  sb: SupabaseClient,
  opts: { chat?: number | null; since?: string | null; minMisses?: number; limit?: number },
): Promise<{ items: PoolItem[]; attempts: number; twinsMissing?: boolean }> {
  const make = (from: number, to: number) => {
    let q = sb
      .from('attempt_log')
      .select('source, bot_code, chat_id, tg_id, user_id, test_label, wrong_nos, wrong_qids, submitted_at')
    if (opts.since) q = q.gte('submitted_at', opts.since)
    if (opts.chat != null) q = q.eq('chat_id', opts.chat)
    return q.order('submitted_at').order('id').range(from, to)
  }
  const { data: atts, error } = await fetchAll<Att>(make)
  if (error) throw new Error(error.message)

  // bot code → site mock label
  const codes = [...new Set(atts.filter((a) => a.source === 'bot' && a.bot_code).map((a) => a.bot_code as string))]
  const codeLabel = new Map<string, string>()
  for (let i = 0; i < codes.length; i += 200) {
    const { data } = await sb.from('bot_tests').select('code, test_label').in('code', codes.slice(i, i + 200))
    for (const r of data ?? []) if (r.test_label) codeLabel.set(r.code as string, r.test_label as string)
  }
  const labels = [...new Set([...codeLabel.values(), ...atts.filter((a) => a.source === 'web' && a.test_label).map((a) => a.test_label as string)])]

  // the questions of those mocks, in exam order (the bot numbers Math 1..N in that order)
  const rowsByLabel = new Map<string, Record<string, unknown>[]>()
  const cfgByLabel = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < labels.length; i += 40) {
    const part = labels.slice(i, i + 40)
    const [{ data: rows }, { data: cfgs }] = await Promise.all([
      fetchAll<Record<string, unknown>>((f, t) => sb.from('questions').select('*').in('test_label', part).order('created_at').order('id').range(f, t)),
      sb.from('test_configs').select('test_label, subject, placement, scored, math_layout').in('test_label', part),
    ])
    for (const r of rows) {
      const l = r.test_label as string
      if (!rowsByLabel.has(l)) rowsByLabel.set(l, [])
      rowsByLabel.get(l)!.push(r)
    }
    for (const c of cfgs ?? []) cfgByLabel.set(c.test_label as string, c)
  }
  const rowById = new Map<string, Record<string, unknown>>()
  const mathOrder = new Map<string, string[]>()
  const allIds = new Map<string, string[]>()
  for (const [label, rows] of rowsByLabel) {
    for (const r of rows) rowById.set(r.id as string, r)
    allIds.set(label, rows.map((r) => r.id as string))
    const c = cfgByLabel.get(label)
    const qs = rows.map(rowToQuestion)
    const items = await assemblePdfItems(
      c ? { subject: c.subject as string, placement: c.placement as string, scored: c.scored as boolean, mathLayout: c.math_layout as string } : { subject: 'math' },
      async (k) => qs.filter((x) => (k === 'math' ? (x as { kind?: string }).kind !== 'reading' : (x as { kind?: string }).kind === 'reading')),
    )
    mathOrder.set(label, items.filter((it) => it.sectionKind === 'math').map((it) => it.question.id as string))
  }

  type Acc = { misses: number; seen: number; lastAt: string | null; labels: Set<string>; who: Set<string> }
  const fam = new Map<string, Acc>()
  const acc = (id: string) => {
    const r = rowById.get(id)
    if (!r) return null
    const f = familyOf(r)
    let a = fam.get(f)
    if (!a) fam.set(f, (a = { misses: 0, seen: 0, lastAt: null, labels: new Set(), who: new Set() }))
    return a
  }
  for (const a of atts) {
    const who = a.tg_id != null ? `t${a.tg_id}` : `u${a.user_id}`
    let label: string | undefined
    let wrong: string[] = []
    if (a.source === 'bot') {
      label = a.bot_code ? codeLabel.get(a.bot_code) : undefined
      const order = label ? mathOrder.get(label) : undefined
      if (!order) continue
      for (const id of order) {
        const x = acc(id)
        if (x) x.seen++
      }
      wrong = (a.wrong_nos ?? []).map((n) => order[n - 1]).filter(Boolean)
    } else {
      label = a.test_label ?? undefined
      const ids = label ? allIds.get(label) : undefined
      if (!ids) continue
      for (const id of ids) {
        const x = acc(id)
        if (x) x.seen++
      }
      wrong = a.wrong_qids ?? []
    }
    for (const id of new Set(wrong)) {
      const x = acc(id)
      if (!x) continue
      x.misses++
      x.who.add(who)
      if (label) x.labels.add(label)
      if (!x.lastAt || a.submitted_at > x.lastAt) x.lastAt = a.submitted_at
    }
  }

  const min = Math.max(1, opts.minMisses ?? 1)
  const top = [...fam.entries()]
    .filter(([, a]) => a.misses >= min)
    .sort((x, y) => y[1].misses - x[1].misses || (y[1].lastAt ?? '').localeCompare(x[1].lastAt ?? ''))
    .slice(0, opts.limit ?? 400)

  // Representative text: the original (family root) when it still exists, else any copy we saw.
  const need = top.map(([f]) => f).filter((f) => !rowById.has(f))
  for (let i = 0; i < need.length; i += 200) {
    const { data } = await sb.from('questions').select('*').in('id', need.slice(i, i + 200))
    for (const r of data ?? []) rowById.set(r.id as string, r)
  }
  const anyOf = new Map<string, Record<string, unknown>>()
  for (const r of rowById.values()) if (!anyOf.has(familyOf(r))) anyOf.set(familyOf(r), r)

  const twins = new Map<string, Twin[]>()
  let twinsMissing = false
  const fams = top.map(([f]) => f)
  for (let i = 0; i < fams.length; i += 200) {
    const { data, error: tErr } = await sb.from('question_twins').select('*').in('family_id', fams.slice(i, i + 200)).order('variant')
    if (tErr) {
      twinsMissing = true
      break
    }
    for (const r of data ?? []) {
      const t = rowToTwin(r)
      if (!twins.has(t.familyId)) twins.set(t.familyId, [])
      twins.get(t.familyId)!.push(t)
    }
  }

  const items: PoolItem[] = []
  for (const [f, a] of top) {
    const r = rowById.get(f) ?? anyOf.get(f)
    if (!r) continue
    items.push({
      family: f,
      question: { ...rowToQuestion(r), testLabel: (r.test_label as string) ?? undefined },
      misses: a.misses,
      seen: a.seen,
      rate: a.seen ? a.misses / a.seen : 0,
      lastAt: a.lastAt,
      labels: [...a.labels],
      students: a.who.size,
      twins: twins.get(f) ?? [],
    })
  }
  return { items, attempts: atts.length, twinsMissing }
}
