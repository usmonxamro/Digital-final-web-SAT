import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { verifyTahlilKey } from '@/lib/tahlil-link'
import { TAHLIL_HEADER } from '@/lib/tahlil-link-client'
import { botTestQuestions } from '@/lib/bot-question-map'

/**
 * GET ?code=BOTCODE → the site questions behind the bot's question numbers 1..N (texts, options, keys),
 * so «O'quvchilar tahlili» can show the wrongly answered questions with their text.
 * { linked: false } when the bot test was created in the bot only (no text on the site).
 */
export async function GET(req: NextRequest) {
  if (!verifyTahlilKey(req.headers.get(TAHLIL_HEADER))) {
    try {
      await requireAdmin()
    } catch (e) {
      return adminErrorResponse(e)
    }
  }
  const code = req.nextUrl.searchParams.get('code')?.trim()
  if (!code) return NextResponse.json({ error: 'code kerak' }, { status: 400 })
  const res = await botTestQuestions(supabaseAdmin(), code).catch(() => null)
  if (!res) return NextResponse.json({ linked: false, items: [] })
  return NextResponse.json({ linked: true, testLabel: res.testLabel, items: res.items })
}
