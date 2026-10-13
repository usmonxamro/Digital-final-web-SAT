import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client, used exclusively inside API routes and
 * Server Components. Uses the service role key, which bypasses Row Level
 * Security — never import this file from a 'use client' component.
 *
 * SETUP (Usmon):
 * 1. Create a free project at https://supabase.com
 * 2. Project Settings → API → copy "Project URL" and "service_role" key
 * 3. Put them in .env.local as SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * 4. Run the SQL in supabase/schema.sql (Supabase dashboard → SQL Editor)
 */
function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill in your Supabase project details.`,
    )
  }
  return value
}

export function supabaseAdmin() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
