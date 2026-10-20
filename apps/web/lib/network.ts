// Redes de clubs (p. ej. X7: X7 PINTO y X7 MURCIA). El coordinador es un
// admin normal que además puede cambiar de sede dentro de su red; al hacerlo,
// su users.club_id pasa a esa sede y la app le trata como admin de ella.
// network_coordinators solo se lee con la clave de servicio (RLS sin políticas).

import { getAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof getAdminClient>

export interface CoordinatorNetwork {
  id: string
  name: string
  clubs: { id: string; name: string }[]
}

export async function getCoordinatorNetwork(admin: Admin, userId: string): Promise<CoordinatorNetwork | null> {
  const { data: link } = await admin
    .from('network_coordinators')
    .select('network_id')
    .eq('user_id', userId)
    .maybeSingle()
  return link ? getNetworkById(admin, link.network_id) : null
}

export async function getNetworkById(admin: Admin, networkId: string): Promise<CoordinatorNetwork | null> {
  const { data: network } = await admin.from('networks').select('id, name').eq('id', networkId).maybeSingle()
  if (!network) return null
  const { data: clubs } = await admin.from('clubs').select('id, name').eq('network_id', network.id).order('name')
  return { id: network.id, name: network.name, clubs: clubs ?? [] }
}

export interface NetworkCoordinator {
  userId: string
  name: string
  email: string
  onlyCoordinator: boolean
}

export async function listCoordinators(admin: Admin, networkId: string): Promise<NetworkCoordinator[]> {
  const { data } = await admin
    .from('network_coordinators')
    .select('user_id, only_coordinator, user:users(name, email)')
    .eq('network_id', networkId)
  return ((data ?? []) as any[])
    .map(c => ({ userId: c.user_id, name: c.user?.name ?? '—', email: c.user?.email ?? '', onlyCoordinator: c.only_coordinator === true }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Admins de las sedes de la red que todavía no coordinan ninguna red.
export async function listCoordinatorCandidates(admin: Admin, network: CoordinatorNetwork) {
  if (!network.clubs.length) return []
  const [{ data: admins }, { data: taken }] = await Promise.all([
    admin.from('users').select('id, name, email, club_id').eq('role', 'admin').eq('is_active', true).in('club_id', network.clubs.map(c => c.id)).order('name'),
    admin.from('network_coordinators').select('user_id'),
  ])
  const takenIds = new Set((taken ?? []).map(t => t.user_id))
  const clubName = (id: string) => network.clubs.find(c => c.id === id)?.name ?? ''
  return (admins ?? []).filter(a => !takenIds.has(a.id)).map(a => ({ id: a.id, name: a.name ?? a.email, email: a.email, clubName: clubName(a.club_id) }))
}

// Cuentas que solo coordinan (no son admin de ninguna sede): no se listan en
// Usuarios de las sedes.
export async function onlyCoordinatorIds(admin: Admin): Promise<string[]> {
  const { data } = await admin.from('network_coordinators').select('user_id').eq('only_coordinator', true)
  return (data ?? []).map(d => d.user_id)
}
