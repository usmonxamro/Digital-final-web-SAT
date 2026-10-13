import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { fetchAll } from '@/lib/db-paginate'

export type MockStat = {
  label: string
  attempts: number
  users: number
  avgScore: number | null
  bestScore: number | null
  lastAt: string | null
}

export type MockAttemptRow = {
  id: string
  name: string
  phone: string
  composite: number
  rw: number
  math: number
  subject: string
  correct: number
  incorrect: number
  omitted: number
  elapsed: string | null
  createdAt: string
}

/**
 * GET                → per-mock summary (attempts, students, average / best score).
 * GET ?label=<mock>  → every attempt of that mock with the student's name.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const supabase = supabaseAdmin()
  const label = req.nextUrl.searchParams.get('label')

  if (label) {
    const { data, error } = await supabase
      .from('test_attempts')
      .select('id, composite, rw_scaled, math_scaled, subject, correct_count, incorrect_count, omitted_count, elapsed_label, created_at, users(first_name, last_name, phone)')
      .eq('test_label', label)
      .order('created_at', { ascending: false })
      .range(0, 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const attempts: MockAttemptRow[] = (data ?? []).map((a) => {
      const u = (Array.isArray(a.users) ? a.users[0] : a.users) as { first_name?: string; last_name?: string; phone?: string } | null
      return {
        id: a.id,
        name: u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : "Noma'lum",
        phone: u?.phone ?? '',
        composite: a.composite,
        rw: a.rw_scaled,
        math: a.math_scaled,
        subject: a.subject,
        correct: a.correct_count,
        incorrect: a.incorrect_count,
        omitted: a.omitted_count,
        elapsed: a.elapsed_label,
        createdAt: a.created_at,
      }
    })
    return NextResponse.json({ attempts })
  }

  const { data } = await fetchAll<{ test_label: string; user_id: string; composite: number; created_at: string }>(
    (from, to) =>
      supabase
        .from('test_attempts')
        .select('test_label, user_id, composite, created_at')
        .order('created_at', { ascending: false })
        .range(from, to),
  )
  const by = new Map<string, { n: number; users: Set<string>; sum: number; best: number; last: string }>()
  for (const a of data ?? []) {
    const k = a.test_label as string
    const b = by.get(k) ?? { n: 0, users: new Set<string>(), sum: 0, best: 0, last: a.created_at as string }
    b.n++
    b.users.add(a.user_id as string)
    b.sum += a.composite as number
    b.best = Math.max(b.best, a.composite as number)
    by.set(k, b)
  }
  const stats: MockStat[] = [...by.entries()].map(([label, b]) => ({
    label,
    attempts: b.n,
    users: b.users.size,
    avgScore: b.n ? Math.round(b.sum / b.n) : null,
    bestScore: b.n ? b.best : null,
    lastAt: b.last,
  }))
  return NextResponse.json({ stats })
}
