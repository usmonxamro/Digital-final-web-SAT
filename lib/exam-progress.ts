/** "Continue where you left off": what the exam saves on the student's open start (mock_starts.progress). */
export const PROGRESS_DAYS = 7
export const PROGRESS_MAX_BYTES = 40_000

export type ExamProgress = {
  v: 1
  /** Module being worked on, and the screen the student was on. */
  moduleIdx: number
  phase: 'testing' | 'autoNext' | 'break' | 'report'
  /** Question index inside the module. */
  current: number
  /** Seconds left (countdown) or elapsed (count-up) — the clock waits while the student is away. */
  timeLeft: number
  overtime: boolean
  /** Active working time so far, for the "took X minutes" label. */
  elapsedMs: number
  answers: Record<string, string>
  flags: Record<string, boolean>
  eliminated: Record<string, string[]>
  /** Seconds spent on each question (keyed like answers) — used for the PDF download check. */
  pace?: Record<string, number>
  /** For the dashboard banner. */
  answered: number
  total: number
  moduleLabel: string
}

const PHASES = ['testing', 'autoNext', 'break', 'report']
const num = (x: unknown, max: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(-max, Math.min(max, Math.round(x))) : 0)
const str = (x: unknown, n: number) => (typeof x === 'string' ? x.slice(0, n) : '')

/** Defensive copy of whatever the browser sent: only known fields, bounded sizes. Null if unusable. */
export function sanitizeProgress(raw: unknown): ExamProgress | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!PHASES.includes(r.phase as string)) return null
  const answers: Record<string, string> = {}
  const flags: Record<string, boolean> = {}
  const eliminated: Record<string, string[]> = {}
  let n = 0
  for (const [k, v] of Object.entries((r.answers as object) ?? {})) {
    if (++n > 400) break
    if (typeof v === 'string' && v) answers[str(k, 60)] = v.slice(0, 40)
  }
  n = 0
  for (const [k, v] of Object.entries((r.flags as object) ?? {})) {
    if (++n > 400) break
    if (v === true) flags[str(k, 60)] = true
  }
  n = 0
  for (const [k, v] of Object.entries((r.eliminated as object) ?? {})) {
    if (++n > 400) break
    if (Array.isArray(v) && v.length) eliminated[str(k, 60)] = v.slice(0, 6).map((c) => str(c, 4))
  }
  const pace: Record<string, number> = {}
  n = 0
  for (const [k, v] of Object.entries((r.pace as object) ?? {})) {
    if (++n > 400) break
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) pace[str(k, 60)] = Math.min(7200, Math.round(v))
  }
  const out: ExamProgress = {
    v: 1,
    moduleIdx: Math.max(0, num(r.moduleIdx, 20)),
    phase: r.phase as ExamProgress['phase'],
    current: Math.max(0, num(r.current, 500)),
    timeLeft: num(r.timeLeft, 100_000),
    overtime: r.overtime === true,
    elapsedMs: Math.max(0, num(r.elapsedMs, 1e9)),
    answers,
    flags,
    eliminated,
    pace,
    answered: Math.max(0, num(r.answered, 1000)),
    total: Math.max(0, num(r.total, 1000)),
    moduleLabel: str(r.moduleLabel, 60),
  }
  return JSON.stringify(out).length > PROGRESS_MAX_BYTES ? null : out
}

export const progressCutoff = () => new Date(Date.now() - PROGRESS_DAYS * 86_400_000).toISOString()
