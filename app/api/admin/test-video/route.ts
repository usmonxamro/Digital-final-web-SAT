import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingColumn, MIGRATION_HINT } from '@/lib/db-columns'
import { parseYouTubeId } from '@/lib/youtube'

/** Attach (or remove, with url "") a YouTube video analysis to a mock: { testLabel, url }. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const testLabel = typeof body?.testLabel === 'string' ? body.testLabel.trim() : ''
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!testLabel) return NextResponse.json({ error: 'Mock nomi kerak.' }, { status: 400 })

  let videoId: string | null = null
  if (url) {
    videoId = parseYouTubeId(url)
    if (!videoId) return NextResponse.json({ error: "YouTube havolasi noto'g'ri." }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const { data: existing } = await supabase.from('test_configs').select('test_label').eq('test_label', testLabel).maybeSingle()
  const { error } = existing
    ? await supabase.from('test_configs').update({ video_id: videoId }).eq('test_label', testLabel)
    : await supabase.from('test_configs').insert({ test_label: testLabel, video_id: videoId })
  if (error) {
    return NextResponse.json({ error: isMissingColumn(error, 'video_id') ? MIGRATION_HINT : error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, videoId })
}

/** Current video id for the admin form. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const testLabel = req.nextUrl.searchParams.get('testLabel') ?? ''
  const { data } = await supabaseAdmin().from('test_configs').select('*').eq('test_label', testLabel).maybeSingle()
  return NextResponse.json({ videoId: data?.video_id ?? null })
}
