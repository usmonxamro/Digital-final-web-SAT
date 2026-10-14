import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { normalizeEmail, likeEscape } from '@/lib/email'
import { mailConfigured, sendMail } from '@/lib/mailer'
import { hashResetCode, newResetCode, RESET_MINUTES } from '@/lib/password-reset'
import { isMissingTable } from '@/lib/db-errors'
import { TG_PERSONAL } from '@/lib/contact'

/** Step 1 of password recovery: POST { email } → a 6-digit code is e-mailed. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null
  const email = normalizeEmail(body?.email)
  if (!email) return NextResponse.json({ error: "Email manzilini to'g'ri kiriting." }, { status: 400 })

  if (!mailConfigured()) {
    return NextResponse.json(
      { error: `Email xizmati hali yoqilmagan. Parolni tiklash uchun Telegramda ${TG_PERSONAL} ga yozing.` },
      { status: 503 },
    )
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Server sozlanmagan.' }, { status: 503 })
  }
  if (
    !(await rateLimit(supabase, `forgot:ip:${clientIp(req)}`, 8, 3600)) ||
    !(await rateLimit(supabase, `forgot:email:${email}`, 3, 3600))
  ) {
    return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq qayta urinib ko'ring." }, { status: 429 })
  }

  // Same answer whether or not the address exists (don't reveal who has an account).
  const generic = NextResponse.json({ ok: true })
  const { data: user } = await supabase.from('users').select('id, first_name').ilike('email', likeEscape(email)).maybeSingle()
  if (!user) return generic

  const code = newResetCode()
  await supabase.from('password_resets').delete().eq('user_id', user.id)
  const { error } = await supabase.from('password_resets').insert({
    user_id: user.id,
    code_hash: hashResetCode(user.id, code),
    expires_at: new Date(Date.now() + RESET_MINUTES * 60_000).toISOString(),
  })
  if (error) {
    return NextResponse.json(
      { error: isMissingTable(error) ? "Avval Supabase'da v66 SQL'ni ishga tushiring." : 'Server xatosi.' },
      { status: 503 },
    )
  }
  const ok = await sendMail(
    email,
    `SAT Akademiyasi: parolni tiklash kodi ${code}`,
    `<div style="font-family:Arial,sans-serif;max-width:420px"><h2>Parolni tiklash</h2><p>Salom, ${user.first_name ?? ''}!</p><p>Tasdiqlash kodingiz:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px">${code}</p><p>Kod ${RESET_MINUTES} daqiqa amal qiladi. Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.</p></div>`,
    `Parolni tiklash kodi: ${code} (${RESET_MINUTES} daqiqa amal qiladi).`,
  )
  if (!ok) return NextResponse.json({ error: "Xatni yuborib bo'lmadi. Keyinroq urinib ko'ring." }, { status: 502 })
  return generic
}
