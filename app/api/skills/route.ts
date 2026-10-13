import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { SKILL_DOMAINS } from '@/lib/skill-practice-data'

type ReviewEntry = { domain?: string; correct: boolean; omitted: boolean }

export type SkillStat = {
  domain: string
  correct: number
  total: number
  accuracy: number
}

export async function GET() {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) {
    return NextResponse.json({ skills: [] satisfies SkillStat[] })
  }

  try {
    const supabase = supabaseAdmin()
    const [{ data: attempts }, { data: drills }] = await Promise.all([
      supabase.from('test_attempts').select('review_json').eq('user_id', session.userId),
      supabase.from('skill_drills').select('review_json').eq('user_id', session.userId),
    ])

    const buckets = new Map<string, { correct: number; total: number }>()

    for (const row of [...(attempts ?? []), ...(drills ?? [])]) {
      const review = (row.review_json as ReviewEntry[] | null) ?? []
      for (const item of review) {
        if (item.omitted) continue // omitted questions don't count toward accuracy
        const domain = item.domain?.trim() || 'General'
        const bucket = buckets.get(domain) ?? { correct: 0, total: 0 }
        bucket.total += 1
        if (item.correct) bucket.correct += 1
        buckets.set(domain, bucket)
      }
    }

    for (const domain of SKILL_DOMAINS) {
      if (!buckets.has(domain)) buckets.set(domain, { correct: 0, total: 0 })
    }

    const skills: SkillStat[] = Array.from(buckets.entries())
      .map(([domain, { correct, total }]) => ({
        domain,
        correct,
        total,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy) // weakest (and untested) first

    return NextResponse.json({ skills })
  } catch {
    return NextResponse.json({ skills: [] satisfies SkillStat[] })
  }
}
