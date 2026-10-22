import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { appOrigin, GOOGLE_STATE_COOKIE, GOOGLE_NEXT_COOKIE } from '@/lib/google'
import { safeNext } from '@/lib/safe-next'

/** Starts "Sign in with Google": redirects to Google's consent screen. */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const origin = appOrigin(req)
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${origin}/login?error=google_not_configured`)
  }
  const state = crypto.randomBytes(24).toString('base64url')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https'),
    path: '/',
    maxAge: 600,
  })
  const next = safeNext(req.nextUrl.searchParams.get('next'))
  if (next) {
    res.cookies.set(GOOGLE_NEXT_COOKIE, next, { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), path: '/', maxAge: 600 })
  }
  return res
}
