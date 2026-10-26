import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'
import { fetchAll } from '@/lib/db-paginate'
import type { BotAnalyticsData, BotAnswersData } from '@/lib/bot-analytics'
import { verifyTahlilKey } from '@/lib/tahlil-link'
import { TAHLIL_HEADER } from '@/lib/tahlil-link-client'

/**
 * Admin "O'quvchilar tahlili" — Telegram bot results, read from Supabase only.
 * The bot already pushes its SQLite data here every 5 minutes (bot_to_supabase.py),
 * so this page never touches the bot's own server.
 *
 *   GET                → everything the panel needs, in one compact payload (all charts are computed in the browser)
 *   GET ?answers=CODE  → the students' raw answers for one test (for "most common wrong answer")
 *
 * Read-only. Opened from the bot, it is authorised by the signed "x-tahlil-key" header instead of a login.
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

  const [tests, groups, members, assigns, attempts] = await Promise.all([
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
    fetchAll<{ chat_id: number; title: string | null; course_slug: string | null; added_at: string | null }>((from, to) =>
      sb.from('tg_groups').select('chat_id, title, course_slug, added_at').range(from, to),
    ),
    fetchAll<{ chat_id: number; tg_id: number; fullname: string | null; username: string | null; joined_at: string | null }>(
      (from, to) => sb.from('tg_group_members').select('chat_id, tg_id, fullname, username, joined_at').range(from, to),
    ),
    fetchAll<{ bot_code: string; chat_id: number; assigned_at: string | null }>((from, to) =>
      sb.from('group_mock_assignments').select('bot_code, chat_id, assigned_at').range(from, to),
    ),
    fetchAll<{
      id: number
      tg_id: number | null
      chat_id: number | null
      bot_code: string | null
      correct: number | null
      total: number | null
      score_text: string | null
      wrong_nos: number[] | null
      submitted_at: string
    }>((from, to) =>
      sb
        .from('attempt_log')
        .select('id, tg_id, chat_id, bot_code, correct, total, score_text, wrong_nos, submitted_at')
        .eq('source', 'bot')
        .not('bot_code', 'is', null)
        .not('tg_id', 'is', null)
        .order('submitted_at', { ascending: true })
        .range(from, to),
    ),
  ])
  const failed = [tests, groups, members, assigns, attempts].find((r) => r.error)
  if (failed?.error) {
    if (isMissingTable(failed.error)) return NextResponse.json({ missing: true })
    return NextResponse.json({ error: failed.error.message }, { status: 500 })
  }

  // Names: only accounts that appear somewhere on the page.
  const ids = new Set<number>()
  for (const m of members.data) ids.add(m.tg_id)
  for (const a of attempts.data) if (a.tg_id != null) ids.add(a.tg_id)
  const accounts: BotAnalyticsData['accounts'] = {}
  const idList = [...ids]
  for (let i = 0; i < idList.length; i += 300) {
    const { data, error } = await sb
      .from('tg_accounts')
      .select('tg_id, fullname, username, name_set')
      .in('tg_id', idList.slice(i, i + 300))
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
    groups: groups.data.map((g) => ({ chatId: g.chat_id, title: g.title ?? String(g.chat_id), slug: g.course_slug, addedAt: g.added_at })),
    members: members.data.map((m) => ({ chatId: m.chat_id, tg: m.tg_id, n: m.fullname ?? '', u: m.username ?? '', at: m.joined_at })),
    assignments: assigns.data.map((a) => ({ code: a.bot_code, chatId: a.chat_id, at: a.assigned_at })),
    attempts: attempts.data.map((a) => ({
      id: a.id,
      tg: a.tg_id as number,
      chat: a.chat_id,
      code: a.bot_code as string,
      c: a.correct ?? 0,
      t: a.total ?? 0,
      s: a.score_text ?? '',
      w: a.wrong_nos ?? [],
      at: a.submitted_at,
    })),
    accounts,
  }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'private, no-store' } })
}
