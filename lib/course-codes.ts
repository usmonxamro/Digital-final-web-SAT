import { createHmac, timingSafeEqual } from 'crypto'
import { groupBySlug } from '@/lib/course-groups'

/**
 * Codes are made by the Telegram bot WITHOUT calling the site: the bot and the
 * site share one secret (COURSE_CODE_SECRET). Format:
 *
 *   NOV-1CZ3F9-3F9A1B7C2D
 *   │    │       └ first 10 hex chars of HMAC-SHA256(secret, "nov:<telegram id>")
 *   │    └ Telegram user id in base36
 *   └ group slug
 *
 * The site checks the signature, then stores (group, telegram id, site user) so
 * one Telegram student can unlock one site account per group.
 */
export function signCourseCode(slug: string, tgId: number, secret: string): string {
  return createHmac('sha256', secret).update(`${slug}:${tgId}`).digest('hex').slice(0, 10).toUpperCase()
}

export function verifyCourseCode(raw: string): { slug: string; tgId: number } | null {
  const secret = process.env.COURSE_CODE_SECRET
  if (!secret) return null
  const m = raw.trim().toUpperCase().replace(/\s+/g, '').match(/^([A-Z0-9]{2,8})-([0-9A-Z]{1,12})-([0-9A-F]{10})$/)
  if (!m) return null
  const slug = m[1].toLowerCase()
  if (!groupBySlug(slug)) return null
  const tgId = parseInt(m[2], 36)
  if (!Number.isSafeInteger(tgId) || tgId <= 0) return null
  const expected = signCourseCode(slug, tgId, secret)
  const a = Buffer.from(expected)
  const b = Buffer.from(m[3])
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return { slug, tgId }
}
