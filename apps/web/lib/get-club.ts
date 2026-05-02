import { createClient } from '@/lib/supabase/server'

export async function getClubId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (user.user_metadata?.role === 'super_admin') return null
  return (user.user_metadata?.club_id as string) ?? null
}

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.role === 'super_admin'
}
