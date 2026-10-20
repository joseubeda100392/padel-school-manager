export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getCoordinatorNetwork } from '@/lib/network'

// El coordinador de una red pasa a gestionar otra sede de SU red. Nunca deja
// ir a un club de fuera: la sede tiene que estar en la red que tiene asignada
// en network_coordinators (que solo se escribe desde el servidor).
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: body, error: badRequest } = await parseBody(req, z.object({ clubId: z.string().uuid() }))
  if (badRequest) return badRequest

  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const network = await getCoordinatorNetwork(admin, user.id)
  if (!network || !network.clubs.some(c => c.id === body.clubId)) {
    return NextResponse.json({ error: 'Esa sede no es de tu red' }, { status: 403 })
  }

  if (profile.club_id !== body.clubId) {
    const { error } = await admin.from('users').update({ club_id: body.clubId }).eq('id', user.id)
    if (error) {
      console.error('[switch-club] update failed:', error.message)
      return NextResponse.json({ error: 'No se ha podido cambiar de sede' }, { status: 500 })
    }
  }
  // Ya ha elegido sede en esta sesión: el Panel le lleva a la sede y no a la
  // vista de la red (ver app/dashboard/page.tsx).
  cookies().set('coord_site_chosen', '1', { httpOnly: true, sameSite: 'lax', path: '/' })
  return NextResponse.json({ ok: true })
}
