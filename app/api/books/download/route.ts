import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { BOOKS_BUCKET, getAvailableBook } from '@/lib/books'

/**
 * Kitobni yuklab olish — faqat tizimga kirgan (va akkaunti hali mavjud) foydalanuvchiga.
 * To'liq PDF yopiq `books` bucket'da turadi; bu yerdan 60 soniyalik imzolangan havola qaytadi.
 * Mehmonlar uchun hech qanday ochiq havola yo'q.
 */
export async function GET(req: NextRequest) {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) {
    return NextResponse.json({ error: 'Kitobni yuklab olish uchun avval tizimga kiring.', code: 'AUTH' }, { status: 401 })
  }

  const book = getAvailableBook(req.nextUrl.searchParams.get('slug'))
  if (!book) return NextResponse.json({ error: 'Kitob topilmadi.' }, { status: 404 })

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Server sozlanmagan. Keyinroq urinib ko‘ring.' }, { status: 503 })
  }

  // O'chirilgan akkauntning eski cookie'si kitob olmasligi uchun.
  const { data: user } = await supabase.from('users').select('id').eq('id', session.userId).maybeSingle()
  if (!user) return NextResponse.json({ error: 'Akkaunt topilmadi. Qayta kiring.', code: 'AUTH' }, { status: 401 })

  // Bir akkaunt soatiga 10 martagacha (havolani ommaviy tarqatishning oldini oladi).
  const allowed = await rateLimit(supabase, `book:${session.userId}`, 10, 3600)
  if (!allowed) {
    return NextResponse.json({ error: 'Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.' }, { status: 429 })
  }

  const { data: signed, error } = await supabase.storage
    .from(BOOKS_BUCKET)
    .createSignedUrl(book.file, 60, { download: book.downloadName })

  if (error || !signed?.signedUrl) {
    return NextResponse.json(
      { error: 'Kitob fayli hozircha tayyor emas. Iltimos, keyinroq urinib ko‘ring.', code: 'NO_FILE' },
      { status: 404 },
    )
  }

  // Statistika (jadval hali yaratilmagan bo'lsa ham yuklab olish to'xtamaydi).
  await supabase
    .from('book_downloads')
    .insert({ user_id: session.userId, book_slug: book.slug })
    .then(
      () => undefined,
      () => undefined,
    )

  return NextResponse.json({ url: signed.signedUrl, name: book.downloadName })
}
