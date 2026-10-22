import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { releaseDueMocks } from '@/lib/schedule'
import { isMissingColumn } from '@/lib/db-columns'
import { groupBySlug, configGroups } from '@/lib/course-groups'
import { cleanSections, legacySection, rowSections, type MockSection } from '@/lib/mock-sections'


export type ModuleMinutes = { rw1?: number; rw2?: number; m1?: number; m2?: number; seq?: number }

export type TestSubject = 'full' | 'math' | 'english'
export type TestPlacement = 'mock' | 'course_task'
export type MathLayout = 'modules' | 'sequential'
/** Where the mock lives: real exam versions vs. the owner's own free-mock section. */
export type TestSection = MockSection
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
  /** Minutes of each module separately (rw1, rw2, m1, m2; seq = one continuous Math block). null = use the two numbers above. */
  moduleMinutes: ModuleMinutes | null
  /** false = draft: hidden from students until the admin presses Publish. */
  published: boolean
  /** Draft goes live automatically at this time (ISO), if scheduled. */
  publishAt: string | null
  /** First of `sections` (kept for older code). */
  section: TestSection
  /** Every list the mock is shown in — it can be in All Past Exams AND Free Mocks at once. */
  sections: TestSection[]
  access: TestAccess
  /** Students may download the questions as a PDF after finishing (admin's permission, per mock). */
  pdfDownload: boolean
  /** Course groups the mock / task is given to (slugs). A normal mock stays in the public lists too. */
  courseGroups: string[]
  /** Suggested time (minutes) shown once on a task's start screen; null = none. */
  recommendedMinutes: number | null
}

/** Keeps only known keys with a sane number of minutes (1–300). */
function cleanModuleMinutes(v: unknown): ModuleMinutes | null {
  if (!v || typeof v !== 'object') return null
  const out: ModuleMinutes = {}
  for (const k of ['rw1', 'rw2', 'm1', 'm2', 'seq'] as const) {
    const n = Number((v as Record<string, unknown>)[k])
    if (Number.isFinite(n) && n >= 1) out[k] = Math.min(Math.round(n), 300)
  }
  return Object.keys(out).length ? out : null
}

/** Unique, well-formed folder ids (the folders live in mock_folders). */
function cleanFolderIds(v: unknown): string[] {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && uuid.test(x)))].slice(0, 50) : []
}

/** Unique, known group slugs only. */
function cleanGroups(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((g): g is string => typeof g === 'string' && !!groupBySlug(g)))] : []
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
  const moduleMinutes = cleanModuleMinutes(body?.moduleMinutes)
  // `sections` (array) wins; the older single `section` still works.
  const sections: TestSection[] | null =
    body && Array.isArray(body.sections)
      ? cleanSections(body.sections)
      : body?.section === 'free' || body?.section === 'exams'
        ? [body.section]
        : null
  const pdfDownload: boolean | null = typeof body?.pdfDownload === 'boolean' ? body.pdfDownload : null
  // Re-saving a module of a mock that already exists must NOT move it back to the default list.
  const overwritePlacement = body?.overwritePlacement === true
  const access: TestAccess | null = body?.access === 'paid' ? 'paid' : body?.access === 'free' ? 'free' : null
  // Only touched when the caller sends them (a plain settings save never clears a group / time).
  const hasGroup = !!body && 'courseGroups' in body
  const courseGroups = cleanGroups(body?.courseGroups)
  const hasRec = !!body && 'recommendedMinutes' in body
  const recRaw = Number(body?.recommendedMinutes)
  const recommendedMinutes: number | null = Number.isFinite(recRaw) && recRaw > 0 ? Math.min(Math.round(recRaw), 600) : null

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server sozlanmagan.' },
      { status: 503 },
    )
  }

  const { data: existing } = await supabase.from('test_configs').select('test_label').eq('test_label', testLabel).maybeSingle()
  const placementLocked = !!existing && !overwritePlacement

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
  if (!placementLocked) {
    if (sections) {
      row.sections = sections
      row.section = legacySection(sections)
    }
    if (access) row.access = access
    if (pdfDownload !== null) row.pdf_download = pdfDownload
  }
  if (hasGroup) {
    row.course_groups = courseGroups
    row.course_group = null // the older single column is retired
  }
  if (hasRec) row.recommended_minutes = recommendedMinutes
  // Per-module minutes: only touched when the caller sends them (a plain settings save keeps what is there).
  if (body && 'moduleMinutes' in body) row.module_minutes = moduleMinutes

  let { error } = await supabase.from('test_configs').upsert(row)
  let draftUnsupported = false
  let minutesUnsupported = false
  if (error && 'module_minutes' in row && isMissingColumn(error, 'module_minutes')) {
    // v99 SQL not run yet — save everything else; the old two numbers (32 / 35) apply.
    delete row.module_minutes
    minutesUnsupported = true
    ;({ error } = await supabase.from('test_configs').upsert(row))
  }
  if (error && 'published' in row && isMissingColumn(error, 'published')) {
    // v36 SQL not run yet — save the settings anyway; the test is simply public.
    delete row.published
    draftUnsupported = true
    ;({ error } = await supabase.from('test_configs').upsert(row))
  }

  if (error && ('sections' in row || 'pdf_download' in row) && (isMissingColumn(error, 'sections') || isMissingColumn(error, 'pdf_download'))) {
    // v79 SQL not run yet — save the rest (the old single `section` column still works).
    delete row.sections
    delete row.pdf_download
    ;({ error } = await supabase.from('test_configs').upsert(row))
  }

  if (error && ('section' in row || 'access' in row) && (isMissingColumn(error, 'section') || isMissingColumn(error, 'access'))) {
    // v55 SQL not run yet — save the rest; the mock simply stays in All Past Exams / free.
    delete row.section
    delete row.access
    ;({ error } = await supabase.from('test_configs').upsert(row))
  }

  if (error && (isMissingColumn(error, 'course_groups') || isMissingColumn(error, 'course_group') || isMissingColumn(error, 'recommended_minutes'))) {
    return NextResponse.json(
      { error: "Avval Supabase'da v73 va v72 SQL'ni ishga tushiring (supabase/schema.sql oxiridagi qismlar)." },
      { status: 500 },
    )
  }
  if (error) {
    return NextResponse.json({ error: `Sozlamani saqlashda xatolik: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, draftUnsupported, minutesUnsupported })
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
      moduleMinutes: cleanModuleMinutes(row.module_minutes),
      published: row.published !== false,
      publishAt: row.publish_at ?? null,
      section: rowSections(row)[0] ?? 'exams',
      sections: rowSections(row),
      access: row.access === 'paid' ? 'paid' : 'free',
      pdfDownload: row.pdf_download === true,
      courseGroups: configGroups(row),
      recommendedMinutes: typeof row.recommended_minutes === 'number' ? row.recommended_minutes : null,
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
  // Lists the mock is shown in: { sections: ['exams', 'free'] } — several at once; [] = in no list.
  if (body && Array.isArray(body.sections)) {
    const sections = cleanSections(body.sections)
    patch.sections = sections
    patch.section = legacySection(sections)
  } else if (body?.section === 'free' || body?.section === 'exams') {
    patch.sections = [body.section]
    patch.section = body.section
  }
  if (typeof body?.pdfDownload === 'boolean') patch.pdf_download = body.pdfDownload
  if (body?.access === 'free' || body?.access === 'paid') patch.access = body.access
  // Task (untimed, shown in the groups' "My Courses") ↔ ordinary mock (shown in the public lists).
  if (body?.placement === 'mock' || body?.placement === 'course_task') patch.placement = body.placement
  // The groups this mock / task is given to: { courseGroups: ['nov', 'dec'] } (empty = none).
  // It only decides where the mock is ALSO shown (My Courses of those groups); it is never hidden
  // from the normal lists and keeps its own rules (timed + scored, or an untimed "vazifa").
  if (body && 'courseGroups' in body) {
    if (!Array.isArray(body.courseGroups)) return NextResponse.json({ error: "Noto'g'ri guruhlar." }, { status: 400 })
    patch.course_groups = cleanGroups(body.courseGroups)
    patch.course_group = null
  }
  // The admin's own folders this mock sits in: { folderIds: ['<uuid>', ...] } (empty = none).
  if (body && 'folderIds' in body) {
    if (!Array.isArray(body.folderIds)) return NextResponse.json({ error: "Noto'g'ri bo'limlar." }, { status: 400 })
    patch.folder_ids = cleanFolderIds(body.folderIds)
  }
  // Suggested time for a task: { recommendedMinutes: number | null }.
  if (body && 'recommendedMinutes' in body) {
    const n = Number(body.recommendedMinutes)
    patch.recommended_minutes = Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 600) : null
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "O'zgartirish yo'q." }, { status: 400 })
  const sb = supabaseAdmin()
  let { data: hit, error } = await sb.from('test_configs').update(patch).eq('test_label', testLabel).select('test_label')
  // A mock that has no settings row yet gets one now (every other setting has a default).
  if (!error && (hit ?? []).length === 0) ({ error } = await sb.from('test_configs').upsert({ test_label: testLabel, ...patch }))
  if (error && 'sections' in patch && !('pdf_download' in patch) && isMissingColumn(error, 'sections') && (patch.sections as string[]).length === 1) {
    // v79 SQL not run yet: a single list still works through the older `section` column.
    delete patch.sections
    ;({ data: hit, error } = await sb.from('test_configs').update(patch).eq('test_label', testLabel).select('test_label'))
    if (!error && (hit ?? []).length === 0) ({ error } = await sb.from('test_configs').upsert({ test_label: testLabel, ...patch }))
  }
  if (error) {
    const hint =
      'sections' in patch || 'pdf_download' in patch
        ? 'v79'
        : 'folder_ids' in patch
          ? 'v78'
          : 'recommended_minutes' in patch
            ? 'v72'
            : 'course_groups' in patch
              ? 'v73'
              : 'v55'
    return NextResponse.json(
      { error: `Avval Supabase'da ${hint} SQL'ni ishga tushiring (supabase/schema.sql oxiridagi qism).` },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
