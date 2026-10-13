import { NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth'
import { ADMIN_GATE_COOKIE } from '@/lib/admin-auth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
  res.cookies.set(ADMIN_GATE_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
  return res
}
