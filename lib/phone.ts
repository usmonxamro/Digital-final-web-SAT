/** Canonical phone form: digits with an optional leading "+" (spaces, dashes, brackets removed). */
export function normalizePhone(p: string | null | undefined): string {
  const s = (p ?? '').trim()
  const digits = s.replace(/\D/g, '')
  return s.startsWith('+') ? `+${digits}` : digits
}

/** Digits only — for comparing two numbers written in different styles. */
export function phoneDigits(p: string | null | undefined): string {
  return (p ?? '').replace(/\D/g, '')
}

/** The stored forms a number may have: as typed (old accounts) or canonical. */
export function phoneVariants(p: string): string[] {
  const n = normalizePhone(p)
  const d = phoneDigits(p)
  return [...new Set([p.trim(), n, d, `+${d}`])].filter(Boolean)
}

type Db = {
  from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Accounts with the same number in any spelling, oldest first. Uses the v38
 * `phone_digits` column; before that SQL is run, falls back to the spellings
 * phoneVariants() can produce.
 */
export async function usersWithPhone(
  db: Db,
  phone: string,
  columns = 'id, first_name, last_name, phone, created_at',
): Promise<{ id: string; first_name: string; last_name: string; phone: string; created_at: string; password_hash?: string }[]> {
  const digits = phoneDigits(phone)
  if (!digits) return []
  const byDigits = await db.from('users').select(columns).eq('phone_digits', digits).order('created_at', { ascending: true }).limit(10)
  if (!byDigits.error) return byDigits.data ?? []
  const byVariants = await db
    .from('users')
    .select(columns)
    .in('phone', phoneVariants(phone))
    .order('created_at', { ascending: true })
    .limit(10)
  return byVariants.data ?? []
}
