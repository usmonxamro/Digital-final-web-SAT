import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { mockQuota } from '@/lib/exam-limits'
import { planOf } from '@/lib/plan-db'
import { adminIdentity } from '@/lib/admin-auth'

/** Today's mock usage, for the "Bugun: 1/3" badge on the mocks page. */
export async function GET() {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ quota: null })
  try {
    // Owner / admins: no limits.
    if (await adminIdentity().catch(() => null)) return NextResponse.json({ quota: null, unlimited: true })
    const supabase = supabaseAdmin()
    return NextResponse.json({ quota: await mockQuota(supabase, session.userId, await planOf(supabase, session.userId)) })
  } catch {
    return NextResponse.json({ quota: null })
  }
}
