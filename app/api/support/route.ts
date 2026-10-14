import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { isMissingTable } from '@/lib/db-errors'

/** A signed-in student sends a message (+ optional screenshot) to the owner. */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Xabar yuborish uchun tizimga kiring.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 3000) : ''
  const contact = typeof body?.contact === 'string' ? body.contact.trim().slice(0, 120) : ''
  let image: string | null = typeof body?.image === 'string' ? body.image : null
  if (message.length < 5) return NextResponse.json({ error: 'Xabarni biroz batafsilroq yozing.' }, { status: 400 })
  if (image && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 700_000)) {
    image = null
    return NextResponse.json({ error: 'Rasm noto‘g‘ri yoki juda katta.' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  if (!(await rateLimit(supabase, `support:${session.userId}`, 5, 3600))) {
    return NextResponse.json({ error: 'Juda ko‘p xabar yuborildi. Keyinroq urinib ko‘ring.' }, { status: 429 })
  }
  const { data: u } = await supabase.from('users').select('first_name, last_name').eq('id', session.userId).maybeSingle()
  const name = u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : ''
  const { error } = await supabase
    .from('support_messages')
    .insert({ user_id: session.userId, name, contact, message, image })
  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: 'Xabarlar jadvali hali yaratilmagan (schema.sql v62).' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Yuborib bo‘lmadi. Keyinroq urinib ko‘ring.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
