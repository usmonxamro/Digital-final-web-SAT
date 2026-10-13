import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { ADMIN_GATE_COOKIE, adminIdentity, gateDisabled, gateValid } from '@/lib/admin-auth'

/** What the hidden admin page should show: login hint, 404, code prompt, or the panel. */
export async function GET() {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ loggedIn: false, isAdmin: false, unlocked: false })
  const info = await adminIdentity().catch(() => null)
  if (!info) return NextResponse.json({ loggedIn: true, isAdmin: false, unlocked: false })
  const unlocked = gateDisabled() || gateValid(cookieStore.get(ADMIN_GATE_COOKIE)?.value, info.userId)
  return NextResponse.json({
    loggedIn: true,
    isAdmin: true,
    isOwner: info.isOwner,
    unlocked,
    codeConfigured: !!process.env.ADMIN_ACCESS_CODE,
  })
}
