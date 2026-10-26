import { createHmac, timingSafeEqual } from 'crypto'

/**
 * "O'quvchilar tahlili" opened from the Telegram bot (no site login inside Telegram).
 *
 * The bot gives an admin a link   https://satbyusmon.com/tg-tahlil?k=<tg id>.<expires>.<signature>
 * signed with the secret the bot and the site already share (COURSE_CODE_SECRET):
 *
 *   signature = first 32 hex of HMAC-SHA256(secret, "tahlil:<tg id>:<expires unix seconds>")
 *
 * The page sends the key back in the "x-tahlil-key" header; only the analytics API accepts it
 * (read-only), never the rest of the admin panel. A link works for at most 13 hours.
 */
export { TAHLIL_HEADER } from '@/lib/tahlil-link-client'
const MAX_AGE_S = 13 * 3600

export function verifyTahlilKey(raw: string | null | undefined): { tgId: number } | null {
  const secret = process.env.COURSE_CODE_SECRET?.trim()
  if (!secret || !raw) return null
  const m = /^(\d{1,15})\.(\d{9,11})\.([0-9a-f]{32})$/.exec(raw.trim())
  if (!m) return null
  const tgId = Number(m[1])
  const exp = Number(m[2])
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isSafeInteger(tgId) || exp < now || exp > now + MAX_AGE_S) return null
  const expected = createHmac('sha256', secret).update(`tahlil:${tgId}:${exp}`).digest('hex').slice(0, 32)
  const a = Buffer.from(expected)
  const b = Buffer.from(m[3])
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return { tgId }
}
