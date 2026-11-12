import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { band, isLang, score, type KeyRow } from '@/lib/daraja/scoring'
import { PREPS, type Prep } from '@/lib/daraja/types'

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const { lang, prep, answers } = body ?? {}
  if (!isLang(lang) || !PREPS.includes(prep) || typeof answers !== 'object' || !answers) {
    return NextResponse.json({ error: 'bad input' }, { status: 400 })
  }
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
    if (/^[12]-\d{1,2}$/.test(k) && typeof v === 'string') clean[k] = v.slice(0, 20)
  }
  const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)
  try {
    const supabase = supabaseAdmin()
    if (!(await rateLimit(supabase, `daraja:${clientIp(req)}`, 12, 3600))) {
      return NextResponse.json({ error: 'rate' }, { status: 429 })
    }
    const { data: keys, error } = await supabase.from('daraja_keys').select('*')
    if (error || !keys?.length) return NextResponse.json({ error: 'keys' }, { status: 500 })
    const r = score(keys as KeyRow[], clean, prep as Prep)
    await supabase.from('daraja_attempts').insert({
      lang, prep, name: str(body.name, 80), contact: str(body.contact, 80),
      correct_count: r.correct, total: r.total, adjusted_raw44: r.raw44, scaled: r.scaled,
      detail: { answers: clean, domains: r.domains },
    })
    return NextResponse.json({
      correct: r.correct, total: r.total, scaled: r.scaled, band: band(r.scaled), relaxed: r.relaxed,
      detail: r.detail, domains: r.domains,
    })
  } catch {
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
