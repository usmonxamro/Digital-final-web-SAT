import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function currentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  return session?.userId ?? null
}

// Results are saved only by /api/exam/grade, which computes the score on the
// server — the old "browser sends its own score" POST was removed (forgeable).

export async function GET() {
  const userId = await currentUserId()
  if (!userId) {
    return NextResponse.json({ attempts: [] })
  }

  try {
    const supabase = supabaseAdmin()
    const { data } = await supabase
      .from('test_attempts')
      .select('id, test_label, subject, rw_scaled, math_scaled, composite, correct_count, incorrect_count, omitted_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    return NextResponse.json({ attempts: data ?? [] })
  } catch {
    return NextResponse.json({ attempts: [] })
  }
}
