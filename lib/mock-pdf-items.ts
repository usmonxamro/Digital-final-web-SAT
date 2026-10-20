import type { PdfItem } from '@/components/test-pdf'
import type { Question, SectionKind } from '@/lib/test-data'

/** The mock settings that decide how its questions are split into modules for the PDF. */
export type PdfCfg = { subject?: string; placement?: string; scored?: boolean; mathLayout?: string } | null

/**
 * Puts a mock's questions into exam order, ready for the PDF: same module split / caps as the exam itself.
 * `get(kind)` supplies the questions of one section (from the admin API, or preloaded by the PDF job).
 */
export async function assemblePdfItems(cfg: PdfCfg, get: (kind: SectionKind) => Promise<Question[]>): Promise<PdfItem[]> {
  const subject: 'full' | 'math' | 'english' = cfg?.subject === 'math' || cfg?.subject === 'english' ? cfg.subject : 'full'
  const flatOnly = cfg?.placement === 'course_task' || cfg?.scored === false
  const sequential = subject === 'math' && cfg?.mathLayout === 'sequential'

  const halves = (all: Question[]): [Question[], Question[]] => {
    const m1 = all.filter((q) => q.moduleNumber === 1)
    const m2 = all.filter((q) => q.moduleNumber === 2)
    if (m1.length || m2.length) return [m1, m2]
    if (all.length < 2) return [all, []]
    const mid = Math.ceil(all.length / 2)
    return [all.slice(0, mid), all.slice(mid)]
  }
  const toItems = (qs: Question[], cap: number, kind: SectionKind, moduleLabel?: string): PdfItem[] =>
    qs.slice(0, cap).map((question, index) => ({ moduleLabel, sectionKind: kind, index, question }))

  if (subject === 'full' && !flatOnly) {
    const [rw, math] = await Promise.all([get('reading'), get('math')])
    const [r1, r2] = halves(rw)
    const [m1, m2] = halves(math)
    return [
      ...toItems(r1, 27, 'reading', 'Reading and Writing — Module 1'),
      ...toItems(r2, 27, 'reading', 'Reading and Writing — Module 2'),
      ...toItems(m1, 22, 'math', 'Math — Module 1'),
      ...toItems(m2, 22, 'math', 'Math — Module 2'),
    ]
  }

  const kind: SectionKind = subject === 'math' ? 'math' : 'reading'
  const name = kind === 'math' ? 'Math' : 'Reading and Writing'
  const all = await get(kind)
  if (flatOnly || sequential || subject === 'full') return toItems(all, 1000, kind)
  const [p1, p2] = halves(all)
  const cap = kind === 'math' ? 22 : 27
  return [...toItems(p1, cap, kind, `${name} — Module 1`), ...toItems(p2, cap, kind, `${name} — Module 2`)]
}

/**
 * The questions of one mock for the PDF (admin: "PDF yuklab olish" on a mock's row).
 * Admins may read questions without starting the mock.
 */
export async function loadMockPdfItems(label: string): Promise<PdfItem[]> {
  const enc = encodeURIComponent(label)
  const cfgRes = await fetch(`/api/admin/test-config?testLabel=${enc}`).then((r) => r.json()).catch(() => ({}))
  const get = async (kind: SectionKind): Promise<Question[]> => {
    const res = await fetch(`/api/questions?kind=${kind}&test=${enc}`).then((r) => r.json()).catch(() => ({}))
    return (res?.questions ?? []) as Question[]
  }
  return assemblePdfItems(cfgRes?.config ?? null, get)
}
