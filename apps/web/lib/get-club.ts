import { createClient } from '@/lib/supabase/server'

export async function getClubId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, club_id').eq('id', user.id).single()
  if (!data || data.role === 'super_admin') return null
  return (data.club_id as string) ?? null
}

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'super_admin'
}
