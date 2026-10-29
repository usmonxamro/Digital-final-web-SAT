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

/**
 * Students often retype the code by hand and mix up look-alike characters:
 * 0 ↔ O, 1 ↔ I ↔ L, and dashes from phone keyboards (– —). The slug and the
 * signature have only one valid reading, the base36 Telegram-id part can have
 * several, so every reading of the ambiguous characters is tried (capped).
 */
const AMBIG: Record<string, string[]> = { '0': ['0', 'O'], O: ['O', '0'], '1': ['1', 'I', 'L'], I: ['I', '1', 'L'], L: ['L', '1', 'I'] }

function idReadings(part: string, cap = 512): string[] {
  let out = ['']
  for (const ch of part) {
    const opts = AMBIG[ch] ?? [ch]
    const next: string[] = []
    for (const p of out) for (const o of opts) next.push(p + o)
    out = next.slice(0, cap)
  }
  return out
}

export function verifyCourseCode(raw: string): { slug: string; tgId: number } | null {
  const secret = process.env.COURSE_CODE_SECRET?.trim()
  if (!secret) return null
  const clean = raw
    .trim()
    .toUpperCase()
    .replace(/[‐-―−_]/g, '-')
    .replace(/\s+/g, '')
  const m = clean.match(/^([A-Z0-9]{2,8})-([0-9A-Z]{1,12})-([0-9A-Z]{10})$/)
  if (!m) return null
  // Slug: letters only ("N0V" → "NOV"). Signature: hex only ("O" → "0", "I"/"L" → "1").
  const slug = m[1].replace(/0/g, 'O').replace(/1/g, 'I').toLowerCase()
  if (!groupBySlug(slug)) return null
  const sig = m[3].replace(/O/g, '0').replace(/[IL]/g, '1')
  if (!/^[0-9A-F]{10}$/.test(sig)) return null
  const b = Buffer.from(sig)
  for (const idPart of idReadings(m[2])) {
    const tgId = parseInt(idPart, 36)
    if (!Number.isSafeInteger(tgId) || tgId <= 0) continue
    const a = Buffer.from(signCourseCode(slug, tgId, secret))
    if (a.length === b.length && timingSafeEqual(a, b)) return { slug, tgId }
  }
  return null
}
