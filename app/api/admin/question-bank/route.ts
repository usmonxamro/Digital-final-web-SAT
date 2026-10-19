import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { bankStatus, importBankDomain } from '@/lib/question-bank-import'

export const maxDuration = 60

/** GET: how many book questions are bundled vs. already in the database, per section. */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  try {
    return NextResponse.json(await bankStatus(supabaseAdmin()))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Xatolik' }, { status: 500 })
  }
}

/** POST { domain, skipNeedsCheck? }: loads one section (safe to repeat — matched by source_id). */
export async function POST(request: Request) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await request.json().catch(() => ({}))) as { domain?: string; skipNeedsCheck?: boolean }
  if (!body.domain) return NextResponse.json({ error: 'domain kerak' }, { status: 400 })
  try {
    const imported = await importBankDomain(supabaseAdmin(), body.domain, !!body.skipNeedsCheck)
    return NextResponse.json({ imported })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Xatolik' }, { status: 500 })
  }
}
