/**
 * "All Past Exams" groups mocks by exam: labels like
 *   "October 2026 SAT — Version A", "October 2026 SAT - Form B", "October 2026 SAT (V2)"
 * all land in the exam "October 2026 SAT" with versions A / B / 2.
 * A label with no version suffix (e.g. "Practice Test 2") is its own exam with one version.
 */
export type WithLabel = { label: string }

const VERSION_RE = /^(.*?)[\s]*(?:[—–-]\s*|\(\s*|\[\s*|,\s*)?(?:version|variant|ver\.?|form|v)\s*[-.:]?\s*([A-Za-z0-9]{1,3})\s*[)\]]?\s*$/i

export function splitExamLabel(label: string): { group: string; version: string | null } {
  const m = label.trim().match(VERSION_RE)
  if (m && m[1].trim().length >= 3) {
    return { group: m[1].trim().replace(/[—–\-,(\[\s]+$/, '').trim(), version: m[2].toUpperCase() }
  }
  return { group: label.trim(), version: null }
}

export type ExamGroup<T extends WithLabel> = {
  name: string
  year: string | null
  versions: { version: string; test: T }[]
}

export function groupExams<T extends WithLabel>(tests: T[]): ExamGroup<T>[] {
  const map = new Map<string, ExamGroup<T>>()
  for (const t of tests) {
    const { group, version } = splitExamLabel(t.label)
    const key = group.toLowerCase()
    let g = map.get(key)
    if (!g) {
      g = { name: group, year: group.match(/\b(20\d{2})\b/)?.[1] ?? null, versions: [] }
      map.set(key, g)
    }
    g.versions.push({ version: version ?? '', test: t })
  }
  const groups = [...map.values()]
  for (const g of groups) {
    // Name the versions A, B, C… when the label gave none.
    g.versions.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }) || a.test.label.localeCompare(b.test.label))
    g.versions = g.versions.map((v, i) => ({ ...v, version: v.version || String.fromCharCode(65 + (i % 26)) }))
  }
  // Newest first when the name carries a year + month; otherwise by name.
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  const stamp = (g: ExamGroup<T>) => {
    const y = Number(g.year ?? 0)
    const mi = MONTHS.findIndex((m) => g.name.toLowerCase().includes(m))
    return y * 12 + (mi + 1)
  }
  return groups.sort((a, b) => stamp(b) - stamp(a) || a.name.localeCompare(b.name))
}
