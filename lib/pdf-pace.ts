/**
 * "Did the student really work through the test?" — decides whether the PDF download is offered afterwards.
 *
 * The exam engine counts the seconds each question was on screen (tab visible, clock running). A fast expert needs
 * roughly 25 minutes for the 44 Math questions; someone who just flips through to reach the end needs a few minutes.
 * The limits sit well below an honest fast pace, so a real student is never locked out.
 */
export const PACE = {
  /** Minimum average seconds per question. */
  mathSecPerQ: 24,
  readingSecPerQ: 20,
  /** A question looked at for less than this counts as "skipped past". */
  quickSec: 6,
  /** At most this share of the questions may be skipped past. */
  maxQuickShare: 0.25,
  /** One question can't "earn" more than this (sitting on a single question doesn't make up for skipping the rest). */
  capPerQSec: 240,
}

export type PaceModule = { id: string; kind: 'reading' | 'math'; total: number }

export type PaceVerdict = { ok: boolean; activeSec: number; neededSec: number; quick: number; total: number }

/** perQ: seconds on each question, keyed like the engine does (`<moduleId>:<index>`); wallSec: server time start → submit. */
export function paceVerdict(perQ: Record<string, number>, modules: PaceModule[], keyFor: (id: string, i: number) => string, wallSec: number | null): PaceVerdict {
  let active = 0
  let needed = 0
  let quick = 0
  let total = 0
  for (const m of modules) {
    const rate = m.kind === 'math' ? PACE.mathSecPerQ : PACE.readingSecPerQ
    for (let i = 0; i < m.total; i++) {
      const s = Math.min(PACE.capPerQSec, Math.max(0, perQ[keyFor(m.id, i)] ?? 0))
      active += s
      needed += rate
      total++
      if (s < PACE.quickSec) quick++
    }
  }
  // The server's own clock is the ceiling: a doctored client can't claim more time than really passed.
  const trusted = wallSec == null ? active : Math.min(active, wallSec)
  return { ok: total > 0 && trusted >= needed && quick <= total * PACE.maxQuickShare, activeSec: Math.round(trusted), neededSec: Math.round(needed), quick, total }
}
