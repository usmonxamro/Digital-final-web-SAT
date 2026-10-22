/**
 * "All Past Exams" groups mocks by exam (one SAT sitting = one month of one year):
 *   "SAT March 2025 US v1", "SAT March 2025 v2", "SAT Mart 2025 International — Form C"
 * all land in ONE exam "SAT March 2025" with versions 1 (US), 2, C (International).
 * Month names are understood in English, Uzbek and Russian ("Mart", "Avgust", "Октябрь"…), and the
 * region words (US, International, Asia…) never split an exam — they are shown on the version instead.
 * A label with no month + year (e.g. "Practice Test 2") groups by its own name, as before.
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

/* ------------------------------- months ------------------------------- */

export const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Every spelling we accept for each month (lower case). */
const MONTH_WORDS: string[][] = [
  ['january', 'jan', 'yanvar', 'январь', 'января', 'янв'],
  ['february', 'feb', 'fevral', 'февраль', 'февраля', 'фев'],
  ['march', 'mar', 'mart', 'март', 'марта'],
  ['april', 'apr', 'aprel', 'апрель', 'апреля', 'апр'],
  ['may', 'май', 'мая'],
  ['june', 'jun', 'iyun', 'июнь', 'июня'],
  ['july', 'jul', 'iyul', 'июль', 'июля'],
  ['august', 'aug', 'avgust', 'август', 'августа', 'авг'],
  ['september', 'sep', 'sept', 'sentabr', 'sentyabr', 'сентябрь', 'сентября', 'сен'],
  ['october', 'oct', 'oktabr', 'oktyabr', 'октябрь', 'октября', 'окт'],
  ['november', 'nov', 'noyabr', 'ноябрь', 'ноября', 'ноя'],
  ['december', 'dec', 'dekabr', 'декабрь', 'декабря', 'дек'],
]

/** Region / edition words: part of a version, never of the exam name. */
const REGIONS: { re: RegExp; tag: string }[] = [
  { re: /\b(?:us|usa|u\.s\.?|domestic|amerika)\b/i, tag: 'US' },
  { re: /\b(?:international|intl|int'l|xalqaro|международн\w*)\b/i, tag: 'International' },
  { re: /\b(?:asia|osiyo|азия)\b/i, tag: 'Asia' },
]

const wordRe = (w: string) => new RegExp(`(?<![\\p{L}\\p{N}])${w.replace('.', '\\.')}(?![\\p{L}\\p{N}])`, 'iu')

/** "SAT Mart 2025 US" → { month: 2, year: '2025', region: 'US', rest: 'SAT' }. */
export function parseExamName(name: string): { month: number; year: string | null; region: string | null; rest: string } {
  let rest = name
  let month = -1
  outer: for (let i = 0; i < MONTH_WORDS.length; i++) {
    for (const w of MONTH_WORDS[i]) {
      const re = wordRe(w)
      if (re.test(rest)) {
        month = i
        rest = rest.replace(re, ' ')
        break outer
      }
    }
  }
  const year = name.match(/\b(20\d{2})\b/)?.[1] ?? null
  if (year) rest = rest.replace(year, ' ')
  let region: string | null = null
  for (const r of REGIONS) {
    if (r.re.test(rest)) {
      region = r.tag
      rest = rest.replace(r.re, ' ')
      break
    }
  }
  rest = rest.replace(/[—–\-,()]/g, ' ').replace(/\s+/g, ' ').trim()
  return { month, year, region, rest }
}

/* ------------------------------- groups ------------------------------- */

export type ExamVersion<T> = { version: string; region: string | null; test: T }

export type ExamGroup<T extends WithLabel> = {
  name: string
  year: string | null
  /** 0–11, or -1 when the name has no month. */
  month: number
  versions: ExamVersion<T>[]
}

export function groupExams<T extends WithLabel>(tests: T[]): ExamGroup<T>[] {
  const map = new Map<string, ExamGroup<T>>()
  for (const t of tests) {
    const { group, version } = splitExamLabel(t.label)
    const p = parseExamName(group)
    // A dated exam is keyed by its sitting (year + month + the rest of the name without the region),
    // so "SAT March 2025 US" and "SAT Mart 2025" are the same exam.
    const dated = p.month >= 0 && !!p.year
    const restKey = p.rest.toLowerCase().replace(/\bsat\b/g, '').trim()
    const key = dated ? `ym:${p.year}-${p.month}:${restKey}` : group.toLowerCase()
    let g = map.get(key)
    if (!g) {
      const name = dated ? `${p.rest || 'SAT'} ${EN_MONTHS[p.month]} ${p.year}`.replace(/\s+/g, ' ').trim() : group
      g = { name, year: p.year, month: dated ? p.month : -1, versions: [] }
      map.set(key, g)
    }
    g.versions.push({ version: version ?? '', region: p.region, test: t })
  }
  const groups = [...map.values()]
  for (const g of groups) {
    // Name the versions A, B, C… when the label gave none.
    g.versions.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }) || a.test.label.localeCompare(b.test.label))
    let next = 0
    g.versions = g.versions.map((v) => ({ ...v, version: v.version || String.fromCharCode(65 + (next++ % 26)) }))
  }
  // Newest first when the name carries a year + month; otherwise by name.
  const stamp = (g: ExamGroup<T>) => Number(g.year ?? 0) * 12 + (g.month + 1)
  return groups.sort((a, b) => stamp(b) - stamp(a) || a.name.localeCompare(b.name))
}

/** The exam group a mock belongs to (for links from elsewhere: "open this mock's exam page"). */
export function examNameOf(label: string): string {
  return groupExams([{ label }])[0]?.name ?? label
}
