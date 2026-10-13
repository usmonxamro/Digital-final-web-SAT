import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession, hmac, safeEqual } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { phoneDigits, usersWithPhone } from '@/lib/phone'

/**
 * Who may use the admin panel:
 *  - the OWNER: the account whose phone is ADMIN_PHONE (env), and
 *  - ADMINS: accounts the owner promoted (users.role = 'admin').
 *
 * Every admin request ALSO needs the admin-gate cookie, which is set only
 * after typing the access code (ADMIN_ACCESS_CODE env) on the hidden admin
 * page. So a stolen or guessed admin login alone is not enough.
 */

export const ADMIN_GATE_COOKIE = 'sat_admin_gate'
export const ADMIN_GATE_HOURS = 12

export type AdminInfo = { userId: string; isOwner: boolean; phone: string }


/** Looks up the logged-in user's admin status, without checking the gate. */
export async function adminIdentity(): Promise<AdminInfo | null> {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return null

  const ownerEnv = process.env.ADMIN_PHONE?.trim() ?? ''
  const owner = phoneDigits(ownerEnv)
  const db = supabaseAdmin()
  const { data: user, error } = await db.from('users').select('*').eq('id', session.userId).maybeSingle()
  if (error || !user) {
    // Dev without ADMIN_PHONE: any logged-in user is the admin (local testing).
    if (!owner && process.env.NODE_ENV !== 'production') return { userId: session.userId, isOwner: true, phone: '' }
    return null
  }

  const phone = (user.phone as string | null) ?? ''
  // The owner may also be identified by Google/e-mail (ADMIN_EMAIL).
  const ownerEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? ''
  if (ownerEmail && typeof user.email === 'string' && user.email.toLowerCase() === ownerEmail && user.google_sub) {
    return { userId: user.id, isOwner: true, phone }
  }
  if (owner && phone && phoneDigits(phone) === owner) {
    // Defense in depth: the owner is the OLDEST account with that number, so
    // a later sign-up with the same number in another format can't take over.
    const same = await usersWithPhone(db, phone, 'id, created_at')
    const oldest = same[0]
    if (!oldest || oldest.id === user.id) return { userId: user.id, isOwner: true, phone }
  }
  if (user.role === 'admin') return { userId: user.id, isOwner: false, phone }
  if (!owner && process.env.NODE_ENV !== 'production') return { userId: user.id, isOwner: true, phone }
  return null
}

export function gateToken(userId: string): string {
  const exp = Date.now() + ADMIN_GATE_HOURS * 3600_000
  const body = `${userId}.${exp}`
  return `${body}.${hmac(`admin-gate:${body}`)}`
}

export function gateValid(token: string | undefined, userId: string): boolean {
  if (!token) return false
  const [uid, exp, sig] = token.split('.')
  if (!uid || !exp || !sig || uid !== userId || Number(exp) < Date.now()) return false
  return safeEqual(sig, hmac(`admin-gate:${uid}.${exp}`))
}

/** True when no access code is configured and we're in development. */
export function gateDisabled() {
  return !process.env.ADMIN_ACCESS_CODE && process.env.NODE_ENV !== 'production'
}

/**
 * Server-side admin guard for every /api/admin/* route.
 * Throws 'UNAUTHORIZED' | 'FORBIDDEN' | 'LOCKED' (gate code not entered).
 */
export async function requireAdmin(): Promise<AdminInfo> {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) throw new Error('UNAUTHORIZED')
  const info = await adminIdentity()
  if (!info) throw new Error('FORBIDDEN')
  if (!gateDisabled() && !gateValid(cookieStore.get(ADMIN_GATE_COOKIE)?.value, info.userId)) {
    throw new Error('LOCKED')
  }
  return info
}

export async function requireOwner(): Promise<AdminInfo> {
  const info = await requireAdmin()
  if (!info.isOwner) throw new Error('FORBIDDEN')
  return info
}
