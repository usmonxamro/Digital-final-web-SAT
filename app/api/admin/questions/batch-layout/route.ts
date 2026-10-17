import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingColumn, MIGRATION_HINT } from '@/lib/db-columns'
import { sanitizeLayout, type QuestionLayout } from '@/lib/question-layout'
import { invalidateCounts } from '@/lib/mock-catalog'

type Item = { id: string; prompt: string; layout: QuestionLayout | null }

function parseItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.prompt !== 'string' || !r.prompt.trim()) return null
  const layout = sanitizeLayout(r.layout)
  if (layout === undefined) return null
  return { id: r.id, prompt: r.prompt, layout }
}

/**
 * Saves the block arrangements made in the exam preview ("Check it now"):
 * { items: [{ id, prompt, layout }] } — prompt and layout travel together
 * because the layout's p0..pn ids are the prompt's chunks.
 */
export async function POST(req: NextRequest) {
  invalidateCounts()
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }

  const body = await req.json().catch(() => null)
  const rawItems: unknown = body?.items
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "'items' bo'sh bo'lmasligi kerak." }, { status: 400 })
  }
  const items: Item[] = []
  for (const raw of rawItems) {
    const it = parseItem(raw)
    if (!it) return NextResponse.json({ error: "Noto'g'ri formatdagi yozuv." }, { status: 400 })
    items.push(it)
  }

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server sozlanmagan.' }, { status: 503 })
  }

  const results = await Promise.all(
    items.map((it) => supabase.from('questions').update({ prompt: it.prompt, layout: it.layout }).eq('id', it.id)),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) {
    if (isMissingColumn(failed.error, 'layout')) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    return NextResponse.json({ error: `Saqlashda xatolik: ${failed.error.message}` }, { status: 500 })
  }
  return NextResponse.json({ ok: true, saved: items.length })
}
