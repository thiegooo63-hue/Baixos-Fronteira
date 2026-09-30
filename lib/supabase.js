import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://voxvkfumjufhydfdqzoc.supabase.co'

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_50GX6ORHnfFl1aUmtFSZNA_2SaECJDv'

let browserClient

export function getSupabase() {
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  }

  return browserClient
}
