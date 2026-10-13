import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS, safeEqual } from '@/lib/auth'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { trialEndFromNow } from '@/lib/plan'
import { normalizeEmail, likeEscape } from '@/lib/email'
import { appOrigin, GOOGLE_STATE_COOKIE } from '@/lib/google'

/**
 * Google sends the visitor back here with ?code. We exchange it (server to
 * server, with the client secret) for an id_token and read the verified
 * e-mail from it. Then:
 *  - a user with this Google id signs in;
 *  - else a user with the same e-mail is linked to the Google id (if that
 *    account was made with a password, the password is switched off — the
 *    e-mail was never verified when it was typed in, so it must not stay a
 *    way into an account the real owner now controls through Google);
 *  - else a new account is created (30-day Pro trial like any sign-up).
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req)
  const fail = (code: string) => {
    const r = NextResponse.redirect(`${origin}/login?error=${code}`)
    r.cookies.delete(GOOGLE_STATE_COOKIE)
    return r
  }

  const url = req.nextUrl
  if (url.searchParams.get('error')) return fail('google_denied')
  const code = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''
  const saved = req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? ''
  if (!code || !state || !saved || !safeEqual(state, saved)) return fail('google_state')

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return fail('google_not_configured')

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch {
    return fail('server')
  }
  if (!(await rateLimit(supabase, `google:ip:${clientIp(req)}`, 30, 15 * 60))) return fail('too_many')

  let idToken: string | undefined
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) return fail('google_failed')
    idToken = ((await tokenRes.json()) as { id_token?: string }).id_token
  } catch {
    return fail('google_failed')
  }
  if (!idToken) return fail('google_failed')

  // The token came straight from Google over TLS, so its claims can be trusted;
  // we still check who it was issued for and that the e-mail is verified.
  let claims: {
    aud?: string
    iss?: string
    exp?: number
    sub?: string
    email?: string
    email_verified?: boolean | string
    given_name?: string
    family_name?: string
    name?: string
    picture?: string
  }
  try {
    claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'))
  } catch {
    return fail('google_failed')
  }
  const verified = claims.email_verified === true || claims.email_verified === 'true'
  const email = normalizeEmail(claims.email)
  if (
    claims.aud !== clientId ||
    !['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss ?? '') ||
    !claims.sub ||
    (claims.exp ?? 0) * 1000 < Date.now() ||
    !email ||
    !verified
  ) {
    return fail('google_failed')
  }

  const fullName = (claims.name ?? '').trim()
  const firstName = (claims.given_name ?? fullName.split(' ')[0] ?? '').trim().slice(0, 40) || email.split('@')[0].slice(0, 40)
  const lastName = (claims.family_name ?? fullName.split(' ').slice(1).join(' ')).trim().slice(0, 40)
  const avatar = typeof claims.picture === 'string' ? claims.picture.slice(0, 500) : null

  let userId: string | null = null
  let userFirst = firstName

  const bySub = await supabase.from('users').select('id, first_name').eq('google_sub', claims.sub).maybeSingle()
  if (bySub.error) return fail('need_sql') // v50 columns missing
  if (bySub.data) {
    userId = bySub.data.id
    userFirst = bySub.data.first_name
    await supabase.from('users').update({ avatar_url: avatar }).eq('id', userId)
  } else {
    const byEmail = await supabase.from('users').select('id, first_name, password_hash').ilike('email', likeEscape(email)).limit(1)
    const existing = byEmail.data?.[0]
    if (existing) {
      userId = existing.id
      userFirst = existing.first_name
      await supabase
        .from('users')
        .update({ google_sub: claims.sub, avatar_url: avatar, password_hash: null })
        .eq('id', existing.id)
    } else {
      const { data: created, error } = await supabase
        .from('users')
        .insert({
          first_name: firstName,
          last_name: lastName || '-',
          email,
          google_sub: claims.sub,
          avatar_url: avatar,
          premium_until: trialEndFromNow(),
        })
        .select('id, first_name')
        .single()
      if (error || !created) return fail('server')
      userId = created.id
      userFirst = created.first_name
    }
  }

  let token: string
  try {
    token = signSession({ userId: userId!, firstName: userFirst })
  } catch {
    return fail('server')
  }
  const res = NextResponse.redirect(`${origin}/dashboard`)
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
  res.cookies.delete(GOOGLE_STATE_COOKIE)
  return res
}
