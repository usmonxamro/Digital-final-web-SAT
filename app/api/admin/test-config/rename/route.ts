import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { invalidateCounts } from '@/lib/mock-catalog'
import { configGroups, groupOfLabel, groupsOfTask } from '@/lib/course-groups'

/**
 * POST { from, to } — rename a mock everywhere (settings, questions, results, starts, reports, bot link).
 * The work is one Postgres transaction: public.admin_rename_mock (supabase/v106_rename_mock.sql).
 */
const ERRORS: Record<string, [number, string]> = {
  BAD_NAME: [400, "Yangi nom bo'sh yoki juda uzun (160 belgigacha)."],
  SAME_NAME: [400, 'Yangi nom eskisi bilan bir xil.'],
  NAME_TAKEN: [409, 'Bunday nomli mock allaqachon bor — boshqa nom tanlang.'],
  NOT_FOUND: [404, 'Bu mock topilmadi (o‘chirilgan bo‘lishi mumkin).'],
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const from = typeof body?.from === 'string' ? body.from : ''
  const to = typeof body?.to === 'string' ? body.to.replace(/\s+/g, ' ').trim() : ''
  if (!from.trim()) return NextResponse.json({ error: 'Qaysi mock — nomi kerak.' }, { status: 400 })
  if (!to) return NextResponse.json({ error: ERRORS.BAD_NAME[1] }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: cfg } = await sb.from('test_configs').select('*').eq('test_label', from).maybeSingle()
  // A task that belongs to a group only because its NAME starts with the group title keeps that group.
  const groups = groupsOfTask(from, configGroups(cfg))
  if (!cfg && groupOfLabel(from) && groupOfLabel(from) !== groupOfLabel(to)) {
    return NextResponse.json(
      { error: "Bu eski vazifa guruhga nomi orqali bog'langan. Yangi nom ham guruh nomi bilan boshlansin yoki avval vazifani guruhga tugma bilan bering." },
      { status: 400 },
    )
  }

  const { data, error } = await sb.rpc('admin_rename_mock', { p_old: from, p_new: to, p_groups: groups.length ? groups : null })
  if (error) {
    if (/admin_rename_mock|function .* does not exist|PGRST202/i.test(`${error.code} ${error.message}`) && !/BAD_NAME|SAME_NAME|NAME_TAKEN|NOT_FOUND/.test(error.message)) {
      return NextResponse.json({ error: "Avval Supabase'da supabase/v106_rename_mock.sql ni ishga tushiring (SQL Editor → Run)." }, { status: 503 })
    }
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k))
    if (key) return NextResponse.json({ error: ERRORS[key][1] }, { status: ERRORS[key][0] })
    return NextResponse.json({ error: `Nomini o'zgartirib bo'lmadi: ${error.message}` }, { status: 500 })
  }
  invalidateCounts()
  return NextResponse.json({ ok: true, ...(data as object) })
}
