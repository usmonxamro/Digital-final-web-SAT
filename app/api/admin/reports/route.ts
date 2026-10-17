import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'

export type ReportRow = {
  id: string
  user_id: string | null
  name: string
  test_label: string
  module_label: string
  q_number: number | null
  question_id: string | null
  prompt: string
  message: string
  status: 'open' | 'answered'
  reply: string | null
  replied_at: string | null
  created_at: string
}

/** GET → the list. GET ?count=1 → { open } = how many reports still wait (the red badge on the admin tab). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  if (req.nextUrl.searchParams.get('count') === '1') {
    const { count, error } = await supabaseAdmin()
      .from('question_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
    return NextResponse.json({ open: error ? 0 : (count ?? 0) })
  }
  const { data, error } = await supabaseAdmin()
    .from('question_reports')
    .select('id, user_id, name, test_label, module_label, q_number, question_id, prompt, message, status, reply, replied_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ items: [], migrationNeeded: isMissingTable(error) })
  return NextResponse.json({ items: data as ReportRow[], migrationNeeded: false })
}

/** { id, reply } — answers a report; the student gets it in their bell. */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const b = await req.json().catch(() => ({}))
  // { id, resolve: true } — "hal qilindi": the admin fixed it and needs no reply (clears the badge).
  if (typeof b?.id === 'string' && b.resolve === true) {
    const { error } = await supabaseAdmin().from('question_reports').update({ status: 'answered' }).eq('id', b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  const reply = typeof b?.reply === 'string' ? b.reply.trim().slice(0, 1500) : ''
  if (typeof b?.id !== 'string' || !reply) return NextResponse.json({ error: 'Javob matnini yozing.' }, { status: 400 })
  const sb = supabaseAdmin()
  const { data: r } = await sb.from('question_reports').select('id, user_id, test_label, q_number').eq('id', b.id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Topilmadi.' }, { status: 404 })
  if (!r.user_id) return NextResponse.json({ error: 'O‘quvchi hisobi o‘chirilgan — javob yuborib bo‘lmaydi.' }, { status: 409 })
  // Notify first: if this fails the admin sees the error and the report stays "open".
  const { error: nErr } = await sb.from('notifications').insert({
    user_id: r.user_id,
    kind: 'reply',
    title: `Javob: ${r.test_label}${r.q_number ? ` · Q${r.q_number}` : ''}`,
    body: reply,
  })
  if (nErr) return NextResponse.json({ error: 'Javobni o‘quvchiga yetkazib bo‘lmadi: ' + nErr.message }, { status: 500 })
  await sb.from('question_reports').update({ status: 'answered', reply, replied_at: new Date().toISOString() }).eq('id', b.id)
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
  await supabaseAdmin().from('question_reports').delete().eq('id', b.id)
  return NextResponse.json({ ok: true })
}
