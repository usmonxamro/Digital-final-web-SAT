import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'
import { scanVocab } from '@/lib/vocab-scan'
import { bustVocabCache, NO_VOCAB_TABLE } from '@/lib/vocab-server'

export const maxDuration = 60

/** POST → mock savollarini skanerlaydi: so'zlarga misol gaplar topadi va tarjima kutayotgan yangi so'zlarni ro'yxatga qo'shadi. */
export async function POST() {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  try {
    const result = await scanVocab(supabaseAdmin())
    bustVocabCache()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (isMissingTable(e as { code?: string; message?: string })) return NextResponse.json({ error: NO_VOCAB_TABLE }, { status: 503 })
    return NextResponse.json({ error: "Skanerlab bo'lmadi." }, { status: 500 })
  }
}
