import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A mock's ready-made PDF (test_configs.pdf_path) goes stale when its questions change. These helpers drop the
 * pointer so students get a freshly built PDF the next time; the PDF job rebuilds the file afterwards.
 * Best-effort and silent: the columns may not exist yet (v97 SQL not run) and that must never break an edit.
 */
export async function invalidateMockPdf(supabase: SupabaseClient, labels: (string | null | undefined)[]) {
  const list = [...new Set(labels.filter((l): l is string => !!l))]
  if (list.length === 0) return
  try {
    await supabase.from('test_configs').update({ pdf_path: null, pdf_built_at: null }).in('test_label', list).not('pdf_path', 'is', null)
  } catch {
    /* ignore */
  }
}

export async function invalidateMockPdfForQuestions(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return
  try {
    const { data } = await supabase.from('questions').select('test_label').in('id', ids.slice(0, 500))
    await invalidateMockPdf(supabase, (data ?? []).map((r) => r.test_label as string | null))
  } catch {
    /* ignore */
  }
}
