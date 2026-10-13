import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin, requireOwner } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingColumn, MIGRATION_HINT } from '@/lib/db-columns'
import { usersWithPhone } from '@/lib/phone'
import { normalizeEmail, likeEscape } from '@/lib/email'

export type AdminRow = { id: string; name: string; phone: string; email: string; owner: boolean }


/** List admins (any admin may look). */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const supabase = supabaseAdmin()
  const owner = process.env.ADMIN_PHONE?.trim() ?? ''
  const { data, error } = await supabase.from('users').select('*').eq('role', 'admin')
  const rows: AdminRow[] = (error ? [] : data ?? []).map((u) => ({
    id: u.id,
    name: `${u.first_name} ${u.last_name}`,
    phone: u.phone ?? '',
    email: u.email ?? '',
    owner: false,
  }))
  if (owner) {
    const o = (await usersWithPhone(supabase, owner))[0]
    if (o) rows.unshift({ id: o.id, name: `${o.first_name} ${o.last_name}`, phone: o.phone ?? '', email: ((o as { email?: string }).email) ?? '', owner: true })
  }
  return NextResponse.json({ admins: rows, migrationNeeded: !!error && isMissingColumn(error, 'role') })
}

const MIGRATION_HINT_V50 = "Bazada email ustuni yo'q: supabase/schema.sql oxiridagi v50 qismini ishga tushiring."

/** Owner only: promote a user (by Google e-mail, phone, or userId) to admin. */
export async function POST(req: NextRequest) {
  try {
    await requireOwner()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const supabase = supabaseAdmin()
  const userId = typeof body?.userId === 'string' && /^[0-9a-f-]{36}$/i.test(body.userId) ? body.userId : ''
  const rawId = typeof body?.email === 'string' && body.email.trim() ? body.email : typeof body?.phone === 'string' ? body.phone : ''
  const ident = rawId.trim().slice(0, 254)
  if (!userId && !ident) return NextResponse.json({ error: 'Email yoki telefon raqamini kiriting.' }, { status: 400 })

  type Target = { id: string; first_name: string; last_name: string }
  let target: Target | undefined
  if (userId) {
    const { data } = await supabase.from('users').select('id, first_name, last_name').eq('id', userId).maybeSingle()
    target = data ?? undefined
  } else if (ident.includes('@')) {
    // A Google account: the person may not have signed in yet — we pre-register
    // the e-mail, and their first "Sign in with Google" lands on this admin account.
    const email = normalizeEmail(ident)
    if (!email) return NextResponse.json({ error: "Email manzili noto'g'ri." }, { status: 400 })
    const found = await supabase.from('users').select('id, first_name, last_name').ilike('email', likeEscape(email)).limit(1)
    if (found.error) return NextResponse.json({ error: MIGRATION_HINT_V50 }, { status: 409 })
    target = found.data?.[0]
    if (!target) {
      const { data: created, error } = await supabase
        .from('users')
        .insert({ first_name: email.split('@')[0].slice(0, 40), last_name: '-', email, role: 'admin' })
        .select('id, first_name, last_name')
        .single()
      if (error || !created) {
        return NextResponse.json({ error: isMissingColumn(error, 'role') ? MIGRATION_HINT : (error?.message ?? 'Xatolik.') }, { status: 500 })
      }
      return NextResponse.json({ ok: true, name: email, preregistered: true })
    }
  } else {
    target = (await usersWithPhone(supabase, ident))[0]
  }
  if (!target) {
    return NextResponse.json(
      { error: "Bu raqam bilan foydalanuvchi topilmadi. Avval u saytda ro'yxatdan o'tishi kerak." },
      { status: 404 },
    )
  }
  const { error } = await supabase.from('users').update({ role: 'admin' }).eq('id', target.id)
  if (error) {
    return NextResponse.json({ error: isMissingColumn(error, 'role') ? MIGRATION_HINT : error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, name: `${target.first_name} ${target.last_name}` })
}

/** Owner only: remove an admin. */
export async function DELETE(req: NextRequest) {
  try {
    await requireOwner()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Noto'g'ri id." }, { status: 400 })
  const supabase = supabaseAdmin()
  const { error } = await supabase.from('users').update({ role: 'user' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
