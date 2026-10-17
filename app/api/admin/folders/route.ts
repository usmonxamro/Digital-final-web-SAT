import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'

export type MockFolder = { id: string; name: string; position: number }

const NO_TABLE = "Avval Supabase'da v78 SQL'ni ishga tushiring (mock_folders)."
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const cleanName = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 40) : '')

/** GET → all mock folders, in the order they were made. */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const { data, error } = await supabaseAdmin().from('mock_folders').select('id, name, position').order('position').order('created_at')
  if (error) {
    // Table not created yet → an empty list plus a hint, so the Mocklar tab still works.
    return NextResponse.json({ folders: [] as MockFolder[], error: isMissingTable(error) ? NO_TABLE : 'Bo‘limlarni yuklab bo‘lmadi.' })
  }
  return NextResponse.json({ folders: (data ?? []) as MockFolder[] })
}

/** POST { name } → create a folder. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null
  const name = cleanName(body?.name)
  if (!name) return NextResponse.json({ error: "Bo'lim nomini yozing." }, { status: 400 })
  const sb = supabaseAdmin()
  const { data: last, error: lErr } = await sb.from('mock_folders').select('position, name').order('position', { ascending: false }).limit(200)
  if (lErr) return NextResponse.json({ error: isMissingTable(lErr) ? NO_TABLE : 'Saqlab bo‘lmadi.' }, { status: 500 })
  if ((last ?? []).some((f) => String(f.name).toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: 'Bunday nomli bo‘lim bor.' }, { status: 409 })
  }
  const position = (last?.[0]?.position ?? 0) + 1
  const { data, error } = await sb.from('mock_folders').insert({ name, position }).select('id, name, position').single()
  if (error || !data) return NextResponse.json({ error: 'Saqlab bo‘lmadi.' }, { status: 500 })
  return NextResponse.json({ folder: data as MockFolder })
}

/** PATCH { id, name } → rename. */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as { id?: unknown; name?: unknown } | null
  const name = cleanName(body?.name)
  if (typeof body?.id !== 'string' || !UUID.test(body.id) || !name) return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  const { error } = await supabaseAdmin().from('mock_folders').update({ name }).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Saqlab bo‘lmadi.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** DELETE { id } → remove the folder; its mocks stay in the general list (they just lose this folder). */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null
  if (typeof body?.id !== 'string' || !UUID.test(body.id)) return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  const sb = supabaseAdmin()
  const { data: rows } = await sb.from('test_configs').select('test_label, folder_ids').contains('folder_ids', [body.id])
  for (const r of rows ?? []) {
    const next = ((r.folder_ids as string[] | null) ?? []).filter((x) => x !== body.id)
    await sb.from('test_configs').update({ folder_ids: next }).eq('test_label', r.test_label as string)
  }
  const { error } = await sb.from('mock_folders').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error: 'O‘chirib bo‘lmadi.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
