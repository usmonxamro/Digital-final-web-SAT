import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { configGroups, groupBySlug } from '@/lib/course-groups'
import { cleanSections, legacySection, rowSections } from '@/lib/mock-sections'
import { isMissingColumn } from '@/lib/db-columns'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Lists = { sections?: unknown; folderIds?: unknown; courseGroups?: unknown }

const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const uniq = <T,>(a: T[]) => [...new Set(a)]

/**
 * Many mocks at once (Admin → Mocklar → select several):
 *   { labels: string[],
 *     add?:    { sections?: ('exams'|'free')[], folderIds?: string[], courseGroups?: string[] },
 *     remove?: { same },
 *     set?:    { access?: 'free'|'paid', pdfDownload?: boolean } }
 * "add" / "remove" only touch the listed items, so a mock keeps every other place it is already in.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as { labels?: unknown; add?: Lists; remove?: Lists; set?: { access?: unknown; pdfDownload?: unknown } } | null
  const labels = uniq(strs(body?.labels).map((l) => l.trim()).filter(Boolean)).slice(0, 500)
  if (labels.length === 0) return NextResponse.json({ error: 'Mock tanlanmagan.' }, { status: 400 })

  const addSections = cleanSections(body?.add?.sections)
  const remSections = cleanSections(body?.remove?.sections)
  const addFolders = strs(body?.add?.folderIds).filter((x) => UUID.test(x))
  const remFolders = strs(body?.remove?.folderIds).filter((x) => UUID.test(x))
  const addGroups = strs(body?.add?.courseGroups).filter((g) => !!groupBySlug(g))
  const remGroups = strs(body?.remove?.courseGroups).filter((g) => !!groupBySlug(g))
  const access = body?.set?.access === 'paid' ? 'paid' : body?.set?.access === 'free' ? 'free' : null
  const pdf = typeof body?.set?.pdfDownload === 'boolean' ? body.set.pdfDownload : null

  const touchesSections = addSections.length + remSections.length > 0
  const touchesFolders = addFolders.length + remFolders.length > 0
  const touchesGroups = addGroups.length + remGroups.length > 0
  if (!touchesSections && !touchesFolders && !touchesGroups && !access && pdf === null) {
    return NextResponse.json({ error: "O'zgartirish yo'q." }, { status: 400 })
  }

  const sb = supabaseAdmin()
  const { data: rows, error: rErr } = await sb.from('test_configs').select('*').in('test_label', labels)
  if (rErr) return NextResponse.json({ error: `O'qib bo'lmadi: ${rErr.message}` }, { status: 500 })
  const byLabel = new Map((rows ?? []).map((r) => [r.test_label as string, r as Record<string, unknown>]))

  const out = labels.map((label) => {
    const cur = byLabel.get(label) ?? null
    const patch: Record<string, unknown> = { test_label: label }
    if (touchesSections) {
      const next = cleanSections([...rowSections(cur).filter((s) => !remSections.includes(s)), ...addSections])
      patch.sections = next
      patch.section = legacySection(next)
    }
    if (touchesFolders) {
      const have = strs(cur?.folder_ids)
      patch.folder_ids = uniq([...have.filter((x) => !remFolders.includes(x)), ...addFolders]).slice(0, 50)
    }
    if (touchesGroups) {
      const have = configGroups(cur)
      patch.course_groups = uniq([...have.filter((g) => !remGroups.includes(g)), ...addGroups])
      patch.course_group = null
    }
    if (access) patch.access = access
    if (pdf !== null) patch.pdf_download = pdf
    return patch
  })

  const { error } = await sb.from('test_configs').upsert(out)
  if (error) {
    const hint = isMissingColumn(error, 'sections') || isMissingColumn(error, 'pdf_download') ? 'v79' : isMissingColumn(error, 'folder_ids') ? 'v78' : 'v73'
    return NextResponse.json({ error: `Avval Supabase'da ${hint} SQL'ni ishga tushiring (supabase/schema.sql oxiridagi qism).` }, { status: 500 })
  }
  return NextResponse.json({ ok: true, changed: out.length })
}
