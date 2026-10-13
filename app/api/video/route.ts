import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { adminIdentity } from '@/lib/admin-auth'
import { maskId } from '@/lib/youtube'

/**
 * The video analysis of a mock — only for a logged-in student who has
 * finished that mock (or an admin). The id travels masked; the page plays it
 * in our own player, with no YouTube link or button anywhere.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })

  const test = req.nextUrl.searchParams.get('test')?.slice(0, 120)
  if (!test) return NextResponse.json({ error: 'Mock topilmadi.' }, { status: 400 })

  const supabase = supabaseAdmin()
  const { data: cfg } = await supabase.from('test_configs').select('*').eq('test_label', test).maybeSingle()
  if (!cfg?.video_id) return NextResponse.json({ error: "Bu mock uchun video tahlil hali qo'shilmagan." }, { status: 404 })

  const isAdmin = !!(await adminIdentity().catch(() => null))
  if (!isAdmin) {
    const [{ data: att }, { data: st }] = await Promise.all([
      supabase.from('test_attempts').select('id').eq('user_id', session.userId).eq('test_label', test).limit(1),
      supabase
        .from('mock_starts')
        .select('id')
        .eq('user_id', session.userId)
        .eq('test_label', test)
        .not('graded_at', 'is', null)
        .limit(1),
    ])
    if ((att ?? []).length === 0 && (st ?? []).length === 0) {
      return NextResponse.json(
        { error: "Video tahlil mockni yechib bo'lgandan keyin ochiladi." },
        { status: 403 },
      )
    }
  }

  return NextResponse.json({ title: test, m: maskId(cfg.video_id as string) })
}
