/**
 * Where to send a person after signing in: only places INSIDE this site (the exam link a teacher shared, or a
 * dashboard page). Anything else — another site, `//evil.com`, a backslash trick — is ignored.
 */
export function safeNext(v: string | null | undefined): string | null {
  if (!v || v.length > 600) return null
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\') || /[\r\n]/.test(v)) return null
  const path = v.split('?')[0]
  const ok = path === '/exam' || path === '/dashboard' || path.startsWith('/dashboard/')
  return ok ? v : null
}

/** The page link of one mock, to share on channels: opens the mock directly after the visitor signs in. */
export function mockShareUrl(origin: string, label: string): string {
  return `${origin.replace(/\/+$/, '')}/exam?test=${encodeURIComponent(label)}`
}
