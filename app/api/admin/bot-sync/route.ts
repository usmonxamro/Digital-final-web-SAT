import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'
import { fetchAll } from '@/lib/db-paginate'
import { assemblePdfItems } from '@/lib/mock-pdf-items'
import { pushMockToBot } from '@/lib/bot-publish'
import type { Question } from '@/lib/test-data'

export type BotTestRow = {
  code: string
  name: string | null
  kind: string | null
  questionCount: number
  testLabel: string | null
  attempts: number
  students: number
  suggestion: string | null
}
export type SuspectRow = {
  botCode: string
  mockName: string | null
  qNo: number
  keyAnswer: string | null
  attempts: number
  correctPct: number
  topWrongAnswer: string | null
  topWrongPct: number
  flag: string
  testLabel: string | null
}
export type GroupRow = { chatId: number; title: string | null; members: number; assigned: number; doneRate: number | null }
export type BotSyncOverview = {
  tests: BotTestRow[]
  mocks: { label: string; subject: string }[]
  /** Site mocks (not English) that the bot does not have yet. */
  siteOnly: { label: string; subject: string; published: boolean }[]
  suspects: SuspectRow[]
  groups: GroupRow[]
}

export type KeyDiffRow = {
  no: number
  questionId: string
  status: 'same' | 'new' | 'change' | 'mismatch'
  botAnswer: string
  siteAnswer: string | null
}
export type KeyPreview = {
  code: string
  label: string
  botCount: number
  siteCount: number
  rows: KeyDiffRow[]
  patches: { id: string; correct?: string; correctValue?: string }[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Best guess: a site mock whose name contains the bot test's name or vice versa. */
function suggestLabel(name: string | null, code: string, labels: string[]): string | null {
  const keys = [name, code].filter((x): x is string => !!x).map(norm).filter((k) => k.length >= 3)
  for (const label of labels) {
    const l = norm(label)
    if (keys.some((k) => l === k)) return label
  }
  for (const label of labels) {
    const l = norm(label)
    if (keys.some((k) => l.includes(k) || k.includes(l))) return label
  }
  return null
}

async function overview(supabase: SupabaseClient): Promise<BotSyncOverview | { missing: true }> {
  const { data: tests, error } = await supabase
    .from('bot_tests')
    .select('code, name, kind, question_count, test_label')
    .order('created_at', { ascending: false })
  if (error) {
    if (isMissingTable(error)) return { missing: true }
    throw new Error(error.message)
  }

  const { data: cfgs } = await supabase.from('test_configs').select('test_label, subject, published')
  const mocks = (cfgs ?? []).map((c) => ({ label: c.test_label as string, subject: (c.subject as string) ?? 'full' }))
  const linkedLabels = new Set((tests ?? []).map((t) => t.test_label).filter(Boolean))
  const siteOnly = (cfgs ?? [])
    .filter((c) => c.subject !== 'english' && !linkedLabels.has(c.test_label))
    .map((c) => ({ label: c.test_label as string, subject: (c.subject as string) ?? 'full', published: c.published !== false }))
  const labels = mocks.map((m) => m.label)

  const { data: att } = await fetchAll<{ bot_code: string | null; tg_id: number | null }>((from, to) =>
    supabase.from('attempt_log').select('bot_code, tg_id').eq('source', 'bot').not('bot_code', 'is', null).range(from, to),
  )
  const per = new Map<string, { n: number; users: Set<number> }>()
  for (const a of att) {
    if (!a.bot_code) continue
    const e = per.get(a.bot_code) ?? { n: 0, users: new Set<number>() }
    e.n++
    if (a.tg_id != null) e.users.add(a.tg_id)
    per.set(a.bot_code, e)
  }

  const rows: BotTestRow[] = (tests ?? []).map((t) => ({
    code: t.code,
    name: t.name,
    kind: t.kind,
    questionCount: t.question_count ?? 0,
    testLabel: t.test_label ?? null,
    attempts: per.get(t.code)?.n ?? 0,
    students: per.get(t.code)?.users.size ?? 0,
    suggestion: t.test_label ? null : suggestLabel(t.name, t.code, labels),
  }))
  const labelOf = new Map(rows.map((r) => [r.code, r.testLabel]))

  const suspects: SuspectRow[] = []
  {
    const { data, error: e } = await supabase
      .from('v_suspect_keys')
      .select('bot_code, mock_name, q_no, key_answer, attempts, correct_pct, top_wrong_answer, top_wrong_pct, flag')
      .not('flag', 'is', null)
      .order('flag', { ascending: true })
      .order('attempts', { ascending: false })
      .limit(60)
    if (!e) {
      for (const s of data ?? []) {
        suspects.push({
          botCode: s.bot_code,
          mockName: s.mock_name,
          qNo: s.q_no,
          keyAnswer: s.key_answer,
          attempts: s.attempts,
          correctPct: Number(s.correct_pct),
          topWrongAnswer: s.top_wrong_answer,
          topWrongPct: Number(s.top_wrong_pct),
          flag: s.flag,
          testLabel: labelOf.get(s.bot_code) ?? null,
        })
      }
    }
  }

  const groups: GroupRow[] = []
  {
    const { data, error: e } = await supabase.from('v_group_progress').select('chat_id, group_title, tg_id, bot_code, done')
    if (!e && data) {
      const by = new Map<number, { title: string | null; members: Set<number>; codes: Set<string>; done: number; all: number }>()
      for (const r of data) {
        const g = by.get(r.chat_id) ?? { title: r.group_title, members: new Set<number>(), codes: new Set<string>(), done: 0, all: 0 }
        g.members.add(r.tg_id)
        g.codes.add(r.bot_code)
        g.all++
        if (r.done) g.done++
        by.set(r.chat_id, g)
      }
      for (const [chatId, g] of by) {
        groups.push({
          chatId,
          title: g.title,
          members: g.members.size,
          assigned: g.codes.size,
          doneRate: g.all ? Math.round((100 * g.done) / g.all) : null,
        })
      }
      groups.sort((a, b) => b.members - a.members)
    }
  }

  return { tests: rows, mocks, siteOnly, suspects, groups }
}

async function previewKeys(supabase: SupabaseClient, code: string, label: string): Promise<KeyPreview | { error: string }> {
  const { data: bt } = await supabase.from('bot_tests').select('code, answers, question_count').eq('code', code).maybeSingle()
  if (!bt) return { error: 'Bot testi topilmadi.' }
  const botAnswers = (bt.answers ?? {}) as Record<string, unknown>

  const { data: cfg } = await supabase.from('test_configs').select('subject, placement, scored, math_layout').eq('test_label', label).maybeSingle()
  if (!cfg) return { error: 'Saytda bunday mock yo\'q.' }

  type Row = { id: string; type: string | null; correct: string | null; correct_value: string | null; kind: string; module_number: number | null }
  const byId = new Map<string, Row>()
  const load = async (kind: 'reading' | 'math'): Promise<Question[]> => {
    const { data } = await supabase
      .from('questions')
      .select('id, type, correct, correct_value, kind, module_number')
      .eq('kind', kind)
      .eq('test_label', label)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    return (data ?? []).map((r: Row) => {
      byId.set(r.id, r)
      return {
        id: r.id,
        type: (r.type as Question['type']) ?? 'mcq',
        prompt: '',
        moduleNumber: r.module_number === 1 || r.module_number === 2 ? r.module_number : undefined,
      } as Question
    })
  }
  const [reading, math] = await Promise.all([load('reading'), load('math')])
  const items = await assemblePdfItems(
    { subject: cfg.subject, placement: cfg.placement, scored: cfg.scored, mathLayout: cfg.math_layout },
    async (kind) => (kind === 'math' ? math : reading),
  )

  const botCount = Object.keys(botAnswers).filter((k) => /^\d+$/.test(k)).length
  if (items.length !== botCount) {
    return {
      error: `Savollar soni mos emas: botda ${botCount} ta javob, saytdagi "${label}" mockida ${items.length} ta savol. Avval mockdagi savollar sonini tekshiring.`,
    }
  }

  const rows: KeyDiffRow[] = []
  const patches: KeyPreview['patches'] = []
  items.forEach((it, i) => {
    const row = byId.get(it.question.id as string)
    if (!row) return
    const no = i + 1
    const botAnswer = String(botAnswers[String(no)] ?? '').trim()
    const isMcq = (row.type ?? 'mcq') === 'mcq'
    const siteAnswer = isMcq ? row.correct : row.correct_value
    const ok = isMcq ? /^[ABCD]$/i.test(botAnswer) : botAnswer !== '' && !/^[ABCD]$/i.test(botAnswer)
    if (!ok) {
      rows.push({ no, questionId: row.id, status: 'mismatch', botAnswer, siteAnswer: siteAnswer ?? null })
      return
    }
    const next = isMcq ? botAnswer.toUpperCase() : botAnswer
    const status: KeyDiffRow['status'] = siteAnswer == null || siteAnswer === '' ? 'new' : siteAnswer === next ? 'same' : 'change'
    rows.push({ no, questionId: row.id, status, botAnswer: next, siteAnswer: siteAnswer ?? null })
    if (status !== 'same') patches.push(isMcq ? { id: row.id, correct: next } : { id: row.id, correctValue: next })
  })
  return { code, label, botCount, siteCount: items.length, rows, patches }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  try {
    if (req.nextUrl.searchParams.get('light')) {
      // Just the list of bot tests (name, code, question count, linked site mock) for the "Botdan tanlash" picker.
      const { data, error } = await supabaseAdmin()
        .from('bot_tests')
        .select('code, name, kind, question_count, test_label')
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({
        tests: (data ?? []).map((t) => ({ code: t.code, name: t.name, kind: t.kind, questionCount: t.question_count ?? 0, testLabel: t.test_label ?? null })),
      })
    }
    const out = await overview(supabaseAdmin())
    if ('missing' in out) {
      return NextResponse.json({ error: "Bot jadvallari yo'q. Avval v94 SQL'ni Supabase'da ishga tushiring." }, { status: 404 })
    }
    return NextResponse.json(out)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server xatosi.' }, { status: 500 })
  }
}

/**
 * POST { action: 'preview', code, label } → what the bot's answer key would change on the site mock.
 * POST { action: 'link', code, label }    → remember that bot test <code> is site mock <label> (stats merge).
 * POST { action: 'unlink', code }         → undo the link.
 * The key itself is saved by the client through /api/admin/questions/batch-answers (which also re-scores attempts).
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const action = body?.action as string | undefined
  const code = typeof body?.code === 'string' ? body.code : ''
  const label = typeof body?.label === 'string' ? body.label.trim() : ''
  if (!code && action !== 'to_bot') return NextResponse.json({ error: "'code' kerak." }, { status: 400 })
  const supabase = supabaseAdmin()

  if (action === 'preview') {
    if (!label) return NextResponse.json({ error: "'label' kerak." }, { status: 400 })
    const out = await previewKeys(supabase, code, label)
    return 'error' in out ? NextResponse.json(out, { status: 400 }) : NextResponse.json(out)
  }
  if (action === 'to_bot') {
    if (!label) return NextResponse.json({ error: "'label' kerak." }, { status: 400 })
    return NextResponse.json(await pushMockToBot(supabase, label))
  }
  if (action === 'link' || action === 'unlink') {
    if (action === 'link' && !label) return NextResponse.json({ error: "'label' kerak." }, { status: 400 })
    const { error } = await supabase
      .from('bot_tests')
      .update({ test_label: action === 'link' ? label : null })
      .eq('code', code)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: "Noma'lum amal." }, { status: 400 })
}
