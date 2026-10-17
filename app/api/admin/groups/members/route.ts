import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { fetchAll } from '@/lib/db-paginate'
import { groupBySlug } from '@/lib/course-groups'

export type GroupMember = {
  userId: string
  name: string
  phone: string
  email: string
  /** 'code' = shared group code, 'telegram' = personal bot code, 'admin' = added by hand */
  via: 'code' | 'telegram' | 'admin'
  joinedAt: string
  /** How many different tests / tasks this student has finished. */
  done: number
}

/** GET ?slug=nov → the students who are in this group (separate list in Admin → Guruhlar → O'quvchilar). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  if (!groupBySlug(slug)) return NextResponse.json({ error: "Noma'lum guruh." }, { status: 400 })

  const sb = supabaseAdmin()
  const mem = await fetchAll<Record<string, unknown>>((from, to) =>
    sb.from('course_memberships').select('*').eq('group_slug', slug).order('created_at', { ascending: false }).range(from, to),
  )
  const ids = [...new Set(mem.data.map((m) => m.user_id as string))]
  if (ids.length === 0) return NextResponse.json({ members: [] as GroupMember[] })

  const users = new Map<string, Record<string, unknown>>()
  const done = new Map<string, Set<string>>()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const [u, starts, attempts] = await Promise.all([
      sb.from('users').select('*').in('id', chunk),
      fetchAll<{ user_id: string; test_label: string }>((from, to) =>
        sb.from('mock_starts').select('user_id, test_label').in('user_id', chunk).not('graded_at', 'is', null).order('id').range(from, to),
      ),
      fetchAll<{ user_id: string; test_label: string }>((from, to) =>
        sb.from('test_attempts').select('user_id, test_label').in('user_id', chunk).order('id').range(from, to),
      ),
    ])
    for (const r of u.data ?? []) users.set(r.id as string, r)
    for (const r of [...starts.data, ...attempts.data]) {
      let set = done.get(r.user_id)
      if (!set) done.set(r.user_id, (set = new Set()))
      set.add(r.test_label)
    }
  }

  const members: GroupMember[] = mem.data.map((m) => {
    const id = m.user_id as string
    const u = users.get(id) ?? {}
    const last = u.last_name === '-' ? '' : ((u.last_name as string) ?? '')
    const via = m.joined_via === 'code' ? 'code' : m.tg_id ? 'telegram' : 'admin'
    return {
      userId: id,
      name: `${(u.first_name as string) ?? ''} ${last}`.trim() || "Noma'lum",
      phone: (u.phone as string) ?? '',
      email: (u.email as string) ?? '',
      via,
      joinedAt: (m.created_at as string) ?? '',
      done: done.get(id)?.size ?? 0,
    }
  })
  return NextResponse.json({ members })
}
