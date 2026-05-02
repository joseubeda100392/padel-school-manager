import { createClient } from '@/lib/supabase/server'

export async function getClubId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const role = user.user_metadata?.role
  if (role === 'super_admin') return null

  const clubId = user.user_metadata?.club_id
  if (clubId) return clubId

  // Fallback: leer de la tabla users si no está en metadata
  const { data } = await supabase
    .from('users')
    .select('club_id')
    .eq('id', user.id)
    .single()

  return data?.club_id ?? null
}

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.role === 'super_admin'
}
