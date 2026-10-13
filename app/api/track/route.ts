import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { clientIp, memoryLimit } from '@/lib/rate-limit'

const VISITOR_COOKIE = 'sat_vid'
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i

/** One page view (sent by components/visit-tracker.tsx). */
export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? ''
  if (!ua || BOT_RE.test(ua)) return new NextResponse(null, { status: 204 })
  // Flood guard: at most 60 page views a minute from one address.
  if (!memoryLimit(`track:${clientIp(req)}`, 60, 60_000)) return new NextResponse(null, { status: 204 })

  const body = await req.json().catch(() => null)
  const path = typeof body?.path === 'string' ? body.path.slice(0, 200) : ''
  if (!path.startsWith('/')) return new NextResponse(null, { status: 204 })
  // Never record the hidden admin address.
  const secret = (process.env.ADMIN_PATH ?? '').replace(/^\/+|\/+$/g, '')
  if (path.startsWith('/admin') || (secret && path.startsWith(`/${secret}`))) {
    return new NextResponse(null, { status: 204 })
  }
  const referrer = typeof body?.ref === 'string' ? body.ref.slice(0, 300) : null

  const cookieStore = await cookies()
  let vid = cookieStore.get(VISITOR_COOKIE)?.value
  const isNew = !vid || !/^[0-9a-f-]{36}$/.test(vid)
  if (isNew) vid = crypto.randomUUID()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)

  try {
    await supabaseAdmin().from('page_views').insert({
      visitor_id: vid,
      user_id: session?.userId ?? null,
      path,
      referrer: referrer && !referrer.includes(req.headers.get('host') ?? '\u0000') ? referrer : null,
    })
  } catch {
    // stats are best-effort
  }

  const res = new NextResponse(null, { status: 204 })
  if (isNew) {
    res.cookies.set(VISITOR_COOKIE, vid!, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  return res
}
