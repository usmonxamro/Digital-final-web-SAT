import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingColumn } from '@/lib/db-columns'
import { invalidateCounts } from '@/lib/mock-catalog'
import { familyOf } from '@/lib/twins'

type Item = { questionId?: string; twinId?: string; module?: 1 | 2 }

/**
 * «Mock tuzish» → creates a NEW mock, saved as a DRAFT, from questions and/or twins in the exact order given.
 *
 * Body: { title, layout: 'modules' | 'single', minutes?, items: [{ questionId | twinId, module }] }
 *  (old form { title, questionIds } still works: two halves.)
 *
 * The rows are copied into the mock (the exam reads a mock's own rows) but every copy keeps its family
 * (family_id + variant + twin_id), so mistakes on it count for the same family in the «Xatolar bazasi»
 * and the twins are reused — the pool does not fill up with "new" copies of the same question.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : ''
  const single = body?.layout === 'single'
  let items: Item[] = Array.isArray(body?.items) ? (body.items as Item[]) : []
  if (!items.length && Array.isArray(body?.questionIds)) {
    const ids = [...new Set((body.questionIds as unknown[]).filter((x): x is string => typeof x === 'string'))]
    const half = Math.ceil(ids.length / 2)
    items = ids.map((id, i) => ({ questionId: id, module: ids.length < 2 || i < half ? 1 : 2 }))
  }
  items = items.filter((x) => (typeof x?.questionId === 'string' && x.questionId) || (typeof x?.twinId === 'string' && x.twinId))
  if (!title) return NextResponse.json({ error: 'Mock nomini yozing.' }, { status: 400 })
  if (!items.length) return NextResponse.json({ error: 'Savollar tanlanmagan.' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: exists } = await sb.from('test_configs').select('test_label').eq('test_label', title).maybeSingle()
  if (exists) return NextResponse.json({ error: `"${title}" nomli mock allaqachon bor — boshqa nom tanlang.` }, { status: 409 })

  const qIds = [...new Set(items.map((x) => x.questionId).filter(Boolean) as string[])]
  const tIds = [...new Set(items.map((x) => x.twinId).filter(Boolean) as string[])]
  const [qRes, tRes] = await Promise.all([
    qIds.length ? sb.from('questions').select('*').in('id', qIds) : Promise.resolve({ data: [], error: null }),
    tIds.length ? sb.from('question_twins').select('*').in('id', tIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (qRes.error) return NextResponse.json({ error: qRes.error.message }, { status: 500 })
  if (tRes.error) return NextResponse.json({ error: tRes.error.message }, { status: 500 })
  const qById = new Map((qRes.data ?? []).map((r) => [r.id as string, r as Record<string, unknown>]))
  const tById = new Map((tRes.data ?? []).map((r) => [r.id as string, r as Record<string, unknown>]))

  const COPY = ['kind', 'type', 'difficulty', 'domain', 'passage', 'underline', 'prompt', 'equations', 'image', 'choices', 'correct', 'correct_value', 'explanation', 'layout']
  const resolved = items
    .map((it) => {
      if (it.twinId) {
        const t = tById.get(it.twinId)
        return t ? { row: t, family: t.family_id as string, variant: Number(t.variant ?? 1), twinId: t.id as string, module: it.module } : null
      }
      const q = qById.get(it.questionId!)
      return q ? { row: q, family: familyOf(q), variant: Number(q.variant ?? 0), twinId: (q.twin_id as string) ?? null, module: it.module } : null
    })
    .filter((x): x is NonNullable<typeof x> => !!x)

  const math = resolved.filter((r) => r.row.kind !== 'reading')
  const reading = resolved.filter((r) => r.row.kind === 'reading')
  const m1 = math.filter((r) => r.module !== 2).length
  const m2 = math.length - m1
  if (single && math.length > 44) return NextResponse.json({ error: `Bir modulli mockka ko‘pi bilan 44 ta savol sig‘adi (hozir ${math.length}).` }, { status: 400 })
  if (!single && (m1 > 22 || m2 > 22)) return NextResponse.json({ error: `Har bir modulga ko‘pi bilan 22 ta Math savol (hozir ${m1} + ${m2}).` }, { status: 400 })
  if (reading.length > 54) return NextResponse.json({ error: `Reading savollari ${reading.length} ta — ko‘pi bilan 54 ta.` }, { status: 400 })

  const subject = math.length && reading.length ? 'full' : math.length ? 'math' : 'english'
  const base = Date.now()
  // Module 1 rows first, then Module 2 — inside each, the order the admin arranged.
  const ordered = [...reading, ...math.filter((r) => single || r.module !== 2), ...(single ? [] : math.filter((r) => r.module === 2))]
  const insert = ordered.map((r, i) => {
    const row: Record<string, unknown> = { test_label: title, created_at: new Date(base + i).toISOString() }
    for (const k of COPY) row[k] = r.row[k] ?? null
    if (!row.kind) row.kind = 'math'
    row.module_number = single ? 1 : r.module === 2 ? 2 : 1
    row.family_id = r.family
    row.variant = r.variant
    row.twin_id = r.twinId
    return row
  })

  const minutes = Math.max(1, Math.min(300, Number(body?.minutes) || (single ? 70 : 35)))
  const cfg: Record<string, unknown> = {
    test_label: title,
    subject,
    scored: true,
    placement: 'mock',
    published: false,
    english_module_minutes: 32,
    math_module_minutes: single ? 35 : minutes,
    math_layout: single ? 'sequential' : 'modules',
    module_minutes: single ? { seq: minutes } : { m1: minutes, m2: minutes },
  }
  let { error: cfgErr } = await sb.from('test_configs').upsert(cfg)
  if (cfgErr && isMissingColumn(cfgErr, 'module_minutes')) {
    delete cfg.module_minutes
    ;({ error: cfgErr } = await sb.from('test_configs').upsert(cfg))
  }
  if (cfgErr) return NextResponse.json({ error: `Mock sozlamasini saqlab bo‘lmadi: ${cfgErr.message}` }, { status: 500 })

  let { error: insErr } = await sb.from('questions').insert(insert)
  if (insErr && /family_id|variant|twin_id/.test(insErr.message)) {
    // v112 SQL not run yet — copy without the family columns.
    for (const r of insert) {
      delete r.family_id
      delete r.variant
      delete r.twin_id
    }
    ;({ error: insErr } = await sb.from('questions').insert(insert))
  }
  if (insErr) {
    await sb.from('test_configs').delete().eq('test_label', title)
    return NextResponse.json({ error: `Savollarni nusxalab bo‘lmadi: ${insErr.message}` }, { status: 500 })
  }
  invalidateCounts()
  return NextResponse.json({ ok: true, testLabel: title, count: insert.length, missing: items.length - resolved.length })
}
