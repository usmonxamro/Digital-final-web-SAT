import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingColumn, MIGRATION_HINT } from '@/lib/db-columns'
import { pushMockToBot } from '@/lib/bot-publish'

/**
 * Publish / unpublish a mock: { testLabel, published: boolean }.
 * Draft tests are hidden from the student dashboard and from /api/questions
 * (except for the admin's own preview).
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }

  const body = await req.json().catch(() => null)
  const testLabel: string | undefined = body?.testLabel?.trim()
  // Optional schedule: { publishAt: ISO } keeps it a draft until that time.
  let publishAt: string | null = null
  if (body?.publishAt) {
    const t = new Date(body.publishAt)
    if (Number.isNaN(t.getTime())) return NextResponse.json({ error: "Sana noto'g'ri." }, { status: 400 })
    if (t.getTime() <= Date.now() + 30_000) {
      return NextResponse.json({ error: "Rejalashtirilgan vaqt kelajakda bo'lishi kerak." }, { status: 400 })
    }
    publishAt = t.toISOString()
  }
  const published = publishAt ? false : body?.published !== false
  if (!testLabel) return NextResponse.json({ error: 'Test nomi kerak.' }, { status: 400 })

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server sozlanmagan.' }, { status: 503 })
  }

  const { data: existing, error: readError } = await supabase
    .from('test_configs')
    .select('test_label')
    .eq('test_label', testLabel)
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })

  const fields: Record<string, unknown> = { published, publish_at: publishAt }
  let { error } = existing
    ? await supabase.from('test_configs').update(fields).eq('test_label', testLabel)
    : await supabase.from('test_configs').insert({ test_label: testLabel, ...fields })
  if (error && isMissingColumn(error, 'publish_at')) {
    if (publishAt) return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    delete fields.publish_at
    ;({ error } = existing
      ? await supabase.from('test_configs').update(fields).eq('test_label', testLabel)
      : await supabase.from('test_configs').insert({ test_label: testLabel, ...fields }))
  }

  if (error) {
    if (isMissingColumn(error, 'published')) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    return NextResponse.json({ error: `Saqlashda xatolik: ${error.message}` }, { status: 500 })
  }
  // A mock that goes live also becomes a bot test (code + answer key), unless the bot already has it.
  const bot = published ? await pushMockToBot(supabase, testLabel) : null
  return NextResponse.json({ ok: true, published, publishAt, bot })
}
