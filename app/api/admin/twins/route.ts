import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'
import { fetchAll } from '@/lib/db-paginate'
import { validateQuestions } from '@/lib/admin-schema'
import type { Question } from '@/lib/test-data'
import { familyOf, questionColumns, rowToTwin } from '@/lib/twins'
import { rowToQuestion } from '@/lib/bot-question-map'

const NEED_SQL = 'question_twins jadvali yo‘q — supabase/v112_twins.sql ni Supabase SQL Editor’da ishga tushiring.'

async function guard() {
  try {
    await requireAdmin()
    return null
  } catch (e) {
    return adminErrorResponse(e)
  }
}

/**
 * GET ?families=a,b → { twins } of those families.
 * GET ?coverage=1   → per mock / task: how many of its questions already have a twin.
 */
export async function GET(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  const sb = supabaseAdmin()
  const sp = req.nextUrl.searchParams

  if (sp.get('coverage')) {
    const [qs, tw, cfg] = await Promise.all([
      fetchAll<{ id: string; family_id: string | null; test_label: string | null; image: string | null }>((f, t) =>
        sb.from('questions').select('id, family_id, test_label, image').eq('kind', 'math').not('test_label', 'is', null).order('id').range(f, t),
      ),
      fetchAll<{ family_id: string; key_checked: boolean }>((f, t) => sb.from('question_twins').select('family_id, key_checked').order('id').range(f, t)),
      sb.from('test_configs').select('test_label, placement, published'),
    ])
    if (tw.error && isMissingTable(tw.error)) return NextResponse.json({ missing: true, error: NEED_SQL })
    const twinFam = new Map<string, { n: number; checked: number }>()
    for (const t of tw.data) {
      const x = twinFam.get(t.family_id) ?? { n: 0, checked: 0 }
      x.n++
      if (t.key_checked) x.checked++
      twinFam.set(t.family_id, x)
    }
    const place = new Map((cfg.data ?? []).map((c) => [c.test_label as string, c]))
    const per = new Map<string, { label: string; total: number; withTwin: number; checked: number; withImage: number }>()
    for (const q of qs.data) {
      const label = q.test_label as string
      const c = place.get(label)
      if (!c || (c.placement !== 'mock' && c.placement !== 'course_task')) continue
      const x = per.get(label) ?? { label, total: 0, withTwin: 0, checked: 0, withImage: 0 }
      x.total++
      if (q.image) x.withImage++
      const f = twinFam.get(familyOf(q))
      if (f) {
        x.withTwin++
        if (f.checked) x.checked++
      }
      per.set(label, x)
    }
    const mocks = [...per.values()].map((m) => ({ ...m, placement: place.get(m.label)?.placement ?? 'mock' }))
    mocks.sort((a, b) => a.label.localeCompare(b.label))
    return NextResponse.json({ mocks, twins: tw.data.length, families: twinFam.size })
  }

  // ?questions=a,b → those questions with their family and twins (the builder's "add from basket").
  const qIds = (sp.get('questions') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200)
  if (qIds.length) {
    const { data: rows, error } = await sb.from('questions').select('*').in('id', qIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const famIds = [...new Set((rows ?? []).map(familyOf))]
    const { data: tw } = await sb.from('question_twins').select('*').in('family_id', famIds).order('variant')
    const twins = (tw ?? []).map(rowToTwin)
    const byId = new Map((rows ?? []).map((r) => [r.id as string, r]))
    const items = qIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => ({
        family: familyOf(r),
        question: { ...rowToQuestion(r), testLabel: r.test_label ?? undefined },
        twins: twins.filter((t) => t.familyId === familyOf(r)),
      }))
    return NextResponse.json({ items })
  }

  const fams = (sp.get('families') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 300)
  if (!fams.length) return NextResponse.json({ twins: [] })
  const { data, error } = await sb.from('question_twins').select('*').in('family_id', fams).order('variant')
  if (error) return NextResponse.json(isMissingTable(error) ? { twins: [], missing: true, error: NEED_SQL } : { error: error.message }, { status: isMissingTable(error) ? 200 : 500 })
  return NextResponse.json({ twins: (data ?? []).map(rowToTwin) })
}

/**
 * POST { twins: [{ sourceId, needsFigure?, ...question }] } — import twins made by GPT / Claude from the export.
 * Each twin joins its source's family with the next free variant number. Keys arrive UNCHECKED: the admin
 * confirms them one click each (or fixes them) before a review mock uses the twin.
 */
export async function POST(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  const body = await req.json().catch(() => null)
  const raw: unknown[] = Array.isArray(body) ? body : Array.isArray(body?.twins) ? body.twins : []
  if (!raw.length) return NextResponse.json({ error: 'JSON array bo‘sh yoki noto‘g‘ri.' }, { status: 400 })

  const items: { sourceId: string; needsFigure: boolean; q: Question; i: number }[] = []
  const errors: string[] = []
  raw.forEach((r, i) => {
    if (!r || typeof r !== 'object') return errors.push(`#${i + 1}: obyekt emas`)
    const { sourceId, needsFigure, id: _id, no: _no, ...q } = r as Record<string, unknown>
    void _no
    void _id
    if (typeof sourceId !== 'string' || !sourceId) return errors.push(`#${i + 1}: "sourceId" yo‘q`)
    const errs = validateQuestions([q], { requireAnswers: false })
    if (errs.length) return errors.push(`#${i + 1}: ${errs.map((e) => e.message).join('; ')}`)
    items.push({ sourceId, needsFigure: needsFigure === true, q: q as unknown as Question, i })
  })
  if (errors.length) return NextResponse.json({ error: 'JSON xatolari', details: errors.slice(0, 30) }, { status: 400 })

  const sb = supabaseAdmin()
  const ids = [...new Set(items.map((x) => x.sourceId))]
  const { data: src, error: srcErr } = await sb.from('questions').select('id, family_id, kind, image, layout').in('id', ids)
  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 })
  const byId = new Map((src ?? []).map((r) => [r.id as string, r]))
  const missing = ids.filter((id) => !byId.has(id))
  if (missing.length) return NextResponse.json({ error: `Bazada topilmagan sourceId: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}` }, { status: 400 })

  const fams = [...new Set((src ?? []).map(familyOf))]
  const { data: existing, error: exErr } = await sb.from('question_twins').select('family_id, variant').in('family_id', fams)
  if (exErr) return NextResponse.json({ error: isMissingTable(exErr) ? NEED_SQL : exErr.message }, { status: 500 })
  const next = new Map<string, number>()
  for (const e of existing ?? []) next.set(e.family_id as string, Math.max(next.get(e.family_id as string) ?? 0, Number(e.variant)))

  const rows = items.map(({ sourceId, needsFigure, q }) => {
    const s = byId.get(sourceId)!
    const fam = familyOf(s)
    const v = (next.get(fam) ?? 0) + 1
    next.set(fam, v)
    // No "image" key in the twin → the figure of the source is reused (numbers only changed in the text).
    const image = 'image' in q ? q.image ?? null : ((s.image as string) ?? null)
    return {
      ...questionColumns(q),
      image,
      layout: q.layout ?? (image === s.image ? s.layout ?? null : null),
      family_id: fam,
      source_id: sourceId,
      variant: v,
      kind: s.kind === 'reading' ? 'reading' : 'math',
      key_checked: false,
      needs_figure: needsFigure,
    }
  })
  const { error } = await sb.from('question_twins').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, imported: rows.length })
}

/** PATCH { id, question?, keyChecked?, needsFigure? } — fix a twin's text / key, or confirm its key. */
export async function PATCH(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id kerak' }, { status: 400 })
  const upd: Record<string, unknown> = {}
  if (body.question) {
    const errs = validateQuestions([body.question], { requireAnswers: false })
    if (errs.length) return NextResponse.json({ error: errs.map((e) => e.message).join('; ') }, { status: 400 })
    Object.assign(upd, questionColumns(body.question as Question))
  }
  if (typeof body.keyChecked === 'boolean') upd.key_checked = body.keyChecked
  if (typeof body.needsFigure === 'boolean') upd.needs_figure = body.needsFigure
  if (!Object.keys(upd).length) return NextResponse.json({ error: 'O‘zgarish yo‘q' }, { status: 400 })
  const { data, error } = await supabaseAdmin().from('question_twins').update(upd).eq('id', id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, twin: data ? rowToTwin(data) : null })
}

export async function DELETE(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id kerak' }, { status: 400 })
  const { error } = await supabaseAdmin().from('question_twins').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
