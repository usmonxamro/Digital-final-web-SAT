import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { isMissingTable } from '@/lib/db-errors'

/** A student reports a possible mistake in a question (after finishing a mock). */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Tizimga kiring.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
  const message = str(b?.message, 1500)
  if (message.length < 3) return NextResponse.json({ error: 'Xatoni qisqacha yozing.' }, { status: 400 })
  const sb = supabaseAdmin()
  if (!(await rateLimit(sb, `report:${session.userId}`, 20, 3600))) {
    return NextResponse.json({ error: 'Juda ko‘p xabar yuborildi. Keyinroq urinib ko‘ring.' }, { status: 429 })
  }
  const { data: u } = await sb.from('users').select('first_name, last_name').eq('id', session.userId).maybeSingle()
  const name = u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : ''
  const num = Number(b?.qNumber)
  const { error } = await sb.from('question_reports').insert({
    user_id: session.userId,
    name,
    test_label: str(b?.testLabel, 200),
    module_label: str(b?.moduleLabel, 120),
    q_number: Number.isFinite(num) ? num : null,
    question_id: str(b?.questionId, 80) || null,
    prompt: str(b?.prompt, 600),
    message,
  })
  if (error) {
    return NextResponse.json({ error: isMissingTable(error) ? 'Jadval yaratilmagan (schema.sql v71).' : 'Yuborib bo‘lmadi.' }, { status: isMissingTable(error) ? 503 : 500 })
  }
  return NextResponse.json({ ok: true })
}
