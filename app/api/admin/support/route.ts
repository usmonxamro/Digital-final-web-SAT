import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'

export type SupportRow = {
  id: string
  name: string
  contact: string
  message: string
  image: string | null
  read: boolean
  created_at: string
}

export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const { data, error } = await supabaseAdmin()
    .from('support_messages')
    .select('id, name, contact, message, image, read, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ messages: [], migrationNeeded: isMissingTable(error) })
  return NextResponse.json({ messages: data as SupportRow[], migrationNeeded: false })
}

/** { id, read } marks a message read/unread. */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const b = await req.json().catch(() => ({}))
  if (typeof b?.id !== 'string') return NextResponse.json({ error: 'id kerak' }, { status: 400 })
  await supabaseAdmin().from('support_messages').update({ read: !!b.read }).eq('id', b.id)
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
  await supabaseAdmin().from('support_messages').delete().eq('id', b.id)
  return NextResponse.json({ ok: true })
}
