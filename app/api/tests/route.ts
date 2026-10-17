import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { releaseDueMocks } from '@/lib/schedule'
import { loadCounts } from '@/lib/mock-catalog'
import { configGroups } from '@/lib/course-groups'
import { rowSections } from '@/lib/mock-sections'
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
  /** First of `sections` (older clients). */
  section: TestSection
  /** Every list the mock is shown in: 'exams' = All Past Exams, 'free' = Free Mocks — both at once is possible. */
  sections: TestSection[]
  /** The teacher allowed students to download this mock's questions as a PDF after finishing it. */
  pdfDownload: boolean
  /** 'paid' mocks show a lock and open for Pro / course students / admins only. */
  access: TestAccess
  /** Course groups this mock / task is given to ('nov' / 'dec'). */
  courseGroups: string[]
  /** Suggested minutes for a task (shown once at its start), or null. */
  recommendedMinutes: number | null
  /** The admin's own folders (mock_folders ids) this mock is filed in — admin list only. */
  folderIds: string[]
  /** The admin's own order (v80); lower comes first, null = not placed yet. */
  sortOrder: number | null
  /** When the mock's settings row was created (ISO) — admin list "newest first"; null for old rows. */
  createdAt: string | null
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
    // Counts (cached, fetched in parallel) and the settings rows (always fresh) load side by side.
    const fresh = includeDrafts && req.nextUrl.searchParams.get('fresh') === '1'
    const countsPromise = loadCounts(supabase, fresh)
    await releaseDueMocks(supabase) // drafts whose time has come go live BEFORE the settings are read
    const [byLabel, { data: configData }] = await Promise.all([countsPromise, supabase.from('test_configs').select('*')])
    const configRows = configData ?? []

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
          sections: rowSections(c),
          pdfDownload: c.pdf_download === true,
          access: (c.access === 'paid' ? 'paid' : 'free') as TestAccess,
          courseGroups: configGroups(c),
          recommendedMinutes: typeof c.recommended_minutes === 'number' ? (c.recommended_minutes as number) : null,
          folderIds: Array.isArray(c.folder_ids) ? (c.folder_ids as unknown[]).filter((x): x is string => typeof x === 'string') : [],
          sortOrder: typeof c.sort_order === 'number' ? (c.sort_order as number) : null,
          createdAt: (c.created_at as string | null) ?? null,
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
          section: config?.sections[0] ?? 'exams',
          sections: config?.sections ?? (['exams'] as TestSection[]),
          pdfDownload: config?.pdfDownload ?? false,
          access: config?.access ?? 'free',
          courseGroups: config?.courseGroups ?? [],
          recommendedMinutes: config?.recommendedMinutes ?? null,
          folderIds: includeDrafts ? (config?.folderIds ?? []) : [],
          sortOrder: config?.sortOrder ?? null,
          createdAt: includeDrafts ? (config?.createdAt ?? null) : null,
        }
      })
      .filter((t) => includeDrafts || t.published)
      // The admin's own order first (v80), the rest A–Z.
      .sort((a, b) => (a.sortOrder ?? 1e12) - (b.sortOrder ?? 1e12) || a.label.localeCompare(b.label))

    return NextResponse.json({ tests })
  } catch {
    return NextResponse.json({ tests: [] as MockTestSummary[] })
  }
}
