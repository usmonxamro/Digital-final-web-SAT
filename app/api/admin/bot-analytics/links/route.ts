import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminErrorResponse } from '@/lib/admin-errors'
import { requireTahlilAccess } from '@/lib/tahlil-auth'
import { clearPayloads } from '@/lib/bot-analytics-cache'
import { fetchAll } from '@/lib/db-paginate'
import { likeEscape } from '@/lib/email'

/**
 * "Sayt ↔ Telegram" links. A mock solved on the website only counts for a Telegram student after his site account
 * is linked to his Telegram id (tg_accounts.user_id). Students normally get linked with the course code; this lets the
 * admin finish the rest in one tap.
 *
 *   GET            → active-group students without a link, each with the most likely site accounts (by name)
 *   GET ?q=ali     → site accounts matching a name / phone (manual search)
 *   POST { pairs: [{ tgId, userId }] }  → link (userId = null unlinks)
 */

type Suggest = { userId: string; name: string; phone4: string; web: number; score: number }
type Row = { tg: number; name: string; username: string; groups: string[]; suggestions: Suggest[] }

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ’‘`´']/g, '')
    .replace(/[^a-z0-9а-яё\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const tokens = (s: string) => norm(s).split(' ').filter((t) => t.length > 1)

/** 0..1: same words in any order = 1; shared words / all words otherwise (a first-letter match counts half). */
function nameScore(a: string, b: string): number {
  const x = tokens(a)
  const y = tokens(b)
  if (!x.length || !y.length) return 0
  const used = new Set<number>()
  let hit = 0
  for (const t of x) {
    let j = y.findIndex((u, i) => !used.has(i) && u === t)
    if (j >= 0) {
      used.add(j)
      hit += 1
      continue
    }
    j = y.findIndex((u, i) => !used.has(i) && (u.startsWith(t) || t.startsWith(u)) && Math.min(u.length, t.length) >= 3)
    if (j >= 0) {
      used.add(j)
      hit += 0.7
    }
  }
  return hit / Math.max(x.length, y.length)
}

export async function GET(req: NextRequest) {
  try {
    await requireTahlilAccess(req)
  } catch (e) {
    return adminErrorResponse(e)
  }
  const sb = supabaseAdmin()

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (q) {
    const like = `%${likeEscape(q)}%`
    const digits = q.replace(/\D/g, '')
    const filters = [`first_name.ilike.${like}`, `last_name.ilike.${like}`]
    if (digits.length >= 4) filters.push(`phone_digits.ilike.%${digits}%`)
    const { data, error } = await sb.from('users').select('id, first_name, last_name, phone').or(filters.join(',')).limit(15)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      users: (data ?? []).map((u) => ({ userId: u.id, name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(), phone4: String(u.phone ?? '').replace(/\D/g, '').slice(-4) })),
    })
  }

  const groups = await fetchAll<{ chat_id: number; title: string | null }>((from, to) =>
    sb.from('tg_groups').select('chat_id, title').eq('archived', false).range(from, to),
  )
  if (groups.error) return NextResponse.json({ error: groups.error.message }, { status: 500 })
  const chats = groups.data.map((g) => g.chat_id)
  if (!chats.length) return NextResponse.json({ rows: [], linked: 0 })
  const title = new Map(groups.data.map((g) => [g.chat_id, g.title ?? String(g.chat_id)]))

  const [mem, users, webRows, accs, cms] = await Promise.all([
    fetchAll<{ chat_id: number; tg_id: number; fullname: string | null; username: string | null }>((from, to) =>
      sb.from('tg_group_members').select('chat_id, tg_id, fullname, username').in('chat_id', chats).range(from, to),
    ),
    fetchAll<{ id: string; first_name: string | null; last_name: string | null; phone: string | null }>((from, to) =>
      sb.from('users').select('id, first_name, last_name, phone').order('id').range(from, to),
    ),
    fetchAll<{ user_id: string }>((from, to) => sb.from('attempt_log').select('user_id').eq('source', 'web').not('user_id', 'is', null).order('id').range(from, to)),
    fetchAll<{ tg_id: number; user_id: string | null; fullname: string | null; name_set: boolean | null }>((from, to) =>
      sb.from('tg_accounts').select('tg_id, user_id, fullname, name_set').order('tg_id').range(from, to),
    ),
    fetchAll<{ tg_id: number | null }>((from, to) => sb.from('course_memberships').select('tg_id').not('tg_id', 'is', null).range(from, to)),
  ])
  const err = [mem, users, webRows, accs, cms].find((r) => r.error)
  if (err?.error) return NextResponse.json({ error: err.error.message }, { status: 500 })

  const web = new Map<string, number>()
  for (const r of webRows.data) web.set(r.user_id, (web.get(r.user_id) ?? 0) + 1)
  const taken = new Set(accs.data.filter((a) => a.user_id).map((a) => a.user_id as string))
  const linkedTg = new Set<number>([...accs.data.filter((a) => a.user_id).map((a) => a.tg_id), ...cms.data.map((c) => Number(c.tg_id))])
  const realName = new Map(accs.data.map((a) => [a.tg_id, a.name_set && a.fullname ? a.fullname : '']))

  const byTg = new Map<number, Row>()
  for (const m of mem.data) {
    if (linkedTg.has(m.tg_id)) continue
    const r = byTg.get(m.tg_id) ?? { tg: m.tg_id, name: realName.get(m.tg_id) || m.fullname || '', username: m.username ?? '', groups: [], suggestions: [] }
    r.groups.push(title.get(m.chat_id) ?? '')
    byTg.set(m.tg_id, r)
  }
  const pool = users.data
    .filter((u) => !taken.has(u.id))
    .map((u) => ({ userId: u.id, name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(), phone4: String(u.phone ?? '').replace(/\D/g, '').slice(-4), web: web.get(u.id) ?? 0 }))
  for (const r of byTg.values()) {
    r.suggestions = pool
      .map((u) => ({ ...u, score: Math.max(nameScore(r.name, u.name), r.username ? nameScore(r.username, u.name) * 0.6 : 0) }))
      .filter((u) => u.score >= 0.6)
      .sort((a, b) => b.score - a.score || b.web - a.web)
      .slice(0, 3)
  }
  const rows = [...byTg.values()].sort((a, b) => (b.suggestions[0]?.score ?? 0) - (a.suggestions[0]?.score ?? 0) || a.name.localeCompare(b.name))
  return NextResponse.json({ rows, linked: linkedTg.size })
}

export async function POST(req: NextRequest) {
  try {
    await requireTahlilAccess(req)
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as { pairs?: { tgId: number; userId: string | null }[] } | null
  const pairs = (body?.pairs ?? []).filter((p) => Number.isSafeInteger(Number(p?.tgId)) && (p.userId === null || typeof p.userId === 'string')).slice(0, 200)
  if (!pairs.length) return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  const sb = supabaseAdmin()
  let done = 0
  const failed: { tgId: number; error: string }[] = []
  for (const p of pairs) {
    const { data, error } = await sb.from('tg_accounts').update({ user_id: p.userId }).eq('tg_id', Number(p.tgId)).select('tg_id')
    if (error) failed.push({ tgId: Number(p.tgId), error: /duplicate|unique/i.test(error.message) ? 'Bu sayt akkaunti boshqa Telegram bilan bog‘langan.' : error.message })
    else if (!data?.length) failed.push({ tgId: Number(p.tgId), error: 'Telegram akkaunt topilmadi.' })
    else done++
  }
  clearPayloads()
  return NextResponse.json({ ok: failed.length === 0, done, failed })
}
