import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'
import { rowToQuestion } from '@/lib/bot-question-map'
import { familyOf } from '@/lib/twins'

const NEED_SQL = 'question_flags jadvali yo‘q — supabase/v117_question_flags.sql ni Supabase SQL Editor’da ishga tushiring.'
const STATUSES = ['open', 'fixed', 'ok'] as const
const KINDS = ['key', 'text'] as const

async function guard() {
  try {
    await requireAdmin()
    return null
  } catch (e) {
    return adminErrorResponse(e)
  }
}

/** «Shubhali savollar»: GET ?status=open|done|all → flagged question families with the question text and twin count. */
export async function GET(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  const sb = supabaseAdmin()
  const status = req.nextUrl.searchParams.get('status') ?? 'open'
  let q = sb.from('question_flags').select('*').order('created_at', { ascending: false }).limit(500)
  if (status === 'open') q = q.eq('status', 'open')
  else if (status === 'done') q = q.in('status', ['fixed', 'ok'])
  const { data: flags, error } = await q
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ items: [], counts: { open: 0, done: 0 }, missing: true, error: NEED_SQL })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { data: all } = await sb.from('question_flags').select('status')
  const counts = {
    open: (all ?? []).filter((r) => r.status === 'open').length,
    done: (all ?? []).filter((r) => r.status !== 'open').length,
  }
  const ids = [...new Set((flags ?? []).flatMap((f) => [f.question_id as string | null, f.family_id as string]).filter(Boolean) as string[])]
  const rows = ids.length ? (await sb.from('questions').select('*').in('id', ids)).data ?? [] : []
  const byId = new Map(rows.map((r) => [r.id as string, r]))
  const fams = (flags ?? []).map((f) => f.family_id as string)
  const twinCount = new Map<string, number>()
  if (fams.length) {
    const { data: tw } = await sb.from('question_twins').select('family_id').in('family_id', fams)
    for (const t of tw ?? []) twinCount.set(t.family_id as string, (twinCount.get(t.family_id as string) ?? 0) + 1)
  }
  const items = (flags ?? []).map((f) => {
    const r = byId.get((f.question_id as string) ?? '') ?? byId.get(f.family_id as string)
    return {
      id: f.id as string,
      family: f.family_id as string,
      questionId: (r?.id as string) ?? null,
      kind: f.kind as string,
      reason: f.reason as string,
      suggested: (f.suggested as string) ?? null,
      status: f.status as string,
      source: f.source as string,
      createdAt: f.created_at as string,
      resolvedAt: (f.resolved_at as string) ?? null,
      twins: twinCount.get(f.family_id as string) ?? 0,
      testLabel: (r?.test_label as string) ?? null,
      question: r ? { ...rowToQuestion(r), kind: r.kind === 'reading' ? 'reading' : 'math' } : null,
    }
  })
  return NextResponse.json({ items, counts })
}

/** POST { questionId, reason, kind?, suggested? } — mark a question as suspicious (one flag per family). */
export async function POST(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  const body = await req.json().catch(() => null)
  const questionId = typeof body?.questionId === 'string' ? body.questionId : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!questionId || !reason) return NextResponse.json({ error: 'questionId va reason kerak' }, { status: 400 })
  const kind = KINDS.includes(body?.kind) ? body.kind : 'key'
  const sb = supabaseAdmin()
  const { data: row, error: qErr } = await sb.from('questions').select('id, family_id').eq('id', questionId).maybeSingle()
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Savol topilmadi' }, { status: 404 })
  const { error } = await sb.from('question_flags').upsert(
    { family_id: familyOf(row), question_id: row.id, kind, reason, suggested: typeof body?.suggested === 'string' ? body.suggested : null, status: 'open', source: 'admin', resolved_at: null },
    { onConflict: 'family_id' },
  )
  if (error) return NextResponse.json({ error: isMissingTable(error) ? NEED_SQL : error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** PATCH { id, status: 'open' | 'fixed' | 'ok' } — close (tuzatildi / tekshirildi, to‘g‘ri) or reopen a flag. */
export async function PATCH(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const status = body?.status
  if (!id || !STATUSES.includes(status)) return NextResponse.json({ error: 'id va status (open|fixed|ok) kerak' }, { status: 400 })
  const { error } = await supabaseAdmin()
    .from('question_flags')
    .update({ status, resolved_at: status === 'open' ? null : new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id kerak' }, { status: 400 })
  const { error } = await supabaseAdmin().from('question_flags').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
