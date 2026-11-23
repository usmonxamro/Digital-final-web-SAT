import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'
import { botTestQuestions } from '@/lib/bot-question-map'
import { fetchAll } from '@/lib/db-paginate'
import type { BotAnalyticsData, BotAnswersData } from '@/lib/bot-analytics'
import { verifyTahlilKey } from '@/lib/tahlil-link'
import { TAHLIL_HEADER } from '@/lib/tahlil-link-client'
import { getPayload, getQuestionMap, setPayload, setQuestionMap } from '@/lib/bot-analytics-cache'

/**
 * Admin "O'quvchilar tahlili" — Telegram bot results, read from Supabase only.
 * The bot already pushes its SQLite data here every 5 minutes (bot_to_supabase.py),
 * so this page never touches the bot's own server.
 *
 *   GET                → everything the panel needs, in one compact payload (all charts are computed in the browser)
 *   GET ?answers=CODE  → the students' raw answers for one test (for "most common wrong answer")
 *
 * Read-only. Opened from the bot, it is authorised by the signed "x-tahlil-key" header instead of a login.
 *
 * Speed: archived (finished) groups are skipped entirely — only the students of the active groups are read — and
 * every independent query runs at the same time, so the page costs about three round trips instead of dozens.
 *   GET ?all=1         → include archived groups too
 */
export async function GET(req: NextRequest) {
  // Either a normal admin session (site admin panel) or a signed link from the Telegram bot (/tg-tahlil).
  if (!verifyTahlilKey(req.headers.get(TAHLIL_HEADER))) {
    try {
      await requireAdmin()
    } catch (e) {
      return adminErrorResponse(e)
    }
  }
  const sb = supabaseAdmin()

  const code = req.nextUrl.searchParams.get('answers')
  if (code) {
    const { data, error } = await fetchAll<{ id: number; answers: Record<string, unknown> | null }>((from, to) =>
      sb.from('attempt_log').select('id, answers').eq('source', 'bot').eq('bot_code', code).order('id').range(from, to),
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const out: BotAnswersData = {}
    for (const r of data) {
      const a: Record<string, string> = {}
      for (const [k, v] of Object.entries(r.answers ?? {})) a[k] = v == null ? '' : String(v)
      out[r.id] = a
    }
    return NextResponse.json(out)
  }

  const includeArchived = req.nextUrl.searchParams.get('all') === '1'
  const cached = getPayload(includeArchived ? 'all' : 'active')
  if (cached) return new NextResponse(cached, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } })

  // 1) groups (tiny) → which ones are active
  const groupsRes = await fetchAll<{ chat_id: number; title: string | null; course_slug: string | null; added_at: string | null; archived: boolean | null; archived_at: string | null }>(
    (from, to) => sb.from('tg_groups').select('chat_id, title, course_slug, added_at, archived, archived_at').range(from, to),
  )
  if (groupsRes.error) {
    if (isMissingTable(groupsRes.error)) return NextResponse.json({ missing: true })
    return NextResponse.json({ error: groupsRes.error.message }, { status: 500 })
  }
  const activeGroups = groupsRes.data.filter((g) => includeArchived || !g.archived)
  const activeChats = activeGroups.map((g) => g.chat_id)

  // 2) tests + members + assignments in parallel (members/assignments only of active groups)
  const [tests, members, assigns] = await Promise.all([
    fetchAll<{
      code: string
      name: string | null
      kind: string | null
      level: string | null
      answers: Record<string, unknown> | null
      question_count: number | null
      created_at: string | null
      origin: string | null
    }>((from, to) =>
      sb
        .from('bot_tests')
        .select('code, name, kind, level, answers, question_count, created_at, origin')
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
    activeChats.length
      ? fetchAll<{ chat_id: number; tg_id: number; fullname: string | null; username: string | null; joined_at: string | null }>((from, to) =>
          sb.from('tg_group_members').select('chat_id, tg_id, fullname, username, joined_at').in('chat_id', activeChats).range(from, to),
        )
      : Promise.resolve({ data: [], error: null }),
    activeChats.length
      ? fetchAll<{ bot_code: string; chat_id: number; assigned_at: string | null }>((from, to) =>
          sb.from('group_mock_assignments').select('bot_code, chat_id, assigned_at').in('chat_id', activeChats).range(from, to),
        )
      : Promise.resolve({ data: [], error: null }),
  ])
  const failed = [tests, members, assigns].find((r) => r.error)
  if (failed?.error) {
    if (isMissingTable(failed.error)) return NextResponse.json({ missing: true })
    return NextResponse.json({ error: failed.error.message }, { status: 500 })
  }
  const students = [...new Set(members.data.map((m) => m.tg_id))]

  // 3) attempts of those students (+ anything sent from an active group) and the website attempts, all at once
  type BotRow = {
    id: number
    tg_id: number | null
    chat_id: number | null
    bot_code: string | null
    correct: number | null
    total: number | null
    score_text: string | null
    wrong_nos: number[] | null
    submitted_at: string
  }
  const ATT = 'id, tg_id, chat_id, bot_code, correct, total, score_text, wrong_nos, submitted_at'
  const attemptQueries: Promise<{ data: BotRow[]; error: { message: string } | null }>[] = []
  for (let i = 0; i < students.length; i += 150) {
    const chunk = students.slice(i, i + 150)
    attemptQueries.push(
      fetchAll<BotRow>((from, to) =>
        sb.from('attempt_log').select(ATT).eq('source', 'bot').not('bot_code', 'is', null).in('tg_id', chunk).order('id').range(from, to),
      ),
    )
  }
  if (activeChats.length) {
    attemptQueries.push(
      fetchAll<BotRow>((from, to) =>
        sb.from('attempt_log').select(ATT).eq('source', 'bot').not('bot_code', 'is', null).not('tg_id', 'is', null).in('chat_id', activeChats).order('id').range(from, to),
      ),
    )
  }
  const [attemptResults, webAttempts] = await Promise.all([
    Promise.all(attemptQueries),
    // Site attempts (a mock solved on the website, e.g. from a direct link in the group) count too — for students
    // whose site account is linked to their Telegram (see /api/admin/bot-analytics/links).
    siteAttemptsAsBot(sb, students).catch(() => ({ attempts: [] as BotAnalyticsData['attempts'], linked: new Set<number>() })),
  ])
  const attemptErr = attemptResults.find((r) => r.error)
  if (attemptErr?.error) return NextResponse.json({ error: attemptErr.error.message }, { status: 500 })
  const seen = new Set<number>()
  const botAttempts: BotRow[] = []
  for (const r of attemptResults)
    for (const a of r.data)
      if (!seen.has(a.id)) {
        seen.add(a.id)
        botAttempts.push(a)
      }
  botAttempts.sort((x, y) => x.submitted_at.localeCompare(y.submitted_at))

  // 4) names: only accounts that appear somewhere on the page, in parallel chunks
  const ids = new Set<number>(students)
  for (const a of botAttempts) if (a.tg_id != null) ids.add(a.tg_id)
  for (const a of webAttempts.attempts) ids.add(a.tg)
  const idList = [...ids]
  const accounts: BotAnalyticsData['accounts'] = {}
  const accChunks: number[][] = []
  for (let i = 0; i < idList.length; i += 300) accChunks.push(idList.slice(i, i + 300))
  const accRes = await Promise.all(accChunks.map((c) => sb.from('tg_accounts').select('tg_id, fullname, username, name_set').in('tg_id', c)))
  for (const { data, error } of accRes) {
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const r of data ?? []) accounts[r.tg_id] = { n: r.fullname ?? '', u: r.username ?? '', s: !!r.name_set }
  }

  const out: BotAnalyticsData = {
    generatedAt: new Date().toISOString(),
    tests: tests.data.map((t) => {
      const key: Record<string, string> = {}
      for (const [k, v] of Object.entries(t.answers ?? {})) key[k] = v == null ? '' : String(v)
      return {
        code: t.code,
        name: t.name ?? `Test ${t.code}`,
        kind: t.kind ?? '',
        level: t.level ?? '',
        count: t.question_count ?? Object.keys(key).length,
        createdAt: t.created_at,
        origin: t.origin ?? 'bot',
        key,
      }
    }),
    groups: activeGroups.map((g) => ({ chatId: g.chat_id, title: g.title ?? String(g.chat_id), slug: g.course_slug, addedAt: g.added_at, archived: !!g.archived })),
    members: members.data.map((m) => ({ chatId: m.chat_id, tg: m.tg_id, n: m.fullname ?? '', u: m.username ?? '', at: m.joined_at })),
    assignments: assigns.data.map((a) => ({ code: a.bot_code, chatId: a.chat_id, at: a.assigned_at })),
    attempts: botAttempts
      .map((a) => ({
        id: a.id,
        tg: a.tg_id as number,
        chat: a.chat_id,
        code: a.bot_code as string,
        c: a.correct ?? 0,
        t: a.total ?? 0,
        s: a.score_text ?? '',
        w: a.wrong_nos ?? [],
        at: a.submitted_at,
      }))
      .concat(webAttempts.attempts),
    accounts,
    archived: includeArchived
      ? undefined
      : groupsRes.data.filter((g) => g.archived).map((g) => ({ chatId: g.chat_id, title: g.title ?? String(g.chat_id), archivedAt: g.archived_at })),
    unlinked: students.filter((tg) => !webAttempts.linked.has(tg)).length,
  }
  const body = JSON.stringify(out)
  setPayload(includeArchived ? 'all' : 'active', body)
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } })
}

/**
 * Website attempts → bot-style attempts: site account → Telegram id (tg_accounts.user_id or course_memberships.tg_id),
 * site mock → its bot code (bot_tests.test_label), wrong question ids → the bot's question numbers. chat = null, so the
 * attempt counts for a group only if the student was already a member when he solved it (see BotModel.inGroup) — after
 * moving to a new group an old solve stays with the old group. For "did he do the task" it counts at any time.
 */
async function siteAttemptsAsBot(
  sb: ReturnType<typeof supabaseAdmin>,
  students: number[],
): Promise<{ attempts: BotAnalyticsData['attempts']; linked: Set<number> }> {
  const empty = { attempts: [] as BotAnalyticsData['attempts'], linked: new Set<number>() }
  if (!students.length) return empty
  const chunks: number[][] = []
  for (let i = 0; i < students.length; i += 150) chunks.push(students.slice(i, i + 150))
  const links = await Promise.all(
    chunks.flatMap((c) => [
      sb.from('course_memberships').select('user_id, tg_id').in('tg_id', c),
      sb.from('tg_accounts').select('user_id, tg_id').in('tg_id', c).not('user_id', 'is', null),
    ]),
  )
  const tgOf = new Map<string, number>()
  const linked = new Set<number>()
  for (const { data } of links)
    for (const r of data ?? []) if (r.user_id && r.tg_id) {
      tgOf.set(r.user_id as string, Number(r.tg_id))
      linked.add(Number(r.tg_id))
    }
  if (!tgOf.size) return { attempts: [], linked }
  const users = [...tgOf.keys()]
  const userChunks: string[][] = []
  for (let i = 0; i < users.length; i += 200) userChunks.push(users.slice(i, i + 200))
  type WebRow = { id: number; user_id: string; test_label: string | null; correct: number | null; total: number | null; score_text: string | null; wrong_qids: string[] | null; submitted_at: string }
  const rowSets = await Promise.all(
    userChunks.map((c) =>
      fetchAll<WebRow>((from, to) =>
        sb
          .from('attempt_log')
          .select('id, user_id, test_label, correct, total, score_text, wrong_qids, submitted_at')
          .eq('source', 'web')
          .in('user_id', c)
          .not('test_label', 'is', null)
          .order('id')
          .range(from, to),
      ),
    ),
  )
  const rows = rowSets.flatMap((r) => r.data)
  if (!rows.length) return { attempts: [], linked }
  const labels = [...new Set(rows.map((r) => r.test_label as string))]
  const { data: bt } = await sb.from('bot_tests').select('code, test_label, origin').in('test_label', labels)
  const codeOf = new Map<string, string>()
  // prefer the code the site created (origin 'site'); an older linked bot code otherwise
  for (const b of (bt ?? []).sort((x, y) => (x.origin === 'site' ? 1 : 0) - (y.origin === 'site' ? 1 : 0))) codeOf.set(b.test_label as string, b.code as string)
  const numOf = new Map<string, Map<string, number> | null>()
  await Promise.all(
    [...new Set(codeOf.values())].map(async (code) => {
      const hit = getQuestionMap(code)
      if (hit) return void numOf.set(code, hit.value)
      const m = await botTestQuestions(sb, code).catch(() => null)
      const value = m ? new Map(m.items.map((q) => [q.id as string, q.no])) : null
      setQuestionMap(code, value)
      numOf.set(code, value)
    }),
  )
  const out: BotAnalyticsData['attempts'] = []
  for (const r of rows) {
    const code = codeOf.get(r.test_label as string)
    if (!code) continue
    const nums = numOf.get(code)
    out.push({
      id: -Number(r.id), // negative: never collides with bot attempt ids
      tg: tgOf.get(r.user_id)!,
      chat: null,
      code,
      c: r.correct ?? 0,
      t: r.total ?? 0,
      s: r.score_text ?? '',
      w: nums ? (r.wrong_qids ?? []).map((id) => nums.get(id)).filter((n): n is number => !!n).sort((a, b) => a - b) : [],
      at: r.submitted_at,
      web: true,
    })
  }
  return { attempts: out, linked }
}
