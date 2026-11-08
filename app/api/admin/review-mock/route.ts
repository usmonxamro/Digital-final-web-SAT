import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { invalidateCounts } from '@/lib/mock-catalog'

/**
 * «Takrorlash mocki»: POST { title, questionIds } copies the chosen site questions (in the given order) into a
 * NEW mock saved as a DRAFT — e.g. the questions a group got wrong most often across several mocks.
 * Math → Math-only mock (Module 1 / Module 2 split in half, ≤ 22 each); Reading → R&W (≤ 27 each);
 * both → full SAT. Answer keys, explanations, figures and layouts are copied too; the originals are untouched.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : ''
  const rawIds: unknown[] = Array.isArray(body?.questionIds) ? body.questionIds : []
  const ids: string[] = [...new Set(rawIds.filter((x): x is string => typeof x === 'string'))]
  if (!title) return NextResponse.json({ error: 'Mock nomini yozing.' }, { status: 400 })
  if (ids.length === 0) return NextResponse.json({ error: 'Savollar tanlanmagan.' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: exists } = await sb.from('test_configs').select('test_label').eq('test_label', title).maybeSingle()
  if (exists) return NextResponse.json({ error: `"${title}" nomli mock allaqachon bor — boshqa nom tanlang.` }, { status: 409 })

  const { data: rows, error } = await sb.from('questions').select('*').in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const byId = new Map((rows ?? []).map((r) => [r.id as string, r]))
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r)
  const math = ordered.filter((r) => r.kind !== 'reading')
  const reading = ordered.filter((r) => r.kind === 'reading')
  if (math.length > 44) return NextResponse.json({ error: `Math savollari ${math.length} ta — bitta mockka ko‘pi bilan 44 ta (22 + 22) sig‘adi.` }, { status: 400 })
  if (reading.length > 54) return NextResponse.json({ error: `Reading savollari ${reading.length} ta — ko‘pi bilan 54 ta (27 + 27).` }, { status: 400 })

  const subject = math.length && reading.length ? 'full' : math.length ? 'math' : 'english'
  const base = Date.now()
  let n = 0
  const copy = (list: typeof ordered) => {
    const half = Math.ceil(list.length / 2)
    return list.map((r, i) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, created_at: _c, test_label: _t, module_number: _m, ...rest } = r
      return { ...rest, test_label: title, module_number: list.length < 2 ? 1 : i < half ? 1 : 2, created_at: new Date(base + n++).toISOString() }
    })
  }
  const insert = [...copy(reading), ...copy(math)]

  const { error: cfgErr } = await sb.from('test_configs').upsert({
    test_label: title,
    subject,
    scored: true,
    placement: 'mock',
    published: false,
    english_module_minutes: 32,
    math_module_minutes: 35,
    math_layout: 'modules',
  })
  if (cfgErr) return NextResponse.json({ error: `Mock sozlamasini saqlab bo‘lmadi: ${cfgErr.message}` }, { status: 500 })
  const { error: insErr } = await sb.from('questions').insert(insert)
  if (insErr) {
    await sb.from('test_configs').delete().eq('test_label', title)
    return NextResponse.json({ error: `Savollarni nusxalab bo‘lmadi: ${insErr.message}` }, { status: 500 })
  }
  invalidateCounts()
  return NextResponse.json({ ok: true, testLabel: title, count: insert.length, missing: ids.length - ordered.length })
}
