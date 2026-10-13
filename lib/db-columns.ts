/** True when a Supabase/PostgREST error says `column` doesn't exist yet —
 *  i.e. the v36 SQL in supabase/schema.sql hasn't been run on this project. */
export function isMissingColumn(error: { message?: string; code?: string } | null | undefined, column: string) {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    msg.includes(column.toLowerCase()) &&
    (error.code === 'PGRST204' || error.code === '42703' || msg.includes('does not exist') || msg.includes('schema cache'))
  )
}

export const MIGRATION_HINT =
  "Bazada yangi ustun yo'q: Supabase → SQL Editor'da supabase/schema.sql faylining oxiridagi v36 qismini bir marta ishga tushiring."
