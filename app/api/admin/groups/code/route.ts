import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'
import { COURSE_GROUPS, groupBySlug } from '@/lib/course-groups'
import { createJoinCode, type GroupCodeRow } from '@/lib/course-group-codes'

const NO_TABLE = { error: "Avval Supabase'da v75 SQL'ni ishga tushiring (course_group_codes)." }

/** GET → the shared join code of every course group (a missing one is created on the spot). */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const sb = supabaseAdmin()
  const { data, error } = await sb.from('course_group_codes').select('group_slug, code, active')
  if (error) return NextResponse.json(NO_TABLE, { status: isMissingTable(error) ? 503 : 500 })
  const rows = (data ?? []) as GroupCodeRow[]
  for (const g of COURSE_GROUPS) {
    if (rows.some((r) => r.group_slug === g.slug)) continue
    const made = await createJoinCode(sb, g.slug)
    if (made.code) rows.push({ group_slug: g.slug, code: made.code, active: true })
  }
  return NextResponse.json({ codes: Object.fromEntries(rows.map((r) => [r.group_slug, { code: r.code, active: r.active }])) })
}

/** POST { slug, action: 'regenerate' | 'on' | 'off' } */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as { slug?: string; action?: string } | null
  if (!body?.slug || !groupBySlug(body.slug)) return NextResponse.json({ error: "Noma'lum guruh." }, { status: 400 })
  const sb = supabaseAdmin()

  if (body.action === 'regenerate') {
    const { data: cur } = await sb.from('course_group_codes').select('active').eq('group_slug', body.slug).maybeSingle()
    const made = await createJoinCode(sb, body.slug, cur ? !!cur.active : true)
    if (!made.code) return NextResponse.json({ error: 'Yangi kod yaratib bo‘lmadi.' }, { status: 500 })
    return NextResponse.json({ code: made.code, active: cur ? !!cur.active : true })
  }
  if (body.action === 'on' || body.action === 'off') {
    const { error } = await sb.from('course_group_codes').update({ active: body.action === 'on' }).eq('group_slug', body.slug)
    if (error) return NextResponse.json(NO_TABLE, { status: 500 })
    return NextResponse.json({ ok: true, active: body.action === 'on' })
  }
  return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
}
