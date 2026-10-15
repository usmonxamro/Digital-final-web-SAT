import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export type NotifItem = {
  id: string
  kind: 'admin' | 'reply' | 'mocks'
  title: string
  body: string
  created_at: string
  unread: boolean
  href?: string
}

/** The student's bell: admin broadcasts, replies to their error reports, and how many mocks are new. */
export async function GET() {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ items: [], unread: 0 })
  const sb = supabaseAdmin()
  const { data: u } = await sb.from('users').select('*').eq('id', session.userId).maybeSingle()
  if (!u) return NextResponse.json({ items: [], unread: 0 })
  const seen = new Date((u.notifs_seen_at as string | null) ?? (u.created_at as string) ?? 0).getTime()

  const items: NotifItem[] = []
  const { data: rows } = await sb
    .from('notifications')
    .select('id, kind, title, body, created_at, user_id')
    .or(`user_id.is.null,user_id.eq.${session.userId}`)
    .order('created_at', { ascending: false })
    .limit(30)
  for (const r of rows ?? []) {
    items.push({
      id: r.id as string,
      kind: (r.kind as 'admin' | 'reply') ?? 'admin',
      title: (r.title as string) ?? '',
      body: (r.body as string) ?? '',
      created_at: r.created_at as string,
      unread: new Date(r.created_at as string).getTime() > seen,
    })
  }

  // New mocks since the student last looked.
  const { data: fresh } = await sb
    .from('test_configs')
    .select('test_label, created_at')
    .eq('placement', 'mock')
    .gt('created_at', new Date(seen).toISOString())
  const newMocks = (fresh ?? []).length
  if (newMocks > 0) {
    const newest = (fresh ?? []).reduce((m, r) => (r.created_at as string) > m ? (r.created_at as string) : m, '')
    items.unshift({ id: 'new-mocks', kind: 'mocks', title: String(newMocks), body: '', created_at: newest, unread: true, href: '/dashboard/practice' })
  }
  const unread = items.filter((i) => i.unread).length
  return NextResponse.json({ items, unread, newMocks })
}

/** { action: 'seen' } — the student opened the bell. */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'auth' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (b?.action === 'seen') await supabaseAdmin().from('users').update({ notifs_seen_at: new Date().toISOString() }).eq('id', session.userId)
  return NextResponse.json({ ok: true })
}
