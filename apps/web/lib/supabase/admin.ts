import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — created on first call (request time, not module init time,
// so build doesn't fail when env vars aren't available yet), then reused for
// the life of the server process instead of opening a fresh client per call.
let cached: SupabaseClient | null = null

export function getAdminClient() {
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return cached
}
