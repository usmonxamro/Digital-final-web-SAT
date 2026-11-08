import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { cleanCourseGroups, courseGroups, setCourseGroups, type CourseGroup } from '@/lib/course-groups'

/** site_settings key that holds the admin-managed course group list. */
export const COURSE_GROUPS_KEY = 'course_groups'
const TTL = 20_000
let loadedAt = 0

/**
 * Refreshes the in-memory group registry from the database (cached for a few seconds per server instance).
 * Call it at the top of any route that validates / lists group slugs. Never throws: falls back to the
 * last known list (or the built-in defaults when the v110 SQL has not been run).
 */
export async function loadCourseGroups(sb?: SupabaseClient, force = false): Promise<CourseGroup[]> {
  if (!force && Date.now() - loadedAt < TTL) return courseGroups()
  try {
    const db = sb ?? supabaseAdmin()
    const { data, error } = await db.from('site_settings').select('value').eq('key', COURSE_GROUPS_KEY).maybeSingle()
    if (!error && data) {
      const list = cleanCourseGroups(data.value)
      if (list.length) setCourseGroups(list)
    }
    loadedAt = Date.now()
  } catch {
    // keep the last known list
  }
  return courseGroups()
}

export async function saveCourseGroups(sb: SupabaseClient, list: CourseGroup[]) {
  const { error } = await sb
    .from('site_settings')
    .upsert({ key: COURSE_GROUPS_KEY, value: list, updated_at: new Date().toISOString() })
  if (!error) {
    setCourseGroups(list)
    loadedAt = Date.now()
  }
  return error
}
