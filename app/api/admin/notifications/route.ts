import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'

export type BroadcastRow = { id: string; title: string; body: string; created_at: string }

export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const { data, error } = await supabaseAdmin()
    .from('notifications')
    .select('id, title, body, created_at')
    .is('user_id', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ items: [], migrationNeeded: isMissingTable(error) })
  return NextResponse.json({ items: data as BroadcastRow[], migrationNeeded: false })
}

/** { title, body } — message to every student's bell. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const b = await req.json().catch(() => ({}))
  const title = typeof b?.title === 'string' ? b.title.trim().slice(0, 120) : ''
  const body = typeof b?.body === 'string' ? b.body.trim().slice(0, 1500) : ''
  if (!title && !body) return NextResponse.json({ error: 'Xabar matnini yozing.' }, { status: 400 })
  const { error } = await supabaseAdmin().from('notifications').insert({ user_id: null, kind: 'admin', title: title || 'SAT Akademiyasi', body })
  if (error) {
    return NextResponse.json({ error: isMissingTable(error) ? 'Jadval yo‘q — schema.sql oxiridagi v71 qismini ishga tushiring.' : 'Yuborib bo‘lmadi.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const b = await req.json().catch(() => ({}))
  if (typeof b?.id !== 'string') return NextResponse.json({ error: 'id kerak' }, { status: 400 })
  await supabaseAdmin().from('notifications').delete().eq('id', b.id)
  return NextResponse.json({ ok: true })
}
