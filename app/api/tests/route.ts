import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { releaseDueMocks } from '@/lib/schedule'
import { configGroups } from '@/lib/course-groups'
import type { TestSubject, TestPlacement, MathLayout, TestSection, TestAccess } from '@/app/api/admin/test-config/route'

export type MockTestSummary = {
  label: string
  readingCount: number
  mathCount: number
  subject: TestSubject
  scored: boolean
  placement: TestPlacement
  mathLayout: MathLayout
  /** false = draft (admin only). */
  published: boolean
  /** A video analysis is attached. */
  hasVideo: boolean
  /** ISO time the draft goes live automatically (admin view). */
  publishAt: string | null
  /** The logged-in student has finished this test at least once. */
  done: boolean
  /** 'exams' = All Past Exams, 'free' = Free Mocks. */
  section: TestSection
  /** 'paid' mocks show a lock and open for Pro / course students / admins only. */
  access: TestAccess
  /** Course groups this mock / task is given to ('nov' / 'dec'). */
  courseGroups: string[]
  /** Suggested minutes for a task (shown once at its start), or null. */
  recommendedMinutes: number | null
  /** The admin's own folders (mock_folders ids) this mock is filed in — admin list only. */
  folderIds: string[]
}

type Catalog = {
  byLabel: Map<string, { readingCount: number; mathCount: number }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configRows: any[]
}

// The mock catalogue (question counts per test + test settings) is the same for
// every student, but building it means scanning every question row. With
// thousands of questions that was done on EVERY dashboard / practice page load.
// Keep it in memory for a few seconds instead — one scan serves many students.
const CATALOG_TTL_MS = 20_000
let catalogCache: { at: number; data: Catalog } | null = null
let catalogInflight: Promise<Catalog> | null = null

async function loadCatalog(supabase: ReturnType<typeof supabaseAdmin>, fresh = false): Promise<Catalog> {
  if (!fresh && catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.data
  if (!fresh && catalogInflight) return catalogInflight
  catalogInflight = (async () => {
    await releaseDueMocks(supabase)
    const configPromise = supabase.from('test_configs').select('*')
    // Supabase returns at most 1000 rows per request — page through them all.
    const byLabel: Catalog['byLabel'] = new Map()
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase
        .from('questions')
        .select('kind, test_label')
        .not('test_label', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      for (const row of data ?? []) {
        const label = row.test_label as string
        const bucket = byLabel.get(label) ?? { readingCount: 0, mathCount: 0 }
        if (row.kind === 'reading') bucket.readingCount++
        else if (row.kind === 'math') bucket.mathCount++
        byLabel.set(label, bucket)
      }
      if (!data || data.length < PAGE) break
    }
    const { data: configRows } = await configPromise
    const result: Catalog = { byLabel, configRows: configRows ?? [] }
    catalogCache = { at: Date.now(), data: result }
    return result
  })().finally(() => {
    catalogInflight = null
  })
  return catalogInflight
}

export async function GET(req: NextRequest) {
  // ?all=1 (admin panel) also lists drafts; everyone else only sees published tests.
  let includeDrafts = false
  if (req.nextUrl.searchParams.get('all') === '1') {
    try {
      await requireAdmin()
      includeDrafts = true
    } catch {
      includeDrafts = false
    }
  }
  try {
    const supabase = supabaseAdmin()
    const { byLabel, configRows } = await loadCatalog(supabase, includeDrafts)

    const configByLabel = new Map(
      configRows.map((c) => [
        c.test_label as string,
        {
          subject: c.subject as TestSubject,
          scored: c.scored as boolean,
          placement: c.placement as TestPlacement,
          mathLayout: (c.math_layout === 'sequential' ? 'sequential' : 'modules') as MathLayout,
          published: c.published !== false,
          hasVideo: !!c.video_id,
          publishAt: (c.publish_at as string | null) ?? null,
          section: (c.section === 'free' ? 'free' : 'exams') as TestSection,
          access: (c.access === 'paid' ? 'paid' : 'free') as TestAccess,
          courseGroups: configGroups(c),
          recommendedMinutes: typeof c.recommended_minutes === 'number' ? (c.recommended_minutes as number) : null,
          folderIds: Array.isArray(c.folder_ids) ? (c.folder_ids as unknown[]).filter((x): x is string => typeof x === 'string') : [],
        },
      ]),
    )

    // Which tests this student has already finished (for "Video tahlil" buttons).
    const doneLabels = new Set<string>()
    const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
    if (session) {
      const [{ data: att }, { data: st }] = await Promise.all([
        supabase.from('test_attempts').select('test_label').eq('user_id', session.userId),
        supabase.from('mock_starts').select('test_label').eq('user_id', session.userId).not('graded_at', 'is', null),
      ])
      for (const r of [...(att ?? []), ...(st ?? [])]) doneLabels.add(r.test_label as string)
    }

    const tests: MockTestSummary[] = Array.from(byLabel.entries())
      .map(([label, counts]) => {
        const config = configByLabel.get(label)
        return {
          label,
          ...counts,
          subject: config?.subject ?? 'full',
          scored: config?.scored ?? true,
          placement: config?.placement ?? 'mock',
          mathLayout: config?.mathLayout ?? 'modules',
          published: config?.published ?? true,
          hasVideo: config?.hasVideo ?? false,
          publishAt: includeDrafts ? (config?.publishAt ?? null) : null,
          done: doneLabels.has(label),
          section: config?.section ?? 'exams',
          access: config?.access ?? 'free',
          courseGroups: config?.courseGroups ?? [],
          recommendedMinutes: config?.recommendedMinutes ?? null,
          folderIds: includeDrafts ? (config?.folderIds ?? []) : [],
        }
      })
      .filter((t) => includeDrafts || t.published)
      .sort((a, b) => a.label.localeCompare(b.label))

    return NextResponse.json({ tests })
  } catch {
    return NextResponse.json({ tests: [] as MockTestSummary[] })
  }
}
