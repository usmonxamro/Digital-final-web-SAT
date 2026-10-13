import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingTable } from '@/lib/db-errors'
import type { CourseAccess } from '@/lib/course-groups'

/**
 * What course content this student may open. `all` = admin, or the older
 * per-student "kurs a'zosi" switch, or the SQL isn't run yet (everyone keeps
 * access, as before). `groups` = groups unlocked by a bot code / admin.
 */
export async function courseAccessFor(supabase: SupabaseClient, user: Record<string, unknown>): Promise<CourseAccess> {
  const all = user.role === 'admin' || !('course_member' in user) || !!user.course_member
  let groups: string[] = []
  const { data, error } = await supabase.from('course_memberships').select('group_slug').eq('user_id', user.id as string)
  if (!error) groups = (data ?? []).map((r) => r.group_slug as string)
  else if (isMissingTable(error) && !('course_member' in user)) return { all: true, groups: [] }
  return { all, groups }
}
