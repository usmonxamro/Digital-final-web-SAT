import type { NextRequest } from 'next/server'

export const GOOGLE_STATE_COOKIE = 'sat_g_state'
/** Where to go after Google sign-in (a shared mock link), set when the flow starts. */
export const GOOGLE_NEXT_COOKIE = 'sat_g_next'

export function appOrigin(req: NextRequest): string {
  const env = process.env.APP_URL?.trim().replace(/\/+$/, '')
  if (env) return env
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host
  return `${proto}://${host}`
}

