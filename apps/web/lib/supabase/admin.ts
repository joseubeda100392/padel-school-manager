import { createClient } from '@supabase/supabase-js'

// Factory function — creates client at request time, not module init time.
// This avoids build errors when env vars are not available during next build.
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
