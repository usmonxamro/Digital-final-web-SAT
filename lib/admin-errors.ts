import { NextResponse } from 'next/server'

/** Uniform 401/403 response for a failed requireAdmin(). */
export function adminErrorResponse(e: unknown) {
  const code = e instanceof Error ? e.message : 'FORBIDDEN'
  const status = code === 'UNAUTHORIZED' ? 401 : 403
  const error =
    code === 'UNAUTHORIZED'
      ? 'Kirish talab qilinadi.'
      : code === 'LOCKED'
        ? 'Admin kodi kiritilmagan yoki muddati tugagan.'
        : "Admin huquqi yo'q."
  return NextResponse.json({ error, code }, { status })
}
