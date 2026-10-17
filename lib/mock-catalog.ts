import { supabaseAdmin } from '@/lib/supabase'

/** Question counts per mock label. */
export type MockCounts = Map<string, { readingCount: number; mathCount: number }>

// The question counts are the same for every student, but building them means scanning every question
// row. Keep them in memory for a short while; admin writes that change questions call invalidateCounts().
// (Mock SETTINGS are never cached — they are one small query, and the admin must see changes at once.)
const TTL_MS = 30_000
let cache: { at: number; data: MockCounts } | null = null
let inflight: Promise<MockCounts> | null = null

export function invalidateCounts() {
  cache = null
}

async function scan(supabase: ReturnType<typeof supabaseAdmin>): Promise<MockCounts> {
  const PAGE = 1000
  // How many rows there are → every page is fetched AT THE SAME TIME (it used to be one page after another:
  // 10,000 questions = 10 round trips in a row, which made the admin panel slow to open).
  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).not('test_label', 'is', null)
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))
  const parts = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .from('questions')
        .select('kind, test_label')
        .not('test_label', 'is', null)
        .order('id', { ascending: true })
        .range(i * PAGE, i * PAGE + PAGE - 1),
    ),
  )
  const byLabel: MockCounts = new Map()
  for (const { data } of parts) {
    for (const row of data ?? []) {
      const label = row.test_label as string
      const bucket = byLabel.get(label) ?? { readingCount: 0, mathCount: 0 }
      if (row.kind === 'reading') bucket.readingCount++
      else if (row.kind === 'math') bucket.mathCount++
      byLabel.set(label, bucket)
    }
  }
  return byLabel
}

export async function loadCounts(supabase: ReturnType<typeof supabaseAdmin>, fresh = false): Promise<MockCounts> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.data
  if (!fresh && inflight) return inflight
  inflight = scan(supabase)
    .then((data) => {
      cache = { at: Date.now(), data }
      return data
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}
