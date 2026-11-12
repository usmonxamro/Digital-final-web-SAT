import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { requireAdmin } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { cleanVocab, type VocabEntry } from '@/lib/question-vocab'

/**
 * Vocabulary of one mock: `{ vocab: { [questionId]: VocabEntry[] } }`.
 * Only for a student who FINISHED this mock (same rule as the PDF) or an admin. It is a separate, tiny request made
 * after the exam (never part of the exam payload), and the browser keeps it for an hour — the exam itself stays light.
 */
export async function GET(req: NextRequest) {
  const label = req.nextUrl.searchParams.get('label')?.trim()
  if (!label) return NextResponse.json({ vocab: {} })

  const isAdmin = await requireAdmin().then(() => true).catch(() => false)
  const session = isAdmin ? null : verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!isAdmin && !session) return NextResponse.json({ vocab: {} }, { status: 401 })

  try {
    const supabase = supabaseAdmin()
    if (session) {
      const { data: done } = await supabase
        .from('mock_starts')
        .select('id')
        .eq('user_id', session.userId)
        .eq('test_label', label)
        .not('graded_at', 'is', null)
        .limit(1)
      if (!done || done.length === 0) return NextResponse.json({ vocab: {} }, { status: 403 })
    }
    const { data, error } = await supabase.from('questions').select('id, vocab').eq('test_label', label).not('vocab', 'is', null)
    if (error) return NextResponse.json({ vocab: {} }) // column not created yet (v114) → simply no vocabulary
    const vocab: Record<string, VocabEntry[]> = {}
    for (const row of data ?? []) {
      const list = cleanVocab(row.vocab)
      if (list.length) vocab[String(row.id)] = list
    }
    return NextResponse.json({ vocab }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
  } catch {
    return NextResponse.json({ vocab: {} })
  }
}
