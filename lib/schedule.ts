import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Scheduled publishing without a cron job: any mock whose `publish_at` time has
 * passed is flipped to published the next time anyone reads the mock list /
 * questions / settings. (If the v48 `publish_at` column doesn't exist yet this
 * silently does nothing.)
 */
export async function releaseDueMocks(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase
      .from('test_configs')
      .update({ published: true, publish_at: null })
      .eq('published', false)
      .not('publish_at', 'is', null)
      .lte('publish_at', new Date().toISOString())
  } catch {
    /* column missing or DB hiccup — ignore */
  }
}
