import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, safeEqual } from '@/lib/auth'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { normalizeEmail, likeEscape } from '@/lib/email'
import { hashResetCode, RESET_MAX_TRIES } from '@/lib/password-reset'

/** Step 2: POST { email, code, password } → sets a new password. */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as { email?: unknown; code?: unknown; password?: unknown } | null
  const email = normalizeEmail(b?.email)
  const code = typeof b?.code === 'string' ? b.code.replace(/\D/g, '') : ''
  const password = typeof b?.password === 'string' ? b.password : ''
  if (!email || code.length !== 6) return NextResponse.json({ error: "Email va 6 xonali kodni kiriting." }, { status: 400 })
  if (password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "Parol 6 dan 72 tagacha belgidan iborat bo'lishi kerak." }, { status: 400 })
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Server sozlanmagan.' }, { status: 503 })
  }
  if (!(await rateLimit(supabase, `reset:ip:${clientIp(req)}`, 20, 3600))) {
    return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq qayta urinib ko'ring." }, { status: 429 })
  }

  const bad = NextResponse.json({ error: "Kod noto'g'ri yoki muddati tugagan. Yangi kod so'rang." }, { status: 400 })
  const { data: user } = await supabase.from('users').select('id').ilike('email', likeEscape(email)).maybeSingle()
  if (!user) return bad
  const { data: row } = await supabase.from('password_resets').select('*').eq('user_id', user.id).maybeSingle()
  if (!row || new Date(row.expires_at as string).getTime() < Date.now() || (row.attempts as number) >= RESET_MAX_TRIES) {
    return bad
  }
  if (!safeEqual(hashResetCode(user.id, code), row.code_hash as string)) {
    await supabase.from('password_resets').update({ attempts: (row.attempts as number) + 1 }).eq('id', row.id)
    return bad
  }

  const { error } = await supabase.from('users').update({ password_hash: await hashPassword(password) }).eq('id', user.id)
  if (error) return NextResponse.json({ error: 'Parolni saqlab bo‘lmadi.' }, { status: 500 })
  await supabase.from('password_resets').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
