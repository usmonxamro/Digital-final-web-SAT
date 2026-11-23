import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { verifyTahlilKey } from '@/lib/tahlil-link'
import { TAHLIL_HEADER } from '@/lib/tahlil-link-client'

/**
 * The "O'quvchilar tahlili" API is used both in the site admin panel (login) and inside Telegram (signed key that
 * the bot gives only to its admins). Throws like requireAdmin() when neither is valid.
 */
export async function requireTahlilAccess(req: NextRequest): Promise<void> {
  if (verifyTahlilKey(req.headers.get(TAHLIL_HEADER))) return
  await requireAdmin()
}
