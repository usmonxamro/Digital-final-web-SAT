/**
 * Where a mock is shown to students. A mock can sit in SEVERAL places at once:
 *   'exams' -> All Past Exams, 'free' -> Free Mocks.
 * DB: test_configs.sections (text[], v79). Rows saved before v79 only have the old single
 * `section` column, which is used as a fallback so nothing disappears.
 */
export type MockSection = 'exams' | 'free'
export const MOCK_SECTIONS: { key: MockSection; label: string }[] = [
  { key: 'exams', label: 'All Past Exams' },
  { key: 'free', label: 'Free Mocks' },
]

const isSection = (v: unknown): v is MockSection => v === 'exams' || v === 'free'

/** Clean, unique list in a stable order ('exams' first). */
export function cleanSections(v: unknown): MockSection[] {
  const arr = Array.isArray(v) ? v : []
  return MOCK_SECTIONS.map((s) => s.key).filter((k) => arr.includes(k))
}

/** The sections of a test_configs row (v79 array, else the older single column, else All Past Exams). */
export function rowSections(row: Record<string, unknown> | null | undefined): MockSection[] {
  if (!row) return ['exams']
  if (Array.isArray(row.sections)) return cleanSections(row.sections)
  return [isSection(row.section) ? row.section : 'exams']
}

/** Is this mock shown in the given section? (works on API summaries, which carry `sections`). */
export function inSection(t: { sections?: MockSection[]; section?: MockSection }, s: MockSection): boolean {
  return (t.sections ?? [t.section ?? 'exams']).includes(s)
}

/** The old single `section` column kept in step with `sections` (older code / not-yet-migrated DBs read it). */
export function legacySection(sections: MockSection[]): MockSection {
  return sections.includes('exams') || sections.length === 0 ? 'exams' : 'free'
}
