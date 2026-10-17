/**
 * Course groups (Telegram groups of the teacher). A student gets access to a
 * group's tasks either by redeeming a code from the Telegram bot or when an
 * admin adds them by hand (Admin → Foydalanuvchilar).
 *
 * To add another group: add a line here, and bind the same slug to the
 * Telegram group in the bot (/kurs <slug>).
 */
export type CourseGroup = { slug: string; title: string; short: string }

export const COURSE_GROUPS: CourseGroup[] = [
  { slug: 'nov', title: 'SAT November 800/800', short: 'Noyabr' },
  { slug: 'dec', title: 'SAT December 800/800', short: 'Dekabr' },
]

export const groupBySlug = (slug: string) => COURSE_GROUPS.find((g) => g.slug === slug) ?? null

/** Which defined group a task label belongs to: "SAT November 800/800 — Week 1" → 'nov'. */
export function groupOfLabel(label: string): string | null {
  const l = label.trim().toLowerCase()
  for (const g of COURSE_GROUPS) if (l.startsWith(g.title.toLowerCase())) return g.slug
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
