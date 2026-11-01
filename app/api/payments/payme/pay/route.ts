import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { memoryLimit } from '@/lib/rate-limit'
import { planById } from '@/lib/pro-plans'

/**
 * Charges a Payme card token for a PRO plan (Payme Subscribe API: receipts.create → receipts.pay).
 *
 * The card number never reaches this server: the browser sends it straight to Payme
 * (cards.create), confirms the SMS code (cards.verify) and only hands us the one-time token.
 *
 * Env: NEXT_PUBLIC_PAYME_MERCHANT_ID (also used by the browser), PAYME_SECRET_KEY (server only),
 * NEXT_PUBLIC_PAYME_TEST=1 → Payme test server.
 */
const PAYME_URL = process.env.NEXT_PUBLIC_PAYME_TEST === '1' ? 'https://checkout.test.paycom.uz/api' : 'https://checkout.paycom.uz/api'

async function payme(method: string, params: Record<string, unknown>) {
  const res = await fetch(PAYME_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth': `${process.env.NEXT_PUBLIC_PAYME_MERCHANT_ID}:${process.env.PAYME_SECRET_KEY}`,
    },
    body: JSON.stringify({ id: Date.now(), method, params }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => null)
  if (!data || data.error) {
    const msg = data?.error?.message
    throw new Error(typeof msg === 'string' ? msg : (msg?.uz ?? msg?.ru ?? "To'lov amalga oshmadi."))
  }
  return data.result
}

export async function POST(req: NextRequest) {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })
  if (!process.env.NEXT_PUBLIC_PAYME_MERCHANT_ID || !process.env.PAYME_SECRET_KEY) {
    return NextResponse.json({ error: "Karta orqali to'lov hali ulanmagan." }, { status: 501 })
  }
  if (!memoryLimit(`pay:${session.userId}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring." }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const token = typeof body?.token === 'string' && body.token.length < 2000 ? body.token : ''
  const plan = planById(body?.planId)
  if (!token || !plan) return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })

  const supabase = supabaseAdmin()
  let receiptId = ''
  try {
    const created = await payme('receipts.create', {
      amount: plan.price * 100, // tiyin
      account: { user_id: session.userId },
      description: `SAT by Usmon — PRO ${plan.label}`,
    })
    receiptId = created?.receipt?._id
    if (!receiptId) throw new Error("Chek yaratilmadi.")
    const paid = await payme('receipts.pay', { id: receiptId, token })
    if (paid?.receipt?.state !== 4) throw new Error("To'lov tasdiqlanmadi.")
  } catch (e) {
    await supabase.from('payments').insert({ user_id: session.userId, provider: 'payme', plan: plan.id, amount: plan.price, status: 'failed', receipt_id: receiptId || null }).then(() => {}, () => {})
    return NextResponse.json({ error: e instanceof Error ? e.message : "To'lov amalga oshmadi." }, { status: 402 })
  }

  // Paid → extend PRO from whichever is later: now or the current end date.
  const { data: user } = await supabase.from('users').select('premium_until').eq('id', session.userId).maybeSingle()
  const current = user?.premium_until ? Date.parse(user.premium_until) : 0
  const from = Math.max(Date.now(), Number.isFinite(current) ? current : 0)
  const until = new Date(from)
  until.setMonth(until.getMonth() + plan.months)
  await supabase.from('users').update({ premium_until: until.toISOString() }).eq('id', session.userId)
  await supabase.from('payments').insert({ user_id: session.userId, provider: 'payme', plan: plan.id, amount: plan.price, status: 'paid', receipt_id: receiptId }).then(() => {}, () => {})

  return NextResponse.json({ ok: true, premiumUntil: until.toISOString() })
}
