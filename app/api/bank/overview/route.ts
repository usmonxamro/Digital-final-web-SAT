import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { BANK_SECTIONS } from '@/lib/bank-meta'
import { bankAnswers, bankMeta } from '@/lib/bank-student'

export type BankTopicStat = { code: string; topic: string; total: number; answered: number; correct: number }
export type BankSectionStat = { key: string; total: number; answered: number; correct: number; topics: BankTopicStat[] }

/** The four sections with their topics and the student's progress in each. */
export async function GET() {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })
  const supabase = supabaseAdmin()
  const [meta, answers] = await Promise.all([bankMeta(supabase), bankAnswers(supabase, session.userId)])
  if (!meta) return NextResponse.json({ sections: [] })
  const sections: BankSectionStat[] = BANK_SECTIONS.map((s) => {
    const topics = new Map<string, BankTopicStat>()
    let total = 0
    let answered = 0
    let correct = 0
    for (const r of meta) {
      if (r.domain !== s.domain) continue
      const t = topics.get(r.topic_code) ?? { code: r.topic_code, topic: r.topic, total: 0, answered: 0, correct: 0 }
      t.total++
      total++
      const a = answers.get(r.id)
      if (a !== undefined) {
        t.answered++
        answered++
        if (a) {
          t.correct++
          correct++
        }
      }
      topics.set(r.topic_code, t)
    }
    return { key: s.key, total, answered, correct, topics: [...topics.values()] }
  })
  return NextResponse.json({ sections })
}
