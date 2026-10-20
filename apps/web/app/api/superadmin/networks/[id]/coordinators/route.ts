export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getNetworkById } from '@/lib/network'

type Admin = ReturnType<typeof getAdminClient>

// Solo el super admin nombra y quita coordinadores de una red.
async function requireSuperAdmin(): Promise<{ admin: Admin } | NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  return { admin }
}

const addSchema = z.union([
  // Un admin que ya existe en una sede de la red (p. ej. Sergio).
  z.object({ userId: z.string().uuid() }),
  // Una persona nueva que solo coordina.
  z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(6).max(72),
  }),
])

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  const network = await getNetworkById(admin, params.id)
  if (!network || !network.clubs.length) return NextResponse.json({ error: 'Red sin sedes' }, { status: 404 })

  const { data: body, error: badRequest } = await parseBody(req, addSchema)
  if (badRequest) return badRequest

  if ('userId' in body) {
    const { data: person } = await admin.from('users').select('id, role, club_id, is_active').eq('id', body.userId).single()
    if (!person || person.role !== 'admin' || !person.is_active || !network.clubs.some(c => c.id === person.club_id)) {
      return NextResponse.json({ error: 'Tiene que ser admin de una sede de esta red' }, { status: 400 })
    }
    const { error } = await admin.from('network_coordinators').insert({ user_id: person.id, network_id: network.id, only_coordinator: false, home_club_id: person.club_id })
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'Ya coordina una red' : 'No se ha podido añadir' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // Persona nueva: cuenta de admin aparcada en la primera sede (la app le
  // trata como admin de la sede en la que entre) y marcada como solo coordinador.
  const homeClubId = network.clubs[0].id
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { name: body.name, role: 'admin', club_id: homeClubId },
  })
  if (authError || !authData.user) {
    const exists = /already|registered|exists/i.test(authError?.message ?? '')
    return NextResponse.json({ error: exists ? 'Ya hay una cuenta con ese email' : 'No se ha podido crear la cuenta' }, { status: 400 })
  }
  const userId = authData.user.id
  const { error: dbError } = await admin.from('users').insert({
    id: userId, email: body.email, name: body.name, role: 'admin', club_id: homeClubId, is_active: true, force_password_change: true,
  })
  const { error: coordError } = dbError
    ? { error: dbError }
    : await admin.from('network_coordinators').insert({ user_id: userId, network_id: network.id, only_coordinator: true, home_club_id: homeClubId })
  if (dbError || coordError) {
    console.error('[coordinators] alta fallida:', (dbError ?? coordError)?.message)
    await admin.from('users').delete().eq('id', userId)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'No se ha podido crear el coordinador' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin()
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  const { data: body, error: badRequest } = await parseBody(req, z.object({ userId: z.string().uuid() }))
  if (badRequest) return badRequest

  const { data: link } = await admin
    .from('network_coordinators')
    .select('only_coordinator, home_club_id')
    .eq('user_id', body.userId)
    .eq('network_id', params.id)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'No coordina esta red' }, { status: 404 })

  await admin.from('network_coordinators').delete().eq('user_id', body.userId).eq('network_id', params.id)
  // Si solo coordinaba, su cuenta ya no tiene función: se desactiva y no
  // puede volver a entrar.
  if (link.only_coordinator) {
    await admin.from('users').update({ is_active: false }).eq('id', body.userId)
    await admin.auth.admin.updateUserById(body.userId, { ban_duration: '876000h' })
  } else if (link.home_club_id) {
    await admin.from('users').update({ club_id: link.home_club_id }).eq('id', body.userId)
  }
  return NextResponse.json({ ok: true })
}
