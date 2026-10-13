'use client'

import { useCallback, useEffect, useState } from 'react'

export type PlanTask = { title: string; minutes: number }

export const DEFAULT_PLAN_TASKS: PlanTask[] = [
  { title: 'Math: Algebra mavzusini takrorlash', minutes: 30 },
  { title: 'Reading: Craft and Structure mashqlari', minutes: 30 },
  { title: 'Mock test (Module 1)', minutes: 60 },
]
const KEY = 'sb-day-plan'
const EVT = 'sb-day-plan-change'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })

function read(n: number): boolean[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { date?: string; done?: boolean[] } | null
    // A new day starts with a fresh checklist.
    if (v?.date !== today()) return Array(n).fill(false)
    return Array.from({ length: n }, (_, i) => !!v?.done?.[i])
  } catch {
    return Array(n).fill(false)
  }
}

/** Today's study-plan checklist, remembered in this browser and reset every day. */
export function useDayPlan(tasks: PlanTask[] = DEFAULT_PLAN_TASKS) {
  const n = tasks.length
  const [done, setDone] = useState<boolean[]>(() => Array(n).fill(false))

  useEffect(() => {
    const sync = () => setDone(read(n))
    sync()
    window.addEventListener(EVT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [n])

  const toggle = useCallback(
    (i: number) => {
      const next = read(n)
      next[i] = !next[i]
      try {
        localStorage.setItem(KEY, JSON.stringify({ date: today(), done: next }))
      } catch {
        /* storage blocked — keep it in memory only */
      }
      setDone(next)
      window.dispatchEvent(new Event(EVT))
    },
    [n],
  )

  return { tasks, done, toggle }
}
