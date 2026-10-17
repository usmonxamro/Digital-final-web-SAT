import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { fetchAll } from '@/lib/db-paginate'
import { groupBySlug } from '@/lib/course-groups'

export type GroupStats = {
  /** Students in the group. */
  members: number
  /** test label → how many of the group's students finished it. */
  done: Record<string, number>
}

/** GET ?slug=nov → who is in the group and how many of them finished each test. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  if (!groupBySlug(slug)) return NextResponse.json({ error: "Noma'lum guruh." }, { status: 400 })

  const sb = supabaseAdmin()
  const mem = await fetchAll<{ user_id: string }>((from, to) =>
    sb.from('course_memberships').select('user_id').eq('group_slug', slug).order('created_at').range(from, to),
  )
  const ids = [...new Set(mem.data.map((m) => m.user_id))]
  const out: GroupStats = { members: ids.length, done: {} }
  if (ids.length === 0) return NextResponse.json(out)

  // A student counts once per test, whether it is a graded start (tasks + mocks) or a saved scored attempt.
  const who = new Map<string, Set<string>>()
  const add = (label: string, user: string) => {
    let set = who.get(label)
    if (!set) who.set(label, (set = new Set()))
    set.add(user)
  }
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const [starts, attempts] = await Promise.all([
      fetchAll<{ user_id: string; test_label: string }>((from, to) =>
        sb.from('mock_starts').select('user_id, test_label').in('user_id', chunk).not('graded_at', 'is', null).order('id').range(from, to),
      ),
      fetchAll<{ user_id: string; test_label: string }>((from, to) =>
        sb.from('test_attempts').select('user_id, test_label').in('user_id', chunk).order('id').range(from, to),
      ),
    ])
    for (const r of [...starts.data, ...attempts.data]) add(r.test_label, r.user_id)
  }
  for (const [label, set] of who) out.done[label] = set.size
  return NextResponse.json(out)
}
