import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingTable } from '@/lib/db-errors'

/** Daily mock allowance: FREE 3, PRO 4, ELITE (course/group students) 7. */
export const MOCKS_PER_DAY = 3
export const MOCKS_PER_DAY_PRO = 4
export const MOCKS_PER_DAY_ELITE = 7
export const dailyLimitFor = (plan: 'elite' | 'premium' | 'free' | string | undefined) =>
  plan === 'elite' ? MOCKS_PER_DAY_ELITE : plan === 'premium' ? MOCKS_PER_DAY_PRO : MOCKS_PER_DAY
export const MOCKS_PER_HOUR = 2
/** Days are counted in Uzbekistan time (UTC+5, no DST). */
const TZ_OFFSET_MS = 5 * 3600_000
const DAY = 86400_000
const HOUR = 3600_000

export function tashkentDayStart(now = Date.now()): number {
  return Math.floor((now + TZ_OFFSET_MS) / DAY) * DAY - TZ_OFFSET_MS
}

export type Quota = {
  usedToday: number
  usedLastHour: number
  perDay: number
  perHour: number
  allowed: boolean
  /** When the next mock may be started (ISO), if blocked. */
  nextAllowedAt: string | null
  reason: 'day' | 'hour' | null
}

/** Counts this user's started mocks today (Tashkent) and in the last 60 minutes. */
export async function mockQuota(
  supabase: SupabaseClient,
  userId: string,
  plan: 'elite' | 'premium' | 'free' | string = 'free',
  now = Date.now(),
): Promise<Quota | null> {
  const perDay = dailyLimitFor(plan)
  const dayStart = tashkentDayStart(now)
  const hourAgo = now - HOUR
  const since = new Date(Math.min(dayStart, hourAgo)).toISOString()
  const { data, error } = await supabase
    .from('mock_starts')
    .select('started_at')
    .eq('user_id', userId)
    .eq('kind', 'mock')
    .gte('started_at', since)
    .order('started_at', { ascending: true })
  if (error) {
    if (isMissingTable(error)) return null // v38 SQL not run → caller fails open
    throw new Error(error.message)
  }

  const times = (data ?? []).map((r) => new Date(r.started_at as string).getTime())
  const usedToday = times.filter((t) => t >= dayStart).length
  const lastHour = times.filter((t) => t >= hourAgo)
  const usedLastHour = lastHour.length

  let nextAllowedAt: number | null = null
  let reason: Quota['reason'] = null
  if (usedToday >= perDay) {
    nextAllowedAt = dayStart + DAY
    reason = 'day'
  } else if (usedLastHour >= MOCKS_PER_HOUR) {
    nextAllowedAt = lastHour[usedLastHour - MOCKS_PER_HOUR] + HOUR
    reason = 'hour'
  }
  return {
    usedToday,
    usedLastHour,
    perDay,
    perHour: MOCKS_PER_HOUR,
    allowed: nextAllowedAt === null,
    nextAllowedAt: nextAllowedAt ? new Date(nextAllowedAt).toISOString() : null,
    reason,
  }
}

export function quotaMessage(q: Quota): string {
  const perDay = q.perDay
  const at = q.nextAllowedAt ? new Date(q.nextAllowedAt) : null
  const hhmm = at
    ? at.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' })
    : ''
  return q.reason === 'day'
    ? `Bugun ${perDay} ta mock yechdingiz — kunlik limit tugadi. Ertaga yana davom eting!`
    : `Bir soat ichida ${MOCKS_PER_HOUR} tadan ortiq mock yechib bo'lmaydi. Keyingi mock soat ${hhmm} dan keyin ochiladi.`
}
