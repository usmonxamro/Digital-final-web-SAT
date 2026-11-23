import type { BotAnalyticsData } from '@/lib/bot-analytics'

/**
 * Loads /api/admin/bot-analytics for the browser with "show the last answer at once, refresh behind it":
 * the previous payload is kept in sessionStorage, so reopening the Telegram web app paints immediately
 * and the fresh numbers replace it a moment later.
 */
const KEY = 'tahlil-data-v2'

export function readCachedAnalytics(): BotAnalyticsData | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as BotAnalyticsData) : null
  } catch {
    return null
  }
}

export async function fetchAnalytics(headers?: Record<string, string>): Promise<{ data: BotAnalyticsData | null; missing: boolean }> {
  const r = await fetch('/api/admin/bot-analytics', { headers, cache: 'no-store' })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error ?? 'Xatolik')
  if (d.missing) return { data: null, missing: true }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* storage full / private mode — only the instant repaint is lost */
  }
  return { data: d as BotAnalyticsData, missing: false }
}

/** Run a write (archive / link) and drop the cached payload so the next open is fresh. */
export async function postJson<T = unknown>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  if (!r.ok) throw new Error((d as { error?: string }).error ?? 'Xatolik')
  return d as T
}
