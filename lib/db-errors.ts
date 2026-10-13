/** True when Postgres/PostgREST says the table doesn't exist (v38 SQL not run yet). */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table/i.test(error.message ?? '')
  )
}
