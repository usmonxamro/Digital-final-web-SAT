import { NextResponse, type NextRequest } from 'next/server'

/**
 * Runs before every page / API request.
 *
 * 1. Hidden admin panel: /admin answers 404. The panel lives at the secret
 *    path in ADMIN_PATH (e.g. ADMIN_PATH=boshqaruv-7k2p → /boshqaruv-7k2p),
 *    which is served by the same page. Without ADMIN_PATH set, /admin keeps
 *    working (so a deploy without the variable doesn't lock you out).
 * 2. CSRF guard: a state-changing /api request coming from another site's
 *    page (Origin header of a different host) is refused.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin')
    if (origin) {
      let originHost = ''
      try {
        originHost = new URL(origin).host
      } catch {
        originHost = 'invalid'
      }
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
      if (originHost !== host) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    return NextResponse.next()
  }

  const secret = (process.env.ADMIN_PATH ?? '').replace(/^\/+|\/+$/g, '')
  if (secret) {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return NextResponse.rewrite(new URL('/__not-found', req.url))
    }
    if (pathname === `/${secret}`) {
      return NextResponse.rewrite(new URL('/admin', req.url))
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|mjs|js|css|woff2?)$).*)'],
}
