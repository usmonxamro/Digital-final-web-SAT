import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function currentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  return session?.userId ?? null
}

/** One result the student sent to the Telegram bot. */
export type BotResult = { code: string; name: string; siteLabel: string | null; correct: number; total: number; score: string | null; at: string }

// Results are saved only by /api/exam/grade, which computes the score on the
// server — the old "browser sends its own score" POST was removed (forgeable).

export async function GET() {
  const userId = await currentUserId()
  if (!userId) {
    return NextResponse.json({ attempts: [] })
  }

  try {
    const supabase = supabaseAdmin()
    const { data } = await supabase
      .from('test_attempts')
      .select('id, test_label, subject, rw_scaled, math_scaled, composite, correct_count, incorrect_count, omitted_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Results sent to the Telegram bot by this student's linked Telegram account(s) (best-effort: needs the v94 tables).
    let bot: BotResult[] = []
    try {
      const { data: accs } = await supabase.from('tg_accounts').select('tg_id').eq('user_id', userId)
      const ids = (accs ?? []).map((a) => a.tg_id)
      if (ids.length) {
        const { data: rows } = await supabase
          .from('attempt_log')
          .select('bot_code, correct, total, score_text, submitted_at, bot_tests(name, test_label)')
          .eq('source', 'bot')
          .in('tg_id', ids)
          .order('submitted_at', { ascending: false })
          .limit(500)
        bot = (rows ?? []).map((r) => {
          const bt = (Array.isArray(r.bot_tests) ? r.bot_tests[0] : r.bot_tests) as { name?: string; test_label?: string | null } | null
          return {
            code: r.bot_code ?? '',
            name: bt?.name ?? r.bot_code ?? '',
            siteLabel: bt?.test_label ?? null,
            correct: r.correct ?? 0,
            total: r.total ?? 0,
            score: r.score_text ?? null,
            at: r.submitted_at,
          }
        })
      }
    } catch {
      /* bot tables not there yet */
    }

    return NextResponse.json({ attempts: data ?? [], bot })
  } catch {
    return NextResponse.json({ attempts: [] })
  }
}
