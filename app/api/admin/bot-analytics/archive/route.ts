import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminErrorResponse } from '@/lib/admin-errors'
import { requireTahlilAccess } from '@/lib/tahlil-auth'
import { clearPayloads } from '@/lib/bot-analytics-cache'

/**
 * POST { chatId, archived } — mark a finished group as archived (or bring it back).
 * An archived group disappears from "O'quvchilar tahlili" and its students/results are not loaded at all.
 * Nothing is deleted; the bot keeps working with the group as before.
 */
export async function POST(req: NextRequest) {
  try {
    await requireTahlilAccess(req)
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as { chatId?: number; archived?: boolean } | null
  const chatId = Number(body?.chatId)
  if (!Number.isSafeInteger(chatId) || typeof body?.archived !== 'boolean') {
    return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  }
  const { error } = await supabaseAdmin()
    .from('tg_groups')
    .update({ archived: body.archived, archived_at: body.archived ? new Date().toISOString() : null })
    .eq('chat_id', chatId)
  if (error) {
    const missing = /archived/.test(error.message)
    return NextResponse.json({ error: missing ? 'v118 SQL hali bajarilmagan (tg_groups.archived yo‘q).' : error.message }, { status: 500 })
  }
  clearPayloads()
  return NextResponse.json({ ok: true })
}
