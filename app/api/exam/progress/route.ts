import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sanitizeProgress } from '@/lib/exam-progress'

/** Saves where the student is in an open exam (answers, timer, position). One small row update; no-op once graded. */
export async function POST(req: NextRequest) {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const startId = typeof body?.startId === 'string' ? body.startId : ''
  const progress = sanitizeProgress(body?.progress)
  if (!startId || !progress) return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  const { error } = await supabaseAdmin()
    .from('mock_starts')
    .update({ progress, progress_at: new Date().toISOString() })
    .eq('id', startId)
    .eq('user_id', session.userId)
    .is('graded_at', null)
  // v88 SQL not run yet → saving simply doesn't happen; the exam itself keeps working.
  if (error) return NextResponse.json({ ok: false })
  return NextResponse.json({ ok: true })
}
