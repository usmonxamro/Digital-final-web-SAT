export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

/** Lower-cased, trimmed e-mail, or '' when it isn't a plausible address. */
export function normalizeEmail(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return s.length <= 254 && EMAIL_RE.test(s) ? s : ''
}

/** Escapes % and _ so an e-mail can be used in an ilike() exact match. */
export function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}
