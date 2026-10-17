import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingColumn } from '@/lib/db-columns'

/**
 * Save the admin's own mock order: { labels: ['Mock A', 'Mock B', ...] } — the first label comes first.
 * Students' lists (Free Mocks, ...) follow it too (lower sort_order first, unplaced mocks last).
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as { labels?: unknown } | null
  const labels = [...new Set((Array.isArray(body?.labels) ? body.labels : []).filter((x): x is string => typeof x === 'string' && !!x.trim()))].slice(0, 1000)
  if (labels.length === 0) return NextResponse.json({ error: 'Tartib bo‘sh.' }, { status: 400 })

  const rows = labels.map((test_label, i) => ({ test_label, sort_order: (i + 1) * 10 }))
  const { error } = await supabaseAdmin().from('test_configs').upsert(rows)
  if (error) {
    const msg = isMissingColumn(error, 'sort_order') ? "Avval Supabase'da v80 SQL'ni ishga tushiring (supabase/schema.sql oxiridagi qism)." : `Saqlab bo'lmadi: ${error.message}`
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
