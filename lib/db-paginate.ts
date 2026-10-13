/**
 * Supabase returns at most 1000 rows per request; this pages through a query
 * (`make(from, to)` must apply `.range(from, to)`) up to `max` rows.
 */
export async function fetchAll<T>(
  make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  max = 100_000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await make(from, from + PAGE - 1)
    if (error) return { data: out, error }
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return { data: out, error: null }
}
