// @ts-ignore - cache exists in React 18.3 runtime; @types/react version varies by environment
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Una sola comprobación de sesión y una sola lectura del perfil por petición,
// aunque la página llame a getClubId() e isSuperAdmin() a la vez.
const getAuthProfile = cache(async (): Promise<{ role: string | null; club_id: string | null } | null> => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, club_id').eq('id', user.id).single()
  if (!data) return null
  return { role: (data.role as string) ?? null, club_id: (data.club_id as string) ?? null }
})

export const getClubId = cache(async (): Promise<string | null> => {
  const profile = await getAuthProfile()
  if (!profile) return null

  if (profile.role === 'super_admin') {
    const cookieStore = cookies()
    return cookieStore.get('sa_active_club')?.value ?? null
  }

  return profile.club_id
})

export const isSuperAdmin = cache(async (): Promise<boolean> => {
  const profile = await getAuthProfile()
  return profile?.role === 'super_admin'
})

// Las fichas del panel que leen con la clave de servicio deben comprobar que
// lo que se abre es del club del admin: con un enlace de otro club, un admin
// veía sus alumnos. El super admin entra en todos (con o sin club activo).
export async function canAccessClub(resourceClubId: string | null | undefined): Promise<boolean> {
  if (await isSuperAdmin()) return true
  const clubId = await getClubId()
  return !!clubId && clubId === resourceClubId
}
