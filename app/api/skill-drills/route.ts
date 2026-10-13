import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) {
    return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !body.domain || !Array.isArray(body.review)) {
    return NextResponse.json({ error: "Noto'g'ri so'rov formati." }, { status: 400 })
  }

  try {
    const supabase = supabaseAdmin()
    const { error } = await supabase.from('skill_drills').insert({
      user_id: session.userId,
      domain: body.domain,
      correct_count: body.correctCount ?? 0,
      total_count: body.totalCount ?? 0,
      review_json: body.review,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Failed to save skill drill:', e)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
