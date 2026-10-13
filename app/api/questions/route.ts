import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { adminIdentity, requireAdmin } from '@/lib/admin-auth'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { releaseDueMocks } from '@/lib/schedule'
import type { Question } from '@/lib/test-data'

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind')
  const test = req.nextUrl.searchParams.get('test')
  const moduleParam = req.nextUrl.searchParams.get('module')
  if (kind !== 'reading' && kind !== 'math') {
    return NextResponse.json({ questions: [] as Question[] })
  }

  try {
    const supabase = supabaseAdmin()
    await releaseDueMocks(supabase)

    // Access rules — questions are never public:
    //  - admins (with the access code entered) always get them (preview);
    //  - students must be logged in AND have started this exact test in the
    //    last 6 hours (/api/exam/start, which enforces the daily limits);
    //  - drafts are admin-only.
    // Owner / admins: no start or limit needed. Drafts still need the admin code.
    const gateAdmin = await requireAdmin().then(() => true).catch(() => false)
    const isAdmin = gateAdmin || !!(await adminIdentity().catch(() => null))
    if (test && isAdmin && !gateAdmin) {
      const { data: cfg } = await supabase.from('test_configs').select('*').eq('test_label', test).maybeSingle()
      if (cfg && cfg.published === false) return NextResponse.json({ questions: [] as Question[] })
    }
    if (!isAdmin) {
      const cookieStore = await cookies()
      const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
      if (!session) return NextResponse.json({ questions: [] as Question[] }, { status: 401 })

      if (test) {
        const { data: cfg } = await supabase.from('test_configs').select('*').eq('test_label', test).maybeSingle()
        if (cfg && cfg.published === false) return NextResponse.json({ questions: [] as Question[] })
      }
      const since = new Date(Date.now() - 6 * 3600_000).toISOString()
      const { data: starts, error: startsError } = await supabase
        .from('mock_starts')
        .select('id')
        .eq('user_id', session.userId)
        .eq('test_label', test ?? '')
        .gte('started_at', since)
        .limit(1)
      // (If the v38 table doesn't exist yet, startsError is set → allow.)
      if (!startsError && (starts ?? []).length === 0) {
        return NextResponse.json({ questions: [] as Question[] }, { status: 403 })
      }
    }

    // Ordered by insertion so that a legacy test (imported before the
    // module_number column existed) still splits into a stable Module 1 /
    // Module 2 on the client via splitHalves — Postgres never guarantees
    // row order without an explicit sort.
    let query = supabase
      .from('questions')
      .select('*')
      .eq('kind', kind)
      .order('created_at', { ascending: true })
      // Deterministic tie-break (legacy tests were inserted with identical
      // timestamps) so admin and exam always agree on question order.
      .order('id', { ascending: true })
    // No ?test= → general skill-bank pool (feeds the skill drills).
    // ?test=<label> → only that dedicated full mock test's own questions.
    query = test ? query.eq('test_label', test) : query.is('test_label', null)
    // ?module=1|2 → only that module's own rows (the modern, stable path
    // for tests imported through the admin panel's per-module import).
    if (moduleParam === '1' || moduleParam === '2') {
      query = query.eq('module_number', Number(moduleParam))
    }
    const { data } = await query

    const questions: Question[] = (data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      difficulty: row.difficulty ?? undefined,
      domain: row.domain ?? undefined,
      passage: row.passage ?? undefined,
      underline: row.underline ?? undefined,
      prompt: row.prompt,
      equations: row.equations ?? undefined,
      image: row.image ?? undefined,
      choices: row.choices ?? undefined,
      // NO answer key / explanation here — anyone can read this response in
      // the browser. Keys come back only from /api/exam/grade after submitting.
      layout: row.layout ?? undefined,
    }))

    return NextResponse.json({ questions })
  } catch {
    // Not configured yet, or a transient error — the exam falls back to the
    // built-in question pool, so this must never break the page.
    return NextResponse.json({ questions: [] as Question[] })
  }
}
