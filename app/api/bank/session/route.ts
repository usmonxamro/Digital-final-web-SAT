import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sectionByKey } from '@/lib/bank-meta'
import { bankAnswers, bankMeta } from '@/lib/bank-student'

const shuffle = <T,>(a: T[]) => {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

/**
 * GET ?section=algebra&topic=LF&difficulty=Hard&n=10 → a practice set WITHOUT answers.
 * Order: questions the student has not seen, then the ones answered wrongly, then the rest.
 */
export async function GET(req: NextRequest) {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const section = sectionByKey(sp.get('section') ?? '')
  if (!section) return NextResponse.json({ error: "Bo'lim topilmadi." }, { status: 404 })
  const n = Math.min(30, Math.max(5, Number(sp.get('n')) || 10))
  const topic = sp.get('topic') || ''
  const diff = sp.get('difficulty') || ''

  const supabase = supabaseAdmin()
  const [meta, answers] = await Promise.all([bankMeta(supabase), bankAnswers(supabase, session.userId)])
  if (!meta) return NextResponse.json({ questions: [] })
  const pool = meta.filter((r) => r.domain === section.domain && (!topic || r.topic_code === topic) && (!diff || r.difficulty === diff))
  const unseen = shuffle(pool.filter((r) => !answers.has(r.id)))
  const wrong = shuffle(pool.filter((r) => answers.get(r.id) === false))
  const right = shuffle(pool.filter((r) => answers.get(r.id) === true))
  const ids = [...unseen, ...wrong, ...right].slice(0, n).map((r) => r.id)
  if (ids.length === 0) return NextResponse.json({ questions: [], poolSize: pool.length })

  const { data, error } = await supabase
    .from('question_bank')
    .select('id, type, difficulty, topic_code, topic, prompt, equations, image, choices')
    .in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const byId = new Map((data ?? []).map((r) => [r.id as string, r]))
  const questions = ids.map((id) => byId.get(id)).filter(Boolean)
  return NextResponse.json({ questions, poolSize: pool.length, unseen: unseen.length })
}
