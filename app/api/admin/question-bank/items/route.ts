import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { fetchAll } from '@/lib/db-paginate'

const PAGE = 20

export type BankRow = {
  id: string
  source_id: string
  domain: string
  topic: string
  topic_code: string
  number: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  type: 'mcq' | 'gridin'
  prompt: string
  equations: string[] | null
  image: string | null
  choices: { id: string; text?: string; tex?: string; image?: string }[] | null
  correct: string | null
  correct_value: string | null
  explanation: string | null
  needs_check: boolean
  note: string | null
}

/** GET ?domain=&topic=&difficulty=&needsCheck=1&q=&page=0 → one page of bank questions + the filter facets. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const sp = req.nextUrl.searchParams
  const supabase = supabaseAdmin()
  const page = Math.max(0, Number(sp.get('page')) || 0)

  let q = supabase.from('question_bank').select('*', { count: 'exact' })
  if (sp.get('domain')) q = q.eq('domain', sp.get('domain')!)
  if (sp.get('topic')) q = q.eq('topic_code', sp.get('topic')!)
  if (sp.get('difficulty')) q = q.eq('difficulty', sp.get('difficulty')!)
  if (sp.get('needsCheck') === '1') q = q.eq('needs_check', true)
  const text = (sp.get('q') ?? '').trim().replace(/[%,()]/g, ' ').slice(0, 80)
  if (text) q = q.or(`prompt.ilike.%${text}%,source_id.eq.${text.replace(/\s/g, '')}`)
  const { data, count, error } = await q
    .order('domain')
    .order('topic_code')
    .order('number')
    .range(page * PAGE, page * PAGE + PAGE - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Facets for the filters (the whole bank is only ~2000 small rows).
  const meta = await fetchAll<{ domain: string; topic: string; topic_code: string; needs_check: boolean }>((from, to) =>
    supabase.from('question_bank').select('domain, topic, topic_code, needs_check').order('id').range(from, to),
  )
  const topics: Record<string, { code: string; topic: string; count: number }[]> = {}
  const seen = new Map<string, { code: string; topic: string; count: number }>()
  let needsCheck = 0
  for (const r of meta.data) {
    if (r.needs_check) needsCheck++
    const k = `${r.domain}|${r.topic_code}`
    let t = seen.get(k)
    if (!t) {
      t = { code: r.topic_code, topic: r.topic, count: 0 }
      seen.set(k, t)
      ;(topics[r.domain] ??= []).push(t)
    }
    t.count++
  }
  return NextResponse.json({ rows: data as BankRow[], total: count ?? 0, pageSize: PAGE, topics, needsCheck, bankTotal: meta.data.length })
}
