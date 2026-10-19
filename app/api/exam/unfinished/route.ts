import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { progressCutoff, PROGRESS_DAYS, type ExamProgress } from '@/lib/exam-progress'

export type UnfinishedExam = {
  startId: string
  testLabel: string
  progressAt: string
  answered: number
  total: number
  moduleLabel: string
  daysLeft: number
}

/** The student's unfinished exams (saved in the last 7 days), newest first — for the dashboard banner. */
export async function GET() {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ items: [] })
  const { data, error } = await supabaseAdmin()
    .from('mock_starts')
    .select('id, test_label, progress, progress_at')
    .eq('user_id', session.userId)
    .is('graded_at', null)
    .not('progress', 'is', null)
    .gte('progress_at', progressCutoff())
    .order('progress_at', { ascending: false })
    .limit(5)
  if (error) return NextResponse.json({ items: [] })
  const items: UnfinishedExam[] = (data ?? []).map((r) => {
    const p = r.progress as ExamProgress
    const age = (Date.now() - new Date(r.progress_at as string).getTime()) / 86_400_000
    return {
      startId: r.id as string,
      testLabel: r.test_label as string,
      progressAt: r.progress_at as string,
      answered: p?.answered ?? 0,
      total: p?.total ?? 0,
      moduleLabel: p?.moduleLabel ?? '',
      daysLeft: Math.max(1, Math.ceil(PROGRESS_DAYS - age)),
    }
  })
  return NextResponse.json({ items })
}

/** "Bekor qilish": forget the saved progress of one start. */
export async function DELETE(req: NextRequest) {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })
  const startId = req.nextUrl.searchParams.get('startId') ?? ''
  if (!startId) return NextResponse.json({ error: 'startId kerak' }, { status: 400 })
  await supabaseAdmin()
    .from('mock_starts')
    .update({ progress: null, progress_at: null })
    .eq('id', startId)
    .eq('user_id', session.userId)
    .is('graded_at', null)
  return NextResponse.json({ ok: true })
}
