import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * "Testni yuklab olish (PDF)" fast path: if the teacher's PDF job already built this mock's vector PDF
 * (test_configs.pdf_path), return a short-lived download link — the file arrives instantly, nothing is built in the browser.
 * `{ cached: false }` means "no ready file": the page falls back to building the PDF itself.
 */
export async function GET(req: NextRequest) {
  const label = req.nextUrl.searchParams.get('label')?.trim()
  if (!label) return NextResponse.json({ cached: false })

  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ cached: false }, { status: 401 })

  try {
    const supabase = supabaseAdmin()
    const { data: cfg } = await supabase.from('test_configs').select('pdf_download, pdf_path').eq('test_label', label).maybeSingle()
    if (!cfg || cfg.pdf_download !== true || !cfg.pdf_path) return NextResponse.json({ cached: false })

    // Only a student who actually finished this mock gets its PDF (same rule as the result-screen button).
    const { data: done } = await supabase
      .from('mock_starts')
      .select('id')
      .eq('user_id', session.userId)
      .eq('test_label', label)
      .not('graded_at', 'is', null)
      .limit(1)
    if (!done || done.length === 0) return NextResponse.json({ cached: false }, { status: 403 })

    const base = label.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'SAT test'
    const { data: signed, error } = await supabase.storage
      .from('mock-pdfs')
      .createSignedUrl(cfg.pdf_path as string, 120, { download: `${base} - SAT AKADEMIYASI.pdf` })
    if (error || !signed?.signedUrl) return NextResponse.json({ cached: false })
    return NextResponse.json({ cached: true, url: signed.signedUrl })
  } catch {
    return NextResponse.json({ cached: false })
  }
}
