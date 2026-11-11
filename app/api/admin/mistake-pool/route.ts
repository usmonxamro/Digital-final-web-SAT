import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { buildMistakePool } from '@/lib/mistake-pool'

const cache = new Map<string, { at: number; body: unknown }>()

/**
 * «Xatolar bazasi»: GET ?chat=&days=&min= → question families sorted by how often they were answered wrong
 * (bot + site), each with its text and twins. chat = Telegram group, days = only the last N days.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const sp = req.nextUrl.searchParams
  const chat = sp.get('chat') ? Number(sp.get('chat')) : null
  const days = Number(sp.get('days') ?? 0)
  const min = Number(sp.get('min') ?? 1)
  const key = `${chat}|${days}|${min}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 60_000 && !sp.get('fresh')) return NextResponse.json(hit.body)
  try {
    const since = days > 0 ? new Date(Date.now() - days * 86400_000).toISOString() : null
    const res = await buildMistakePool(supabaseAdmin(), { chat: Number.isFinite(chat as number) ? chat : null, since, minMisses: min, limit: 400 })
    const { data: groups } = await supabaseAdmin().from('tg_groups').select('chat_id, title').order('added_at', { ascending: false })
    const body = { ...res, groups: (groups ?? []).map((g) => ({ chatId: Number(g.chat_id), title: g.title as string })), generatedAt: new Date().toISOString() }
    cache.set(key, { at: Date.now(), body })
    return NextResponse.json(body)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Xatolik' }, { status: 500 })
  }
}
