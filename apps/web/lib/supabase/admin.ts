import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Use for all data queries in server components.
// Auth (who is logged in) always uses the session client from @/lib/supabase/server.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
