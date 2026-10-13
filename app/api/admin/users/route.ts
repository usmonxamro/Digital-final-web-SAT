import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { planInfo } from '@/lib/plan'
import { groupBySlug } from '@/lib/course-groups'

export type UserRow = {
  id: string
  name: string
  email: string
  phone: string
  google: boolean
  role: 'admin' | 'user'
  plan: 'free' | 'premium'
  attempts: number
  courseMember: boolean
  /** Course groups unlocked (slugs). */
  courseGroups: string[]
  createdAt: string
}

const PAGE = 25

/** Registered users, newest first: GET ?page=0&q=text (searches name / email / phone). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const page = Math.max(0, Number(req.nextUrl.searchParams.get('page')) || 0)
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60).replace(/[,()%*\\]/g, ' ')

  const supabase = supabaseAdmin()
  let query = supabase.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (q) {
    const like = `%${q}%`
    query = query.or(`first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
  }
  const { data, count, error } = await query.range(page * PAGE, page * PAGE + PAGE - 1)
  if (error) {
    // Before the v50 SQL there is no email column: fall back to the older fields.
    let fb = supabase.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    if (q) fb = fb.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
    const r = await fb.range(page * PAGE, page * PAGE + PAGE - 1)
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
    return respond(supabase, r.data ?? [], r.count ?? 0, page)
  }
  return respond(supabase, data ?? [], count ?? 0, page)
}

async function respond(
  supabase: ReturnType<typeof supabaseAdmin>,
  rows: Record<string, unknown>[],
  total: number,
  page: number,
) {
  const ids = rows.map((r) => r.id as string)
  const counts = new Map<string, number>()
  if (ids.length) {
    const { data } = await supabase.from('test_attempts').select('user_id').in('user_id', ids)
    for (const a of data ?? []) counts.set(a.user_id as string, (counts.get(a.user_id as string) ?? 0) + 1)
  }
  const groups = new Map<string, string[]>()
  if (ids.length) {
    const { data } = await supabase.from('course_memberships').select('user_id, group_slug').in('user_id', ids)
    for (const r of data ?? []) groups.set(r.user_id as string, [...(groups.get(r.user_id as string) ?? []), r.group_slug as string])
  }
  const users: UserRow[] = rows.map((u) => ({
    id: u.id as string,
    name: `${u.first_name ?? ''} ${u.last_name === '-' ? '' : (u.last_name ?? '')}`.trim(),
    email: (u.email as string) ?? '',
    phone: (u.phone as string) ?? '',
    google: !!u.google_sub,
    role: u.role === 'admin' ? 'admin' : 'user',
    plan: planInfo(u as Parameters<typeof planInfo>[0]).plan,
    attempts: counts.get(u.id as string) ?? 0,
    courseMember: !!u.course_member,
    courseGroups: groups.get(u.id as string) ?? [],
    createdAt: u.created_at as string,
  }))
  return NextResponse.json({ users, total, page, pageSize: PAGE })
}

/** Turn course membership on/off for one student: PATCH { userId, courseMember }. */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as {
    userId?: string
    courseMember?: boolean
    /** Add (true) or remove (false) one course group by hand. */
    group?: string
    groupOn?: boolean
  } | null
  if (body?.userId && typeof body.group === 'string' && typeof body.groupOn === 'boolean') {
    if (!groupBySlug(body.group)) return NextResponse.json({ error: "Noma'lum guruh" }, { status: 400 })
    const sb = supabaseAdmin()
    const { error: gErr } = body.groupOn
      ? await sb.from('course_memberships').upsert({ user_id: body.userId, group_slug: body.group }, { onConflict: 'user_id,group_slug', ignoreDuplicates: true })
      : await sb.from('course_memberships').delete().eq('user_id', body.userId).eq('group_slug', body.group)
    if (gErr) return NextResponse.json({ error: "Avval Supabase'da v60 SQL'ni ishga tushiring (course_memberships)." }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (!body?.userId || typeof body.courseMember !== 'boolean') {
    return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 })
  }
  const { error } = await supabaseAdmin().from('users').update({ course_member: body.courseMember }).eq('id', body.userId)
  if (error) {
    return NextResponse.json({ error: "Avval Supabase'da v54 SQL'ni ishga tushiring (course_member ustuni yo'q)." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
