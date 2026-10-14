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
    // The independent look-ups run side by side (they used to run one after another: each exam load
    // paid ~6 database round trips PER request, and the exam sent 4 requests).
    const [, gateAdmin, ident] = await Promise.all([
      releaseDueMocks(supabase),
      requireAdmin().then(() => true).catch(() => false),
      adminIdentity().catch(() => null),
    ])
    const isAdmin = gateAdmin || !!ident

    // Access rules — questions are never public:
    //  - admins (with the access code entered) always get them (preview);
    //  - students must be logged in AND have started this exact test in the
    //    last 6 hours (/api/exam/start, which enforces the daily limits);
    //  - drafts are admin-only.
    // Owner / admins: no start or limit needed. Drafts still need the admin code.
    let session: ReturnType<typeof verifySession> = null
    if (!isAdmin) {
      const cookieStore = await cookies()
      session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
      if (!session) return NextResponse.json({ questions: [] as Question[] }, { status: 401 })
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
    // ?module=1|2 → only that module's own rows. Without it ALL rows of the test come back, each with its
    // `moduleNumber`, and the exam splits them itself (one request per section instead of two).
    if (moduleParam === '1' || moduleParam === '2') {
      query = query.eq('module_number', Number(moduleParam))
    }

    // Start the question query right away; the draft/started checks run beside it, and the rows are
    // only returned once those checks pass.
    const rowsPromise = Promise.resolve(query)
    const cfgPromise = test
      ? Promise.resolve(supabase.from('test_configs').select('*').eq('test_label', test).maybeSingle())
      : Promise.resolve({ data: null })
    let startsPromise: Promise<{ data: { id: string }[] | null; error: unknown }> | null = null
    if (!isAdmin && session) {
      const since = new Date(Date.now() - 6 * 3600_000).toISOString()
      startsPromise = Promise.resolve(
        supabase
          .from('mock_starts')
          .select('id')
          .eq('user_id', session.userId)
          .eq('test_label', test ?? '')
          .gte('started_at', since)
          .limit(1),
      ) as Promise<{ data: { id: string }[] | null; error: unknown }>
    }
    const [{ data: cfg }, startsRes] = await Promise.all([cfgPromise, startsPromise ?? Promise.resolve(null)])
    if (test && cfg && cfg.published === false && !gateAdmin) {
      return NextResponse.json({ questions: [] as Question[] })
    }
    if (startsRes && !startsRes.error && (startsRes.data ?? []).length === 0) {
      // (If the v38 table doesn't exist yet, error is set → allow.)
      return NextResponse.json({ questions: [] as Question[] }, { status: 403 })
    }
    const { data } = await rowsPromise

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
      moduleNumber: row.module_number === 1 || row.module_number === 2 ? row.module_number : undefined,
    }))

    return NextResponse.json({ questions })
  } catch {
    // Not configured yet, or a transient error — the exam falls back to the
    // built-in question pool, so this must never break the page.
    return NextResponse.json({ questions: [] as Question[] })
  }
}
