import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { adminIdentity } from '@/lib/admin-auth'
import { planInfo } from '@/lib/plan'

export async function GET() {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) {
    return NextResponse.json({ user: null })
  }

  try {
    const supabase = supabaseAdmin()
    const { data: user } = await supabase.from('users').select('*').eq('id', session.userId).maybeSingle()
    if (!user) return NextResponse.json({ user: null })
    const admin = await adminIdentity().catch(() => null)
    const plan = planInfo(user)
    return NextResponse.json({
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone ?? null,
        email: user.email ?? null,
        created_at: user.created_at,
        plan: plan.plan,
        trialDaysLeft: plan.trialDaysLeft,
        isAdmin: !!admin,
      },
    })
  } catch {
    return NextResponse.json({ user: { id: session.userId, first_name: session.firstName } })
  }
}
