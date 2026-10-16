'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Attempt = {
  id: string
  test_label: string
  subject: 'full' | 'math' | 'english'
  rw_scaled: number
  math_scaled: number
  composite: number
  correct_count?: number
  incorrect_count?: number
  omitted_count?: number
  created_at: string
}

export type TestSummary = {
  label: string
  readingCount: number
  mathCount: number
  subject: 'full' | 'math' | 'english'
  scored: boolean
  placement: 'mock' | 'course_task'
  hasVideo?: boolean
  done?: boolean
  section?: 'exams' | 'free'
  access?: 'free' | 'paid'
  /** Course group slug this mock is attached to (admin), or null. */
  courseGroup?: string | null
}

export type Platform = { totalUsers: number | null; ranked: number; rank: number | null; visits?: number | null }

type Data = {
  attempts: Attempt[] | null
  /** Every published test (mocks + course tasks). */
  tests: TestSummary[] | null
  platform: Platform | null
}

const Ctx = createContext<Data>({ attempts: null, tests: null, platform: null })

/** Loads the student's results, the test catalogue and platform numbers once for the whole dashboard. */
export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>({ attempts: null, tests: null, platform: null })
  useEffect(() => {
    fetch('/api/results')
      .then((r) => r.json())
      .then((d) => setData((p) => ({ ...p, attempts: d.attempts ?? [] })))
      .catch(() => setData((p) => ({ ...p, attempts: [] })))
    fetch('/api/tests')
      .then((r) => r.json())
      .then((d) => setData((p) => ({ ...p, tests: d.tests ?? [] })))
      .catch(() => setData((p) => ({ ...p, tests: [] })))
    fetch('/api/stats/platform')
      .then((r) => r.json())
      .then((d) => setData((p) => ({ ...p, platform: d })))
      .catch(() => setData((p) => ({ ...p, platform: { totalUsers: null, ranked: 0, rank: null } })))
  }, [])
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>
}

export const useDashboardData = () => useContext(Ctx)

const dayOf = (iso: string | number) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })

/** Consecutive study days (mock results) up to today or yesterday. */
export function studyStreak(attempts: Attempt[] | null): number {
  if (!attempts?.length) return 0
  const days = new Set(attempts.map((a) => dayOf(a.created_at)))
  let d = Date.now()
  if (!days.has(dayOf(d))) d -= 86400_000
  let n = 0
  while (days.has(dayOf(d))) {
    n++
    d -= 86400_000
  }
  return n
}
