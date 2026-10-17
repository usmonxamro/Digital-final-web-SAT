import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { isMissingTable } from '@/lib/db-errors'
import { verifyCourseCode } from '@/lib/course-codes'
import { groupBySlug } from '@/lib/course-groups'
import { groupForJoinCode } from '@/lib/course-group-codes'

/** Student types the code the Telegram bot gave them: POST { code }. */
export async function POST(req: NextRequest) {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Avval tizimga kiring.' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { code?: unknown } | null
  const raw = typeof body?.code === 'string' ? body.code.slice(0, 40) : ''

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Server sozlanmagan.' }, { status: 503 })
  }

  // Guessing codes is pointless, but keep it slow anyway.
  if (!(await rateLimit(supabase, `course-code:${session.userId}`, 10, 600))) {
    return NextResponse.json({ error: "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring." }, { status: 429 })
  }

  // 1) The shared group code the teacher gives to the whole group (NOYABR-XXXXXX). Joining is stored on
  //    the account, so it is asked only once — after that the group stays unlocked.
  const shared = await groupForJoinCode(supabase, raw)
  if (shared === 'missing-table') {
    return NextResponse.json({ error: "Avval Supabase'da v75 SQL'ni ishga tushiring (course_group_codes)." }, { status: 503 })
  }
  if (shared) {
    const title = groupBySlug(shared.slug)?.title ?? shared.slug
    const { data: already } = await supabase
      .from('course_memberships')
      .select('id')
      .eq('user_id', session.userId)
      .eq('group_slug', shared.slug)
      .maybeSingle()
    if (already) return NextResponse.json({ ok: true, group: title, already: true })
    let ins = await supabase.from('course_memberships').insert({ user_id: session.userId, group_slug: shared.slug, joined_via: 'code' })
    // v75 column not there yet → still join, just without the "how" label.
    if (ins.error && /joined_via/i.test(ins.error.message)) {
      ins = await supabase.from('course_memberships').insert({ user_id: session.userId, group_slug: shared.slug })
    }
    if (ins.error && ins.error.code !== '23505') return NextResponse.json({ error: 'Saqlab bo‘lmadi. Qayta urinib ko‘ring.' }, { status: 500 })
    return NextResponse.json({ ok: true, group: title })
  }

  // 2) The older personal code from the Telegram bot.
  if (!process.env.COURSE_CODE_SECRET) {
    return NextResponse.json({ error: 'Kod tizimi hali sozlanmagan (COURSE_CODE_SECRET).' }, { status: 503 })
  }
  const parsed = verifyCourseCode(raw)
  if (!parsed) return NextResponse.json({ error: "Kod noto'g'ri yoki o'chirilgan. Guruhda berilgan kodni aynan shunday kiriting." }, { status: 400 })

  const { data: taken, error } = await supabase
    .from('course_memberships')
    .select('user_id')
    .eq('group_slug', parsed.slug)
    .eq('tg_id', parsed.tgId)
    .maybeSingle()
  if (error) {
    return NextResponse.json(
      { error: isMissingTable(error) ? "Avval Supabase'da v56 SQL'ni ishga tushiring (course_memberships)." : 'Server xatosi.' },
      { status: 503 },
    )
  }
  if (taken && taken.user_id !== session.userId) {
    return NextResponse.json({ error: "Bu kod boshqa akkauntda ishlatilgan. Yordam uchun o'qituvchiga yozing." }, { status: 409 })
  }
  if (!taken) {
    const { error: insErr } = await supabase
      .from('course_memberships')
      .upsert({ user_id: session.userId, group_slug: parsed.slug, tg_id: parsed.tgId }, { onConflict: 'user_id,group_slug' })
    if (insErr) return NextResponse.json({ error: 'Saqlab bo‘lmadi. Qayta urinib ko‘ring.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, group: groupBySlug(parsed.slug)?.title ?? parsed.slug })
}
