import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isCorrectAnswer } from '@/lib/test-data'

/** POST { id, answer } → whether it is right, the right answer and the solution. The answer stays on the server until now. */
export async function POST(req: NextRequest) {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })
  const b = await req.json().catch(() => null)
  const id = typeof b?.id === 'string' ? b.id : ''
  const answer = typeof b?.answer === 'string' ? b.answer.slice(0, 40) : ''
  if (!id || !answer) return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  const supabase = supabaseAdmin()
  const { data: q } = await supabase.from('question_bank').select('id, type, correct, correct_value, explanation').eq('id', id).eq('needs_check', false).maybeSingle()
  if (!q) return NextResponse.json({ error: 'Savol topilmadi.' }, { status: 404 })
  const correct = isCorrectAnswer(
    { type: q.type, correct: (q.correct ?? undefined) as never, correctValue: q.correct_value ?? undefined, prompt: '' },
    answer,
  )
  // Progress (v89 SQL). Without the table the practice still works, it just isn't remembered.
  await supabase
    .from('bank_answers')
    .upsert({ user_id: session.userId, question_id: id, correct, updated_at: new Date().toISOString() }, { onConflict: 'user_id,question_id' })
  return NextResponse.json({
    correct,
    correctAnswer: q.type === 'gridin' ? (q.correct_value ?? '').split(',')[0].trim() : q.correct,
    explanation: q.explanation ?? null,
  })
}
