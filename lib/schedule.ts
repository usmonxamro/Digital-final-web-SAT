import type { SupabaseClient } from '@supabase/supabase-js'
import { checkAnswerKeys } from '@/lib/answer-keys'

/**
 * Scheduled publishing without a cron job: any mock whose `publish_at` time has
 * passed is flipped to published the next time anyone reads the mock list /
 * questions / settings. (If the v48 `publish_at` column doesn't exist yet this
 * silently does nothing.)
 *
 * A mock whose answer key is still incomplete is NOT released: its schedule is cancelled and it
 * stays a draft, so students never get questions that are silently marked wrong.
 */
export async function releaseDueMocks(supabase: SupabaseClient): Promise<void> {
  try {
    const { data: due } = await supabase
      .from('test_configs')
      .select('test_label')
      .eq('published', false)
      .not('publish_at', 'is', null)
      .lte('publish_at', new Date().toISOString())
    for (const row of (due ?? []) as { test_label: string }[]) {
      let complete = false
      try {
        complete = (await checkAnswerKeys(supabase, row.test_label)).ok
      } catch {
        continue // cannot verify right now — try again on the next read
      }
      await supabase
        .from('test_configs')
        .update(complete ? { published: true, publish_at: null } : { publish_at: null })
        .eq('test_label', row.test_label)
        .eq('published', false)
    }
  } catch {
    /* column missing or DB hiccup — ignore */
  }
}
