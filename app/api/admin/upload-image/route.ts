import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'


const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Fayl topilmadi.' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Faqat PNG, JPEG, WEBP, GIF yoki SVG fayllar qabul qilinadi.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fayl hajmi 5 MB dan oshmasligi kerak." }, { status: 400 })
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server sozlanmagan.' },
      { status: 503 },
    )
  }

  // Extension from the checked MIME type — never from the user's file name.
  const EXT: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  }
  const ext = EXT[file.type] ?? 'png'
  const path = `${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error } = await supabase.storage.from('question-images').upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    return NextResponse.json(
      { error: `Yuklashda xatolik: ${error.message}. "question-images" bucket mavjudligini tekshiring (supabase/schema.sql).` },
      { status: 500 },
    )
  }

  const { data: publicUrl } = supabase.storage.from('question-images').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl.publicUrl })
}
