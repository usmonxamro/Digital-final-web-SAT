import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { mockQuota, quotaMessage, dailyLimitFor, MOCKS_PER_HOUR } from '@/lib/exam-limits'
import { planOf } from '@/lib/plan-db'
import { isMissingTable } from '@/lib/db-errors'
import { adminIdentity } from '@/lib/admin-auth'
import { planInfo } from '@/lib/plan'
import { courseAccessFor } from '@/lib/course-access'
import { canOpenTask, configGroups } from '@/lib/course-groups'

/** How long an unfinished start can be resumed (page reload) without using up another mock. */
const RESUME_HOURS = 3

/**
 * Called when a student opens a mock / course task. Enforces "3 mocks per day,
 * 2 per hour" for mocks and returns a start id that the grading request must
 * present (one grading per start). Reloading the page reuses the open start.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) {
    return NextResponse.json({ error: 'Mock yechish uchun tizimga kiring.', code: 'LOGIN' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const testLabel =
    typeof body?.testLabel === 'string' && body.testLabel.trim() ? body.testLabel.trim().slice(0, 120) : ''
  if (!testLabel) return NextResponse.json({ error: 'Mock tanlanmagan.' }, { status: 400 })

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Server sozlanmagan.' }, { status: 503 })
  }

  // Paid mocks: only admins, Pro students (incl. the free trial) and course students.
  {
    const { data: cfg } = await supabase.from('test_configs').select('access').eq('test_label', testLabel).maybeSingle()
    if (cfg?.access === 'paid' && !(await adminIdentity().catch(() => null))) {
      const { data: u } = await supabase.from('users').select('*').eq('id', session.userId).maybeSingle()
      const access = u ? await courseAccessFor(supabase, u) : null
      const allowed = !!u && (planInfo(u).plan === 'premium' || !!access?.all || (access?.groups.length ?? 0) > 0)
      if (!allowed) {
        return NextResponse.json(
          { error: "Bu mock pullik. Uni Pro foydalanuvchilar va kurs o'quvchilari ishlay oladi.", code: 'PAID' },
          { status: 402 },
        )
      }
    }
  }

  // Course tasks: only students of that course group (or admins).
  {
    const { data: cfg } = await supabase.from('test_configs').select('*').eq('test_label', testLabel).maybeSingle()
    if (cfg?.placement === 'course_task' && !(await adminIdentity().catch(() => null))) {
      const { data: u } = await supabase.from('users').select('*').eq('id', session.userId).maybeSingle()
      const access = u ? await courseAccessFor(supabase, u) : null
      if (!access || !canOpenTask(testLabel, access, configGroups(cfg))) {
        return NextResponse.json(
          { error: "Bu vazifa faqat kurs guruhi o'quvchilari uchun. Telegram botdan olgan kodingizni Kurslar bo'limida kiriting.", code: 'COURSE' },
          { status: 403 },
        )
      }
    }
  }

  // Resume an unfinished attempt of the same test (reload / second tab).
  const { data: open, error: openErr } = await supabase
    .from('mock_starts')
    .select('id')
    .eq('user_id', session.userId)
    .eq('test_label', testLabel)
    .is('graded_at', null)
    .gte('started_at', new Date(Date.now() - RESUME_HOURS * 3600_000).toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
  if (openErr) {
    if (isMissingTable(openErr)) return NextResponse.json({ startId: null }) // v38 SQL not run — fail open
    return NextResponse.json({ error: "Server xatosi. Birozdan keyin urinib ko'ring." }, { status: 503 })
  }
  if (open && open.length > 0) return NextResponse.json({ startId: open[0].id, resumed: true })

  // The owner and admins have no limits at all ('admin' starts never count).
  const isAdmin = !!(await adminIdentity().catch(() => null))
  let kind: 'mock' | 'task' | 'admin' = isAdmin ? 'admin' : 'mock'
  if (!isAdmin) {
    const { data: cfg } = await supabase.from('test_configs').select('*').eq('test_label', testLabel).maybeSingle()
    if (cfg?.placement === 'course_task') kind = 'task'
  }

  if (kind === 'mock') {
    let quota
    const plan = await planOf(supabase, session.userId).catch(() => 'free' as const)
    try {
      quota = await mockQuota(supabase, session.userId, plan)
    } catch {
      return NextResponse.json({ error: "Server xatosi. Birozdan keyin urinib ko'ring." }, { status: 503 })
    }
    if (quota && !quota.allowed) {
      return NextResponse.json({ error: quotaMessage(quota), code: 'LIMIT', quota }, { status: 429 })
    }
  }

  const { data, error } = await supabase
    .from('mock_starts')
    .insert({ user_id: session.userId, test_label: testLabel, kind })
    .select('id')
    .single()
  if (error || !data) {
    return NextResponse.json({ error: "Server xatosi. Birozdan keyin urinib ko'ring." }, { status: 503 })
  }

  // Re-check after inserting: parallel requests can't all slip under the limit.
  if (kind === 'mock') {
    const plan2 = await planOf(supabase, session.userId).catch(() => 'free' as const)
    const after = await mockQuota(supabase, session.userId, plan2).catch(() => null)
    if (after && (after.usedToday > dailyLimitFor(plan2) || after.usedLastHour > MOCKS_PER_HOUR)) {
      await supabase.from('mock_starts').delete().eq('id', data.id)
      return NextResponse.json({ error: quotaMessage({ ...after, reason: after.usedToday > dailyLimitFor(plan2) ? 'day' : 'hour' }), code: 'LIMIT' }, { status: 429 })
    }
  }
  return NextResponse.json({ startId: data.id })
}
