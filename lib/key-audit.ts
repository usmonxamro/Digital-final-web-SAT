import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from '@/lib/db-paginate'
import { assemblePdfItems } from '@/lib/mock-pdf-items'
import { isCorrectAnswer, type Question } from '@/lib/test-data'

/**
 * "Kalit auditi": every question (bot tests + site mocks) whose answer key looks wrong, with the reason.
 *
 * Signals, strongest first:
 *  - KEY_DIFF    the bot's key and the site's key for the same question differ
 *  - FORMAT      the key has the wrong shape (a letter where students type numbers, empty, not A–D…)
 *  - EQUIV       students were marked wrong for an answer equal to the key written another way (0.5 vs 1/2)
 *  - STRONG      the best students of that mock agree on ONE other answer
 *  - MAJORITY    almost everyone gave ONE other answer and almost nobody matched the key
 *  - REPORT      a student reported the question as wrong
 *  - NOBODY      nobody solved it (very hard, or the key is wrong)
 */
export type AuditSignal = { code: 'KEY_DIFF' | 'FORMAT' | 'EQUIV' | 'STRONG' | 'MAJORITY' | 'REPORT' | 'NOBODY'; text: string }
export type AuditRow = {
  id: string
  /** Site mock name, when the question lives on the site. */
  testLabel: string | null
  botCode: string | null
  mockName: string
  qNo: number | null
  questionId: string | null
  type: 'mcq' | 'gridin' | null
  botKey: string | null
  siteKey: string | null
  /** Answers given (blanks left out). */
  answered: number
  correct: number
  correctPct: number | null
  /** Most frequent answers: a = answer, c = how many, s = how many of them by strong students, right = counted correct. */
  dist: { a: string; c: number; s: number; right: boolean }[]
  strongN: number
  /** The answer the students point to, when the statistics name one. */
  suggested: string | null
  /** 3 = almost certainly wrong, 2 = likely, 1 = worth a look. */
  level: 1 | 2 | 3
  signals: AuditSignal[]
  score: number
}
export type AuditResult = { rows: AuditRow[]; checkedQuestions: number; checkedMocks: number; generatedAt: string }

const clean = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '')
const isBlank = (a: string) => a === '' || a === '-' || a === '—' || a === 'NULL'
const isLetter = (a: string) => /^[ABCD]$/.test(a)

/** "7/2", "3.5", "3,5", ".5", "-1/4" → number; anything else → null. */
export function toNumber(raw: string): number | null {
  const s = raw.replace(/,/g, '.').replace(/[−–]/g, '-')
  if (/^-?\d*\.?\d+$/.test(s)) return Number(s)
  const m = /^(-?\d*\.?\d+)\/(\d*\.?\d+)$/.exec(s)
  if (m && Number(m[2]) !== 0) return Number(m[1]) / Number(m[2])
  return null
}

/** Same value written another way (or a decimal truncated/rounded the way the SAT accepts). */
export function sameValue(a: string, b: string): boolean {
  if (a === b) return true
  // the bot lets a key list several accepted forms: "0.013=0.0138=0.014"
  if (/[=;|]/.test(a) || /[=;|]/.test(b)) {
    const xs = a.split(/[=;|]/).filter(Boolean)
    const ys = b.split(/[=;|]/).filter(Boolean)
    return xs.some((x) => ys.some((y) => sameValue(x, y)))
  }
  const x = toNumber(a)
  const y = toNumber(b)
  if (x == null || y == null) return false
  if (Math.abs(x - y) < 1e-9) return true
  // 2/3 → .666 / .667 / 0.67: accept a decimal that agrees to the digits it shows (3+ significant)
  const dec = (s: string) => (/\./.test(s) ? s.replace(/^-?0*\./, '.').replace(/[^0-9]/g, '').length : 0)
  const d = Math.max(dec(a.replace(/,/g, '.')), dec(b.replace(/,/g, '.')))
  if (d >= 2) return Math.abs(x - y) <= 1 / 10 ** d + 1e-12
  return false
}

type Agg = {
  testLabel: string | null
  botCode: string | null
  mockName: string
  qNo: number | null
  questionId: string | null
  type: 'mcq' | 'gridin' | null
  botKey: string | null
  siteKey: string | null
  given: Map<string, { c: number; s: number; right: number }>
  strongN: number
  reports: number
}

type SiteQ = { id: string; type: 'mcq' | 'gridin'; key: string | null; label: string }

/** The site separates accepted grid-in forms with commas ("1/2, 0.5"); the bot with "=". Bring a site key to the bot's form. */
const siteForm = (key: string, type: 'mcq' | 'gridin' | null) => (type === 'gridin' ? key.split(',').map((v) => clean(v)).filter(Boolean).join('=') : clean(key))

export async function runKeyAudit(sb: SupabaseClient): Promise<AuditResult> {
  const [{ data: botTests }, { data: cfgs }, att, qs, { data: reports }] = await Promise.all([
    sb.from('bot_tests').select('code, name, answers, question_count, test_label, origin'),
    sb.from('test_configs').select('test_label, subject, placement, scored, math_layout'),
    fetchAll<{ source: string; bot_code: string | null; test_label: string | null; correct: number | null; total: number | null; answers: Record<string, unknown> | null; wrong_nos: number[] | null; wrong_qids: string[] | null }>(
      (from, to) => sb.from('attempt_log').select('source, bot_code, test_label, correct, total, answers, wrong_nos, wrong_qids').order('id').range(from, to),
    ),
    fetchAll<{ id: string; kind: string; type: string | null; correct: string | null; correct_value: string | null; module_number: number | null; test_label: string | null }>(
      (from, to) =>
        sb
          .from('questions')
          .select('id, kind, type, correct, correct_value, module_number, test_label')
          .not('test_label', 'is', null)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
    ),
    sb.from('question_reports').select('question_id, status').not('question_id', 'is', null),
  ])

  // ---- site questions, per mock, in exam order ----
  const cfgOf = new Map((cfgs ?? []).map((c) => [c.test_label as string, c]))
  const byLabel = new Map<string, typeof qs.data>()
  const siteQ = new Map<string, SiteQ>()
  for (const q of qs.data) {
    const label = q.test_label as string
    if (!byLabel.has(label)) byLabel.set(label, [])
    byLabel.get(label)!.push(q)
    const type = (q.type ?? 'mcq') === 'gridin' ? 'gridin' : 'mcq'
    siteQ.set(q.id, { id: q.id, type, key: (type === 'mcq' ? q.correct : q.correct_value) ?? null, label })
  }
  /** label → question ids in the order the student (and the bot) numbers them: all, and Math only. */
  const orderOf = new Map<string, { all: string[]; math: string[] }>()
  for (const [label, rows] of byLabel) {
    const cfg = cfgOf.get(label)
    const toQ = (kind: string): Question[] =>
      rows
        .filter((r) => r.kind === kind)
        .map((r) => ({ id: r.id, type: (r.type ?? 'mcq') as Question['type'], prompt: '', moduleNumber: r.module_number === 1 || r.module_number === 2 ? r.module_number : undefined }) as Question)
    const items = await assemblePdfItems(
      cfg ? { subject: cfg.subject, placement: cfg.placement, scored: cfg.scored, mathLayout: cfg.math_layout } : null,
      async (kind) => toQ(kind),
    )
    orderOf.set(label, { all: items.map((i) => i.question.id as string), math: items.filter((i) => i.sectionKind === 'math').map((i) => i.question.id as string) })
  }
  const noOf = new Map<string, number>()
  for (const o of orderOf.values()) o.all.forEach((id, i) => noOf.set(id, i + 1))

  // ---- bot tests: which site question is behind each number ----
  const bot = new Map((botTests ?? []).map((t) => [t.code as string, t]))
  const botMap = new Map<string, string[] | null>()
  for (const t of botTests ?? []) {
    const label = t.test_label as string | null
    const n = Object.keys((t.answers ?? {}) as object).filter((k) => /^\d+$/.test(k)).length || (t.question_count ?? 0)
    const o = label ? orderOf.get(label) : undefined
    botMap.set(t.code as string, !o ? null : o.math.length === n ? o.math : o.all.length === n ? o.all : null)
  }

  const aggs = new Map<string, Agg>()
  const get = (key: string, init: () => Agg) => {
    let a = aggs.get(key)
    if (!a) aggs.set(key, (a = init()))
    return a
  }
  const forSite = (qid: string): Agg | null => {
    const q = siteQ.get(qid)
    if (!q) return null
    return get(`q:${qid}`, () => ({ testLabel: q.label, botCode: null, mockName: q.label, qNo: noOf.get(qid) ?? null, questionId: qid, type: q.type, botKey: null, siteKey: q.key, given: new Map(), strongN: 0, reports: 0 }))
  }
  const forBot = (code: string, no: number): Agg | null => {
    const t = bot.get(code)
    if (!t) return null
    const key = clean(((t.answers ?? {}) as Record<string, unknown>)[String(no)]) || null
    const qid = botMap.get(code)?.[no - 1]
    const a = qid ? forSite(qid) : get(`b:${code}:${no}`, () => ({ testLabel: null, botCode: code, mockName: (t.name as string) ?? code, qNo: no, questionId: null, type: null, botKey: null, siteKey: null, given: new Map(), strongN: 0, reports: 0 }))
    if (a) {
      a.botCode = code
      a.botKey = key
    }
    return a
  }

  // every question of every bot test gets a row (so format / key-difference checks see unsolved tests too)
  for (const t of botTests ?? []) {
    for (const k of Object.keys((t.answers ?? {}) as object)) if (/^\d+$/.test(k)) forBot(t.code as string, Number(k))
  }

  const add = (a: Agg, answer: string, right: boolean, strong: boolean) => {
    if (isBlank(answer)) return
    const g = a.given.get(answer) ?? { c: 0, s: 0, right: 0 }
    g.c++
    if (strong) g.s++
    if (right) g.right++
    a.given.set(answer, g)
    if (strong) a.strongN++
  }
  for (const l of att.data) {
    const strong = !!l.total && l.total >= 10 && (l.correct ?? 0) / l.total >= 0.8
    const answers = l.answers ?? {}
    if (l.source === 'bot' && l.bot_code) {
      const wrong = new Set(l.wrong_nos ?? [])
      for (const [k, v] of Object.entries(answers)) {
        if (!/^\d+$/.test(k)) continue
        const a = forBot(l.bot_code, Number(k))
        if (a) add(a, clean(v), !wrong.has(Number(k)), strong)
      }
    } else if (l.source === 'web') {
      // graded against the key as it is NOW (the log keeps the result of the day it was solved)
      for (const [qid, v] of Object.entries(answers)) {
        const a = forSite(qid)
        if (!a || v == null) continue
        const raw = String(v).trim()
        const right = !!a.siteKey && isCorrectAnswer(a.type === 'gridin' ? ({ type: 'gridin', prompt: '', correctValue: a.siteKey } as Question) : ({ type: 'mcq', prompt: '', correct: a.siteKey } as Question), raw)
        add(a, clean(raw), right, strong)
      }
    }
  }
  for (const r of reports ?? []) {
    if (r.status === 'resolved' || r.status === 'rejected' || r.status === 'closed') continue
    const a = forSite(r.question_id as string)
    if (a) a.reports++
  }

  // ---- judge ----
  const rows: AuditRow[] = []
  for (const [id, a] of aggs) {
    const signals: AuditSignal[] = []
    let score = 0
    let level: 1 | 2 | 3 = 1
    const up = (l: 1 | 2 | 3, s: number) => {
      if (l > level) level = l
      score += s
    }
    const siteKey = a.siteKey ? siteForm(a.siteKey, a.type) : null
    const key = a.botKey ?? siteKey
    const dist = [...a.given.entries()].map(([ans, g]) => ({ a: ans, c: g.c, s: g.s, right: g.right * 2 > g.c })).sort((x, y) => y.c - x.c)
    const answered = dist.reduce((n, d) => n + d.c, 0)
    const correct = [...a.given.values()].reduce((n, g) => n + g.right, 0)
    const correctPct = answered ? Math.round((100 * correct) / answered) : null
    const wrongs = dist.filter((d) => !d.right)
    const top = wrongs[0]
    let suggested: string | null = null

    if (a.botKey && siteKey && !sameValue(a.botKey, siteKey)) {
      signals.push({ code: 'KEY_DIFF', text: `Botdagi kalit (${a.botKey}) va saytdagi kalit (${a.siteKey}) har xil` })
      up(3, 100)
    }

    if (key == null || key === '') {
      if (a.botCode || a.questionId) {
        signals.push({ code: 'FORMAT', text: "Kalit bo'sh" })
        up(3, 90)
      }
    } else {
      const letters = dist.filter((d) => isLetter(d.a)).reduce((n, d) => n + d.c, 0)
      if (/^[A-Z]$/.test(key) && !isLetter(key)) {
        signals.push({ code: 'FORMAT', text: `Kalit "${key}" — A, B, C, D emas` })
        up(3, 90)
      } else if (a.type === 'mcq' && !isLetter(key)) {
        signals.push({ code: 'FORMAT', text: `Savol A–D turida, kalit esa "${key}"` })
        up(3, 90)
      } else if (a.type === 'gridin' && isLetter(key)) {
        signals.push({ code: 'FORMAT', text: `Savol yozma javobli, kalit esa harf (${key})` })
        up(3, 90)
      } else if (answered >= 3 && isLetter(key) && letters / answered <= 0.2) {
        signals.push({ code: 'FORMAT', text: `Kalit harf (${key}), o'quvchilar esa son yozgan — savol yozma javobli bo'lishi mumkin` })
        up(3, 80)
      } else if (answered >= 3 && !isLetter(key) && letters / answered >= 0.8) {
        signals.push({ code: 'FORMAT', text: `Kalit son (${key}), o'quvchilar esa harf belgilagan — savol A–D turida bo'lishi mumkin` })
        up(3, 80)
      }

      const eq = wrongs.filter((d) => sameValue(d.a, key))
      const eqN = eq.reduce((n, d) => n + d.c, 0)
      if (eqN > 0) {
        signals.push({ code: 'EQUIV', text: `${eqN} ta to'g'ri javob xato deb hisoblangan: ${eq.map((d) => d.a).join(', ')} = ${key}` })
        up(eqN >= 2 ? 3 : 2, 60 + eqN)
      }
    }

    const realTop = top && key && sameValue(top.a, key) ? wrongs[1] : top
    if (realTop && answered > 0) {
      const topPct = (100 * realTop.c) / answered
      const strongWrong = wrongs.reduce((n, d) => n + d.s, 0)
      if (a.strongN >= 3 && strongWrong / a.strongN >= 0.7 && realTop.s / a.strongN >= 0.6) {
        signals.push({ code: 'STRONG', text: `Kuchli o'quvchilarning ${realTop.s}/${a.strongN} tasi "${realTop.a}" degan` })
        up(a.strongN >= 5 ? 3 : 2, 50 + realTop.s * 3)
        suggested = realTop.a
      }
      if (answered >= 5 && (correctPct ?? 0) <= 20 && topPct >= 60) {
        signals.push({ code: 'MAJORITY', text: `${Math.round(topPct)}% o'quvchi "${realTop.a}" degan, kalitga faqat ${correctPct}% mos` })
        up(answered >= 8 ? 3 : 2, 40 + Math.min(answered, 30))
        suggested = realTop.a
      } else if (answered >= 3 && answered < 5 && correct === 0 && realTop.c === answered) {
        signals.push({ code: 'MAJORITY', text: `Yechgan ${answered} kishining hammasi "${realTop.a}" degan, kalitga hech kim mos emas` })
        up(2, 30)
        suggested = realTop.a
      } else if (answered >= 5 && (correctPct ?? 0) <= 35 && topPct >= 50 && !signals.some((s) => s.code === 'STRONG')) {
        signals.push({ code: 'MAJORITY', text: `${Math.round(topPct)}% o'quvchi "${realTop.a}" degan, kalitga ${correctPct}% mos` })
        up(1, 15)
        suggested = realTop.a
      }
    }
    if (a.reports > 0) {
      signals.push({ code: 'REPORT', text: `${a.reports} ta o'quvchi bu savolni xato deb xabar bergan` })
      up(2, 35 + a.reports * 5)
    }
    if (signals.length === 0 && answered >= 8 && (correctPct ?? 100) <= 10) {
      signals.push({ code: 'NOBODY', text: `${answered} kishidan deyarli hech kim yecholmagan — juda qiyin yoki kalit xato` })
      up(1, 10)
    }
    if (signals.length === 0) continue

    rows.push({
      id,
      testLabel: a.testLabel,
      botCode: a.botCode,
      mockName: a.mockName,
      qNo: a.qNo,
      questionId: a.questionId,
      type: a.type,
      botKey: a.botKey,
      siteKey: a.siteKey,
      answered,
      correct,
      correctPct,
      dist: dist.slice(0, 5),
      strongN: a.strongN,
      suggested,
      level,
      signals,
      score,
    })
  }
  rows.sort((x, y) => y.level - x.level || y.score - x.score)
  return { rows, checkedQuestions: aggs.size, checkedMocks: new Set([...aggs.values()].map((a) => a.testLabel ?? `b:${a.botCode}`)).size, generatedAt: new Date().toISOString() }
}
