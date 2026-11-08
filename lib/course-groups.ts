/**
 * Course groups (Telegram groups of the teacher). A student gets access to a
 * group's tasks either by redeeming a code from the Telegram bot or when an
 * admin adds them by hand (Admin → Foydalanuvchilar).
 *
 * Groups are managed in Admin → «Kurs bannerlari» (stored in site_settings,
 * key 'course_groups'): add a new group, edit its card text, show / hide its
 * banner on the landing page and in «Mening kurslarim», or archive it.
 * The list below is only the fallback used before the database answers.
 * Bind the same slug to the Telegram group in the bot (/kurs <slug>).
 */
export type CourseGroup = {
  slug: string
  title: string
  short: string
  /** Landing card: small label above the title ("❄ Qabul ochiq"). */
  tag?: string
  /** Landing card: one-sentence description. */
  desc?: string
  /** Landing card: bullet points. */
  bullets?: string[]
  /** Landing card: "Batafsil ko'rish" link. */
  link?: string
  /** Landing card colours: 'nov' = orange, 'dec' = blue. */
  theme?: 'nov' | 'dec'
  /** Word written on the calendar picture of the landing card (e.g. "DECEMBER"). */
  month?: string
  /** Show the banner (card) on the landing page. */
  landing?: boolean
  /** Show the group card in the student dashboard («Mening kurslarim») to everyone. Members always see their own group. */
  dashboard?: boolean
  /** Finished group: hidden everywhere, kept only so old data stays valid. */
  archived?: boolean
}

export const DEFAULT_COURSE_GROUPS: CourseGroup[] = [
  { slug: 'nov', title: 'SAT November 800/800', short: 'Noyabr', theme: 'nov', month: 'NOVEMBER', landing: false, dashboard: false },
  {
    slug: 'dec',
    title: 'SAT December 800/800',
    short: 'Dekabr',
    theme: 'dec',
    month: 'DECEMBER',
    tag: '❄ Qabul ochiq',
    desc: 'Dekabr imtihoniga mo‘ljallangan intensiv kurs Telegramda — eng yaxshi natija uchun.',
    bullets: ['10 haftalik intensiv dastur', 'Daily video darslar va qisqa konspektlar', 'Amaliy mashqlar va testlar', 'Shaxsiy progress tahlili', 'Faol hamjamiyat va motivatsion muhit'],
    link: 'https://t.me/Usmon_Xamroyev',
    landing: true,
    dashboard: true,
  },
]

let registry: CourseGroup[] = DEFAULT_COURSE_GROUPS

/** Every known group (archived ones included — old tasks and memberships still point at them). */
export function courseGroups(): CourseGroup[] {
  return registry
}
/** Groups that are still running (what admin pickers offer). */
export function activeCourseGroups(list: CourseGroup[] = registry): CourseGroup[] {
  return list.filter((g) => !g.archived)
}
export function setCourseGroups(list: CourseGroup[]) {
  if (list.length) registry = list
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,23}$/
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Validates a list sent by the admin / read from the database. Unknown fields are dropped. */
export function cleanCourseGroups(raw: unknown): CourseGroup[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: CourseGroup[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const slug = str(o.slug, 24).toLowerCase()
    const title = str(o.title, 80)
    if (!SLUG_RE.test(slug) || !title || seen.has(slug)) continue
    seen.add(slug)
    const bullets = Array.isArray(o.bullets) ? o.bullets.map((b) => str(b, 120)).filter(Boolean).slice(0, 8) : []
    out.push({
      slug,
      title,
      short: str(o.short, 24) || title.split(' ')[1] || title,
      tag: str(o.tag, 40) || undefined,
      desc: str(o.desc, 240) || undefined,
      bullets: bullets.length ? bullets : undefined,
      link: /^https?:\/\//.test(str(o.link, 300)) ? str(o.link, 300) : undefined,
      theme: o.theme === 'nov' ? 'nov' : 'dec',
      month: str(o.month, 14).toUpperCase() || undefined,
      landing: o.landing === true,
      dashboard: o.dashboard === true,
      archived: o.archived === true,
    })
  }
  return out
}

export const groupBySlug = (slug: string) => registry.find((g) => g.slug === slug) ?? null

/** Which defined group a task label belongs to: "SAT November 800/800 — Week 1" → 'nov'. */
export function groupOfLabel(label: string): string | null {
  const l = label.trim().toLowerCase()
  for (const g of registry) if (l.startsWith(g.title.toLowerCase())) return g.slug
  return null
}

export type CourseAccess = { all: boolean; groups: string[] }

/** Group slugs stored on a test_configs row (v73 array; falls back to the older single v68 column). */
export function configGroups(row: Record<string, unknown> | null | undefined): string[] {
  if (!row) return []
  const raw = 'course_groups' in row ? row.course_groups : row.course_group ? [row.course_group] : []
  return (Array.isArray(raw) ? raw : []).filter((g): g is string => typeof g === 'string' && !!groupBySlug(g))
}

/**
 * The groups a course task belongs to: the ones the admin attached it to,
 * else the one its label starts with ("SAT November 800/800 — Week 1").
 */
export function groupsOfTask(label: string, courseGroups?: string[] | null): string[] {
  const own = (courseGroups ?? []).filter((g) => !!groupBySlug(g))
  if (own.length) return own
  const g = groupOfLabel(label)
  return g ? [g] : []
}

/** May this student open a course task (a "vazifa") with this label and these admin-chosen groups? */
export function canOpenTask(label: string, a: CourseAccess, courseGroups?: string[] | null): boolean {
  if (a.all) return true
  const gs = groupsOfTask(label, courseGroups)
  return gs.length ? gs.some((g) => a.groups.includes(g)) : a.groups.length > 0
}
