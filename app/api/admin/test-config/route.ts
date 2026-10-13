import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { releaseDueMocks } from '@/lib/schedule'
import { isMissingColumn } from '@/lib/db-columns'


export type TestSubject = 'full' | 'math' | 'english'
export type TestPlacement = 'mock' | 'course_task'
export type MathLayout = 'modules' | 'sequential'
/** Where the mock lives: real exam versions vs. the owner's own free-mock section. */
export type TestSection = 'exams' | 'free'
export type TestAccess = 'free' | 'paid'

export type TestConfig = {
  testLabel: string
  subject: TestSubject
  scored: boolean
  placement: TestPlacement
  englishModuleMinutes: number
  mathModuleMinutes: number
  /** 'modules' (2 x 22, standard) or 'sequential' (one continuous 44-question block). Only meaningful for subject 'math'. */
  mathLayout: MathLayout
  /** false = draft: hidden from students until the admin presses Publish. */
  published: boolean
  /** Draft goes live automatically at this time (ISO), if scheduled. */
  publishAt: string | null
  section: TestSection
  access: TestAccess
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }

  const body = await req.json().catch(() => null)
  const testLabel: string | undefined = body?.testLabel?.trim()
  if (!testLabel) {
    return NextResponse.json({ error: "Test nomi kerak." }, { status: 400 })
  }

  const subject: TestSubject = body?.subject === 'math' || body?.subject === 'english' ? body.subject : 'full'
  const scored: boolean = subject === 'full' ? true : body?.scored !== false
  const placement: TestPlacement = body?.placement === 'course_task' ? 'course_task' : 'mock'
  const englishModuleMinutes = Number(body?.englishModuleMinutes) || 32
  const mathModuleMinutes = Number(body?.mathModuleMinutes) || 35
  const mathLayout: MathLayout = body?.mathLayout === 'sequential' ? 'sequential' : 'modules'
  const section: TestSection | null = body?.section === 'free' ? 'free' : body?.section === 'exams' ? 'exams' : null
  const access: TestAccess | null = body?.access === 'paid' ? 'paid' : body?.access === 'free' ? 'free' : null

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server sozlanmagan.' },
      { status: 503 },
    )
  }

  const row: Record<string, unknown> = {
    test_label: testLabel,
    subject,
    scored,
    placement,
    english_module_minutes: englishModuleMinutes,
    math_module_minutes: mathModuleMinutes,
    math_layout: mathLayout,
  }
  // Only touched when the caller says so (new mocks are saved as drafts);
  // a plain settings save never flips a published test back to draft.
  if (typeof body?.published === 'boolean') row.published = body.published
  if (section) row.section = section
  if (access) row.access = access

  let { error } = await supabase.from('test_configs').upsert(row)
  let draftUnsupported = false
  if (error && 'published' in row && isMissingColumn(error, 'published')) {
    // v36 SQL not run yet — save the settings anyway; the test is simply public.
    delete row.published
    draftUnsupported = true
    ;({ error } = await supabase.from('test_configs').upsert(row))
  }

  if (error && ('section' in row || 'access' in row) && (isMissingColumn(error, 'section') || isMissingColumn(error, 'access'))) {
    // v55 SQL not run yet — save the rest; the mock simply stays in All Past Exams / free.
    delete row.section
    delete row.access
    ;({ error } = await supabase.from('test_configs').upsert(row))
  }

  if (error) {
    return NextResponse.json({ error: `Sozlamani saqlashda xatolik: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, draftUnsupported })
}

export async function GET(req: NextRequest) {
  const testLabel = req.nextUrl.searchParams.get('testLabel')
  // One test's settings are public (the exam page needs them); the full list is admin-only.
  if (!testLabel) {
    try {
      await requireAdmin()
    } catch (e) {
      return adminErrorResponse(e)
    }
  }
  try {
    const supabase = supabaseAdmin()
    await releaseDueMocks(supabase)
    let query = supabase.from('test_configs').select('*')
    query = testLabel ? query.eq('test_label', testLabel) : query
    const { data } = await query

    const configs: TestConfig[] = (data ?? []).map((row) => ({
      testLabel: row.test_label,
      subject: row.subject,
      scored: row.scored,
      placement: row.placement,
      englishModuleMinutes: row.english_module_minutes,
      mathModuleMinutes: row.math_module_minutes,
      mathLayout: row.math_layout === 'sequential' ? 'sequential' : 'modules',
      published: row.published !== false,
      publishAt: row.publish_at ?? null,
      section: row.section === 'free' ? 'free' : 'exams',
      access: row.access === 'paid' ? 'paid' : 'free',
    }))

    return NextResponse.json(testLabel ? { config: configs[0] ?? null } : { configs })
  } catch {
    return NextResponse.json(testLabel ? { config: null } : { configs: [] as TestConfig[] })
  }
}

/** Change where a mock lives / whether it is paid, without touching its other settings. */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const testLabel: string | undefined = body?.testLabel?.trim()
  if (!testLabel) return NextResponse.json({ error: 'Test nomi kerak.' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  if (body?.section === 'free' || body?.section === 'exams') patch.section = body.section
  if (body?.access === 'free' || body?.access === 'paid') patch.access = body.access
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "O'zgartirish yo'q." }, { status: 400 })
  const { error } = await supabaseAdmin().from('test_configs').update(patch).eq('test_label', testLabel)
  if (error) {
    return NextResponse.json(
      { error: "Avval Supabase'da v55 SQL'ni ishga tushiring (supabase/schema.sql oxiridagi qism)." },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
