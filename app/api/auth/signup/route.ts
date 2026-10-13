import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { trialEndFromNow } from '@/lib/plan'
import { normalizePhone, phoneDigits, usersWithPhone } from '@/lib/phone'
import { normalizeEmail, likeEscape } from '@/lib/email'

const NAME_RE = /^[\p{L}\p{M}' .-]{1,40}$/u
const PHONE_RE = /^\+?[\d\s()-]{7,20}$/

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Noto'g'ri so'rov formati." }, { status: 400 })
  }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const firstName = str(body.firstName)
  const lastName = str(body.lastName)
  const rawPhone = str(body.phone)
  const phone = rawPhone ? normalizePhone(rawPhone) : ''
  const rawEmail = str(body.email)
  const email = rawEmail ? normalizeEmail(rawEmail) : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!firstName || !lastName || (!phone && !email) || !password) {
    return NextResponse.json({ error: "Ism, familiya, email (yoki telefon) va parol to'ldirilishi shart." }, { status: 400 })
  }
  if (rawEmail && !email) {
    return NextResponse.json({ error: "Email manzili noto'g'ri." }, { status: 400 })
  }
  if (!NAME_RE.test(firstName) || !NAME_RE.test(lastName)) {
    return NextResponse.json({ error: "Ism va familiyada faqat harflar bo'lishi kerak (40 belgigacha)." }, { status: 400 })
  }
  if (phone && (!PHONE_RE.test(rawPhone) || phoneDigits(phone).length < 7)) {
    return NextResponse.json({ error: "Telefon raqami noto'g'ri." }, { status: 400 })
  }
  if (password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "Parol 6 dan 72 tagacha belgidan iborat bo'lishi kerak." }, { status: 400 })
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server sozlanmagan.' }, { status: 503 })
  }

  // Mass account creation from one address.
  if (!(await rateLimit(supabase, `signup:ip:${clientIp(req)}`, 5, 60 * 60))) {
    return NextResponse.json({ error: "Juda ko'p ro'yxatdan o'tish urinishi. Keyinroq urinib ko'ring." }, { status: 429 })
  }

  // Same number in any spelling = same account.
  if (phone) {
    const existing = await usersWithPhone(supabase, phone, 'id')
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Bu telefon raqami bilan hisob allaqachon mavjud.' }, { status: 409 })
    }
  }
  if (email) {
    const { data: byEmail, error: emailErr } = await supabase.from('users').select('id').ilike('email', likeEscape(email)).limit(1)
    if (emailErr) return NextResponse.json({ error: "Email bilan ro'yxatdan o'tish hali yoqilmagan (v50 SQL kerak)." }, { status: 503 })
    if ((byEmail ?? []).length > 0) {
      return NextResponse.json({ error: 'Bu email bilan hisob allaqachon mavjud.' }, { status: 409 })
    }
  }

  const passwordHash = await hashPassword(password)
  const base: Record<string, unknown> = { first_name: firstName, last_name: lastName, password_hash: passwordHash }
  if (phone) base.phone = phone
  if (email) base.email = email
  let { data: user, error } = await supabase
    .from('users')
    .insert({ ...base, premium_until: trialEndFromNow() })
    .select('id, first_name')
    .single()
  if (error && /premium_until/.test(error.message)) {
    // v38 SQL not run yet.
    ;({ data: user, error } = await supabase.from('users').insert(base).select('id, first_name').single())
  }

  if (error || !user) {
    return NextResponse.json({ error: 'Hisob yaratishda xatolik yuz berdi.' }, { status: 500 })
  }

  let token: string
  try {
    token = signSession({ userId: user.id, firstName: user.first_name })
  } catch {
    return NextResponse.json({ error: 'Server sozlanmagan (SESSION_SECRET).' }, { status: 503 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
  return res
}
