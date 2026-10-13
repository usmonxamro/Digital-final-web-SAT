import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { planInfo, trialEndFromNow } from '@/lib/plan'
import { courseAccessFor } from '@/lib/course-access'
import { UserProvider, type DashboardUser } from '@/components/marketing/dashboard/user-context'
import { DashboardShell } from '@/components/marketing/dashboard/shell'
import './sd.css'

async function loadUser(): Promise<DashboardUser | null> {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return null

  try {
    const supabase = supabaseAdmin()
    const { data } = await supabase.from('users').select('*').eq('id', session.userId).maybeSingle()

    if (data) {
      // Everyone gets 30 days of free Pro — start the clock for an account
      // that doesn't have one yet (only possible once the v38 column exists).
      if ('premium_until' in data && !data.premium_until) {
        data.premium_until = trialEndFromNow()
        await supabase.from('users').update({ premium_until: data.premium_until }).eq('id', data.id)
      }
      const plan = planInfo(data)
      const access = await courseAccessFor(supabase, data)
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email ?? null,
        plan: plan.plan,
        trialDaysLeft: plan.trialDaysLeft,
        // Before the v54 column exists everyone keeps access.
        courseMember: access.all || access.groups.length > 0,
        courseAll: access.all,
        courseGroups: access.groups,
      }
    }
  } catch {
    // Supabase not configured yet — fall back to what the signed cookie already has,
    // so the dashboard still renders during local development without a DB.
  }
  return { id: session.userId, firstName: session.firstName }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await loadUser()
  if (!user) {
    redirect('/login')
  }

  return (
    <UserProvider user={user}>
      <DashboardShell>{children}</DashboardShell>
    </UserProvider>
  )
}
