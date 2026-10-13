/**
 * Course groups (Telegram groups of the teacher). A student gets access to a
 * group's tasks either by redeeming a code from the Telegram bot or when an
 * admin adds them by hand (Admin → Foydalanuvchilar).
 *
 * To add another group: add a line here, and bind the same slug to the
 * Telegram group in the bot (/kurs <slug>).
 */
export type CourseGroup = { slug: string; title: string }

export const COURSE_GROUPS: CourseGroup[] = [
  { slug: 'nov', title: 'SAT November 800/800' },
  { slug: 'dec', title: 'SAT December 800/800' },
]

export const groupBySlug = (slug: string) => COURSE_GROUPS.find((g) => g.slug === slug) ?? null

/** Which defined group a task label belongs to: "SAT November 800/800 — Week 1" → 'nov'. */
export function groupOfLabel(label: string): string | null {
  const l = label.trim().toLowerCase()
  for (const g of COURSE_GROUPS) if (l.startsWith(g.title.toLowerCase())) return g.slug
  return null
}

export type CourseAccess = { all: boolean; groups: string[] }

/** May this student open a course task with this label? */
export function canOpenTask(label: string, a: CourseAccess): boolean {
  if (a.all) return true
  const g = groupOfLabel(label)
  return g ? a.groups.includes(g) : a.groups.length > 0
}
