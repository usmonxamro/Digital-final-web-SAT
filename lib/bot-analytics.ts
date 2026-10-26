/**
 * "O'quvchilar tahlili" — pure calculations over the bot's results (no React, no fetching).
 * The API (/api/admin/bot-analytics) sends raw rows once; every chart is computed here in the browser.
 *
 * Rules (the same ones the bot uses):
 *  - An attempt belongs to group G when it was sent from G (chat = G), or it has no group
 *    (chat = null) but the student is in G and the test is assigned to G.
 *  - A student "did" an assigned test if they solved it at any time, anywhere
 *    (he often assigns a mock days after students already solved it).
 *  - Rankings use each student's FIRST attempt (a re-solve with permission doesn't replace it).
 */

export type BotTest = {
  code: string
  name: string
  kind: string
  level: string
  count: number
  createdAt: string | null
  origin: string
  /** question number → correct answer */
  key: Record<string, string>
}
export type BotGroup = { chatId: number; title: string; slug: string | null; addedAt: string | null }
export type BotMember = { chatId: number; tg: number; n: string; u: string; at: string | null }
export type BotAssignment = { code: string; chatId: number; at: string | null }
/** One submission. c/t = correct/total, s = score text ("730 / 800" or "18/20"), w = wrong question numbers. */
export type BotAttempt = { id: number; tg: number; chat: number | null; code: string; c: number; t: number; s: string; w: number[]; at: string }
export type BotAnalyticsData = {
  generatedAt: string
  tests: BotTest[]
  groups: BotGroup[]
  members: BotMember[]
  assignments: BotAssignment[]
  attempts: BotAttempt[]
  /** tg_id → name (n), username (u), name_set (s: the student typed his real name in the bot) */
  accounts: Record<string, { n: string; u: string; s: boolean }>
}
/** attempt id → question number → the student's answer */
export type BotAnswersData = Record<string, Record<string, string>>

const DAY = 86_400_000
const TZ_OFFSET = 5 * 3600_000 // Asia/Tashkent, no DST

/** Days since 1970-01-01 in Tashkent time. */
export const tashDay = (iso: string) => Math.floor((Date.parse(iso) + TZ_OFFSET) / DAY)
/** Monday-based week number in Tashkent time (1970-01-01 was a Thursday). */
export const tashWeek = (iso: string) => Math.floor((tashDay(iso) + 3) / 7)

export const pct = (a: Pick<BotAttempt, 'c' | 't'>) => (a.t > 0 ? (100 * a.c) / a.t : 0)
/** "730 / 800" → 730; anything else → null. */
export function scaled(a: Pick<BotAttempt, 's'>): number | null {
  const m = /^\s*(\d{3})\s*\/\s*800\s*$/.exec(a.s)
  return m ? Number(m[1]) : null
}
export const isSatMock = (t: BotTest | undefined) => !!t && /_44$/.test(t.kind)

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export type MockRow = {
  rank: number
  tg: number
  attempt: BotAttempt
  pct: number
  scaled: number | null
  /** how many times this student sent this test in total */
  tries: number
  /** solved, but from another group (still counts as done) */
  elsewhere: boolean
}
export type QuestionStat = { no: number; key: string; n: number; wrong: number; wrongPct: number }
export type MockStats = {
  test: BotTest | undefined
  rows: MockRow[]
  /** group members who have not solved it (group view only) */
  notSolved: number[]
  questions: QuestionStat[]
  avgPct: number | null
  medianPct: number | null
  avgScaled: number | null
  bestScaled: number | null
}
export type GroupSummary = {
  group: BotGroup
  members: number
  assigned: number
  attempts: number
  /** done (student, assigned test) pairs / all pairs, 0..100 */
  completion: number | null
  avgPct: number | null
  last: string | null
  active7: number
}
export type StudentInGroup = {
  tg: number
  done: number
  assigned: number
  attempts: number
  avgPct: number | null
  avgScaled: number | null
  last: string | null
  /** submissions per week, last 8 weeks (oldest → newest) */
  weeks: number[]
}
export type StudentProfile = {
  tg: number
  attempts: BotAttempt[]
  tests: number
  avgPct: number | null
  avgScaled: number | null
  bestScaled: number | null
  first: string | null
  last: string | null
  /** typical days between two sending days */
  medianGapDays: number | null
  activeDays30: number
  weeks: { week: number; count: number }[]
  /** first attempt per SAT mock, in time order */
  trend: { at: string; value: number; code: string }[]
  groups: number[]
}
export type HardQuestion = QuestionStat & { code: string; name: string; tests: number }

export class BotModel {
  readonly data: BotAnalyticsData
  readonly test = new Map<string, BotTest>()
  readonly group = new Map<number, BotGroup>()
  private memberName = new Map<number, string>()
  private memberUser = new Map<number, string>()
  private membersOfGroup = new Map<number, Set<number>>()
  private groupsOfStudent = new Map<number, Set<number>>()
  private assignedOf = new Map<number, BotAssignment[]>()
  private assignedSet = new Set<string>()
  readonly byStudent = new Map<number, BotAttempt[]>()
  readonly byTest = new Map<string, BotAttempt[]>()
  readonly now: number

  constructor(data: BotAnalyticsData) {
    this.data = data
    this.now = Date.parse(data.generatedAt) || Date.now()
    for (const t of data.tests) this.test.set(t.code, t)
    for (const g of data.groups) this.group.set(g.chatId, g)
    const join = (chat: number, tg: number) => {
      if (!this.membersOfGroup.has(chat)) this.membersOfGroup.set(chat, new Set())
      this.membersOfGroup.get(chat)!.add(tg)
      if (!this.groupsOfStudent.has(tg)) this.groupsOfStudent.set(tg, new Set())
      this.groupsOfStudent.get(tg)!.add(chat)
    }
    for (const m of data.members) {
      if (!this.group.has(m.chatId)) continue
      join(m.chatId, m.tg)
      if (m.n && !this.memberName.has(m.tg)) this.memberName.set(m.tg, m.n)
      if (m.u && !this.memberUser.has(m.tg)) this.memberUser.set(m.tg, m.u)
    }
    for (const a of data.assignments) {
      if (!this.group.has(a.chatId)) continue
      if (!this.assignedOf.has(a.chatId)) this.assignedOf.set(a.chatId, [])
      this.assignedOf.get(a.chatId)!.push(a)
      this.assignedSet.add(`${a.chatId}|${a.code}`)
    }
    for (const list of this.assignedOf.values()) list.sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''))
    const sorted = [...data.attempts].sort((x, y) => x.at.localeCompare(y.at) || x.id - y.id)
    for (const a of sorted) {
      if (!this.byStudent.has(a.tg)) this.byStudent.set(a.tg, [])
      this.byStudent.get(a.tg)!.push(a)
      if (!this.byTest.has(a.code)) this.byTest.set(a.code, [])
      this.byTest.get(a.code)!.push(a)
      // sending from a group makes you a visible student of it even if the bot never saw you join
      if (a.chat != null && this.group.has(a.chat)) join(a.chat, a.tg)
    }
  }

  // ---------- names ----------
  name(tg: number): string {
    const acc = this.data.accounts[tg]
    if (acc?.s && acc.n) return acc.n
    return this.memberName.get(tg) || acc?.n || (this.username(tg) ? `@${this.username(tg)}` : `ID ${tg}`)
  }
  username(tg: number): string {
    return (this.data.accounts[tg]?.u || this.memberUser.get(tg) || '').replace(/^@+/, '')
  }
  testName = (code: string) => this.test.get(code)?.name ?? `Test ${code}`

  // ---------- membership ----------
  members(chat: number): number[] {
    return [...(this.membersOfGroup.get(chat) ?? [])]
  }
  groupsOf(tg: number): number[] {
    return [...(this.groupsOfStudent.get(tg) ?? [])]
  }
  assigned(chat: number): BotAssignment[] {
    return this.assignedOf.get(chat) ?? []
  }
  isAssigned(chat: number, code: string) {
    return this.assignedSet.has(`${chat}|${code}`)
  }
  groupsOfTest(code: string): number[] {
    return this.data.groups.filter((g) => this.isAssigned(g.chatId, code)).map((g) => g.chatId)
  }
  inGroup(a: BotAttempt, chat: number): boolean {
    if (a.chat != null) return a.chat === chat
    return !!this.membersOfGroup.get(chat)?.has(a.tg) && this.isAssigned(chat, a.code)
  }
  solved(tg: number, code: string): boolean {
    return (this.byStudent.get(tg) ?? []).some((a) => a.code === code)
  }

  // ---------- one test ----------
  /** First attempt per student; in a group view the group's own attempt wins over one sent from elsewhere. */
  mock(code: string, chat: number | null = null): MockStats {
    const test = this.test.get(code)
    const all = this.byTest.get(code) ?? []
    const tries = new Map<number, number>()
    for (const a of all) tries.set(a.tg, (tries.get(a.tg) ?? 0) + 1)

    const pick = new Map<number, { a: BotAttempt; elsewhere: boolean }>()
    if (chat == null) {
      for (const a of all) if (!pick.has(a.tg)) pick.set(a.tg, { a, elsewhere: false })
    } else {
      const members = this.membersOfGroup.get(chat) ?? new Set<number>()
      for (const a of all) if (this.inGroup(a, chat) && !pick.has(a.tg)) pick.set(a.tg, { a, elsewhere: false })
      for (const a of all) if (members.has(a.tg) && !pick.has(a.tg)) pick.set(a.tg, { a, elsewhere: true })
    }
    const rows: MockRow[] = [...pick.entries()]
      .map(([tg, { a, elsewhere }]) => ({ rank: 0, tg, attempt: a, pct: pct(a), scaled: scaled(a), tries: tries.get(tg) ?? 1, elsewhere }))
      .sort((x, y) => (y.scaled ?? -1) - (x.scaled ?? -1) || y.pct - x.pct || x.attempt.at.localeCompare(y.attempt.at))
    rows.forEach((r, i) => {
      const prev = rows[i - 1]
      r.rank = prev && prev.pct === r.pct && prev.scaled === r.scaled ? prev.rank : i + 1
    })

    const notSolved = chat == null ? [] : this.members(chat).filter((tg) => !pick.has(tg))
    const questions = questionStats(test, rows.map((r) => r.attempt))
    const sc = rows.map((r) => r.scaled).filter((x): x is number => x != null)
    return {
      test,
      rows,
      notSolved,
      questions,
      avgPct: mean(rows.map((r) => r.pct)),
      medianPct: median(rows.map((r) => r.pct)),
      avgScaled: mean(sc),
      bestScaled: sc.length ? Math.max(...sc) : null,
    }
  }

  // ---------- groups ----------
  groupSummary(chat: number): GroupSummary {
    const group = this.group.get(chat)!
    const members = this.members(chat)
    const assigned = this.assigned(chat)
    let done = 0
    for (const tg of members) for (const a of assigned) if (this.solved(tg, a.code)) done++
    const atts = this.data.attempts.filter((a) => this.inGroup(a, chat))
    const last = atts.reduce<string | null>((m, a) => (!m || a.at > m ? a.at : m), null)
    const weekAgo = this.now - 7 * DAY
    return {
      group,
      members: members.length,
      assigned: assigned.length,
      attempts: atts.length,
      completion: members.length && assigned.length ? (100 * done) / (members.length * assigned.length) : null,
      avgPct: mean(atts.map(pct)),
      last,
      active7: new Set(atts.filter((a) => Date.parse(a.at) >= weekAgo).map((a) => a.tg)).size,
    }
  }

  studentInGroup(tg: number, chat: number): StudentInGroup {
    const assigned = this.assigned(chat)
    const mine = (this.byStudent.get(tg) ?? []).filter((a) => this.inGroup(a, chat))
    const all = this.byStudent.get(tg) ?? []
    const sc = mine.map(scaled).filter((x): x is number => x != null)
    const nowWeek = tashWeek(new Date(this.now).toISOString())
    const weeks = Array.from({ length: 8 }, () => 0)
    for (const a of all) {
      const i = 7 - (nowWeek - tashWeek(a.at))
      if (i >= 0 && i < 8) weeks[i]++
    }
    return {
      tg,
      done: assigned.filter((x) => this.solved(tg, x.code)).length,
      assigned: assigned.length,
      attempts: mine.length,
      avgPct: mean(mine.map(pct)),
      avgScaled: mean(sc),
      last: all.length ? all[all.length - 1].at : null,
      weeks,
    }
  }

  // ---------- one student ----------
  student(tg: number): StudentProfile {
    const atts = this.byStudent.get(tg) ?? []
    const days = [...new Set(atts.map((a) => tashDay(a.at)))].sort((a, b) => a - b)
    const gaps = days.slice(1).map((d, i) => d - days[i])
    const today = tashDay(new Date(this.now).toISOString())
    const nowWeek = Math.floor((today + 3) / 7)
    const weeks = Array.from({ length: 12 }, (_, i) => ({ week: nowWeek - 11 + i, count: 0 }))
    for (const a of atts) {
      const i = tashWeek(a.at) - (nowWeek - 11)
      if (i >= 0 && i < 12) weeks[i].count++
    }
    const seen = new Set<string>()
    const trend: StudentProfile['trend'] = []
    for (const a of atts) {
      if (seen.has(a.code)) continue
      seen.add(a.code)
      const s = scaled(a)
      if (s != null) trend.push({ at: a.at, value: s, code: a.code })
    }
    const sc = atts.map(scaled).filter((x): x is number => x != null)
    return {
      tg,
      attempts: [...atts].reverse(),
      tests: seen.size,
      avgPct: mean(atts.map(pct)),
      avgScaled: mean(sc),
      bestScaled: sc.length ? Math.max(...sc) : null,
      first: atts[0]?.at ?? null,
      last: atts[atts.length - 1]?.at ?? null,
      medianGapDays: median(gaps),
      activeDays30: days.filter((d) => d > today - 30).length,
      weeks,
      trend,
      groups: this.groupsOf(tg),
    }
  }

  // ---------- most missed questions ----------
  hardQuestions(chat: number | null, minAttempts = 5): HardQuestion[] {
    const codes = new Set<string>()
    if (chat == null) for (const c of this.byTest.keys()) codes.add(c)
    else {
      for (const a of this.assigned(chat)) codes.add(a.code)
      for (const a of this.data.attempts) if (a.chat === chat) codes.add(a.code)
    }
    const out: HardQuestion[] = []
    for (const code of codes) {
      const m = this.mock(code, chat)
      for (const q of m.questions) {
        if (q.n < minAttempts || q.wrong === 0) continue
        out.push({ ...q, code, name: this.testName(code), tests: m.rows.length })
      }
    }
    return out.sort((a, b) => b.wrongPct - a.wrongPct || b.n - a.n)
  }
}

export function questionStats(test: BotTest | undefined, attempts: BotAttempt[]): QuestionStat[] {
  const nos = test
    ? Object.keys(test.key)
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b)
    : []
  const wrong = new Map<number, number>()
  for (const a of attempts) for (const q of a.w) wrong.set(q, (wrong.get(q) ?? 0) + 1)
  const n = attempts.length
  return nos.map((no) => {
    const w = wrong.get(no) ?? 0
    return { no, key: test?.key[String(no)] ?? '', n, wrong: w, wrongPct: n ? (100 * w) / n : 0 }
  })
}

/** Most common wrong answer for each question, from raw answers. */
export function topWrongAnswers(
  test: BotTest | undefined,
  attempts: BotAttempt[],
  answers: BotAnswersData,
): Map<number, { answer: string; count: number; blank: number }> {
  const out = new Map<number, { answer: string; count: number; blank: number }>()
  if (!test) return out
  const per = new Map<number, Map<string, number>>()
  const blanks = new Map<number, number>()
  for (const a of attempts) {
    const given = answers[a.id]
    if (!given) continue
    for (const q of a.w) {
      const v = (given[String(q)] ?? '').trim().toUpperCase().replace(/\s+/g, '')
      if (!v || v === '-') {
        blanks.set(q, (blanks.get(q) ?? 0) + 1)
        continue
      }
      if (!per.has(q)) per.set(q, new Map())
      per.get(q)!.set(v, (per.get(q)!.get(v) ?? 0) + 1)
    }
  }
  for (const q of new Set([...per.keys(), ...blanks.keys()])) {
    let best = ''
    let count = 0
    for (const [v, c] of per.get(q) ?? []) if (c > count) [best, count] = [v, c]
    out.set(q, { answer: best, count, blank: blanks.get(q) ?? 0 })
  }
  return out
}

// ---------- formatting (Tashkent time) ----------
const fmtDT = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Tashkent',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const fmtD = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtDM = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: '2-digit' })
export const dateTime = (iso: string | null) => (iso ? fmtDT.format(new Date(iso)).replace(',', '') : '—')
export const dateOnly = (iso: string | null) => (iso ? fmtD.format(new Date(iso)) : '—')
export const dayMonth = (iso: string) => fmtDM.format(new Date(iso))
/** "bugun", "kecha", "3 kun oldin", "2 hafta oldin" */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return '—'
  const d = tashDay(new Date(now).toISOString()) - tashDay(iso)
  if (d <= 0) return 'bugun'
  if (d === 1) return 'kecha'
  if (d < 14) return `${d} kun oldin`
  if (d < 60) return `${Math.round(d / 7)} hafta oldin`
  return `${Math.round(d / 30)} oy oldin`
}
export const KIND_LABEL: Record<string, string> = {
  modulli_44: 'SAT mock · modulli',
  ketmaket_44: 'SAT mock · ketma-ket',
  ixtiyoriy: 'Vazifa',
}
