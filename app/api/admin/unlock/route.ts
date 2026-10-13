import { NextRequest, NextResponse } from 'next/server'
import { hmac, safeEqual, SESSION_COOKIE_OPTIONS } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit'
import { ADMIN_GATE_COOKIE, adminIdentity, gateToken } from '@/lib/admin-auth'

/** Checks the admin access code and opens the panel (asked again on every visit). */
export async function POST(req: NextRequest) {
  const info = await adminIdentity().catch(() => null)
  // Same answer for "not an admin" and "wrong code": nothing to learn here.
  if (!info) return NextResponse.json({ error: "Kod noto'g'ri." }, { status: 403 })

  const expected = process.env.ADMIN_ACCESS_CODE
  if (!expected || (process.env.NODE_ENV === 'production' && expected.length < 10)) {
    return NextResponse.json(
      { error: "Server sozlanmagan: ADMIN_ACCESS_CODE (kamida 10 belgi) muhit o'zgaruvchisini qo'shing." },
      { status: 503 },
    )
  }

  const supabase = supabaseAdmin()
  const key = `admin-unlock:${info.userId}:${clientIp(req)}`
  if (!(await rateLimit(supabase, key, 5, 15 * 60))) {
    return NextResponse.json({ error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.slice(0, 200) : ''
  if (!code || !safeEqual(hmac(`code:${code}`), hmac(`code:${expected}`))) {
    return NextResponse.json({ error: "Kod noto'g'ri." }, { status: 403 })
  }

  await resetRateLimit(supabase, key)
  const res = NextResponse.json({ ok: true })
  // Browser-session cookie (gone when the browser closes), and the token
  // itself expires after ADMIN_GATE_HOURS at the latest.
  const { maxAge: _ignored, ...sessionOnly } = SESSION_COOKIE_OPTIONS
  res.cookies.set(ADMIN_GATE_COOKIE, gateToken(info.userId), { ...sessionOnly, sameSite: 'strict' })
  return res
}

/** Locks the panel again (the "Qulflash" button). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_GATE_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
  return res
}
