import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { invalidateCounts } from '@/lib/mock-catalog'

/**
 * Delete a whole mock: { testLabel, deleteResults?: boolean }.
 * Removes its questions and settings (video link, schedule, draft flag).
 * Students' past results are kept unless deleteResults is true.
 */
export async function DELETE(req: NextRequest) {
  invalidateCounts()
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const testLabel = typeof body?.testLabel === 'string' ? body.testLabel.trim() : ''
  if (!testLabel) return NextResponse.json({ error: 'Mock nomi kerak.' }, { status: 400 })

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server sozlanmagan.' }, { status: 503 })
  }

  const { error: qErr, count } = await supabase
    .from('questions')
    .delete({ count: 'exact' })
    .eq('test_label', testLabel)
  if (qErr) return NextResponse.json({ error: `Savollarni o'chirishda xatolik: ${qErr.message}` }, { status: 500 })

  const { error: cErr } = await supabase.from('test_configs').delete().eq('test_label', testLabel)
  if (cErr) return NextResponse.json({ error: `Sozlamani o'chirishda xatolik: ${cErr.message}` }, { status: 500 })

  if (body?.deleteResults === true) {
    await supabase.from('test_attempts').delete().eq('test_label', testLabel)
    await supabase.from('mock_starts').delete().eq('test_label', testLabel)
  }
  return NextResponse.json({ ok: true, deletedQuestions: count ?? 0 })
}
