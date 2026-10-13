import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyPassword, signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth'
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit'
import { normalizePhone, usersWithPhone } from '@/lib/phone'
import { normalizeEmail, likeEscape } from '@/lib/email'

export async function POST(req: NextRequest) {
  let body: { phone?: unknown; email?: unknown; identifier?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Noto'g'ri so'rov formati." }, { status: 400 })
  }

  // The form sends `email` (Email tab) or `phone` (Phone tab); `identifier` also works.
  const rawId = String(body.identifier ?? body.email ?? body.phone ?? '').trim().slice(0, 254)
  const byEmail = rawId.includes('@')
  const email = byEmail ? normalizeEmail(rawId) : ''
  const phone = byEmail ? '' : rawId.slice(0, 32)
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : ''
  if ((!email && !phone) || !password) {
    return NextResponse.json({ error: byEmail && !email ? "Email noto'g'ri." : 'Email yoki telefon va parolni kiriting.' }, { status: 400 })
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server sozlanmagan.' }, { status: 503 })
  }

  // Brute-force protection: per phone (10 tries / 15 min) and per IP (30 / 15 min).
  const ip = clientIp(req)
  const phoneKey = `login:id:${email || normalizePhone(phone)}`
  const [okPhone, okIp] = await Promise.all([
    rateLimit(supabase, phoneKey, 10, 15 * 60),
    rateLimit(supabase, `login:ip:${ip}`, 30, 15 * 60),
  ])
  if (!okPhone || !okIp) {
    return NextResponse.json(
      { error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." },
      { status: 429 },
    )
  }

  // Exact spelling first (older accounts), then the canonical forms.
  let user: { id: string; first_name: string; password_hash?: string | null } | undefined
  if (email) {
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, password_hash')
      .ilike('email', likeEscape(email))
      .limit(1)
    if (error) return NextResponse.json({ error: "Email bilan kirish hali yoqilmagan (bazadagi v50 SQL ishga tushirilmagan)." }, { status: 503 })
    user = data?.[0]
  } else {
    const candidates = await usersWithPhone(supabase, phone, 'id, first_name, password_hash, phone, created_at')
    user = candidates.find((u) => u.phone === phone) ?? candidates[0]
  }

  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: email ? "Email yoki parol noto'g'ri." : "Telefon raqam yoki parol noto'g'ri." }, { status: 401 })
  }

  await resetRateLimit(supabase, phoneKey)

  let token: string
  try {
    token = signSession({ userId: user.id, firstName: user.first_name })
  } catch {
    return NextResponse.json({ error: 'Server sozlanmagan (SESSION_SECRET).' }, { status: 503 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
  return res
}
