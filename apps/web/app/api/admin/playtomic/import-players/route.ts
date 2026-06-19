export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { PlaytomicOfficialClient } from '@/lib/playtomic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const cookieStore = cookies()
  const clubId = caller.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? caller.club_id)
    : caller.club_id
  if (!clubId) return NextResponse.json({ error: 'Club no encontrado' }, { status: 400 })

  const { data: club } = await admin
    .from('clubs')
    .select('playtomic_client_id, playtomic_client_secret, playtomic_tenant_id')
    .eq('id', clubId)
    .single()

  if (!club?.playtomic_client_id || !club?.playtomic_client_secret || !club?.playtomic_tenant_id) {
    return NextResponse.json({ error: 'Configura el Client ID y Client Secret de la API de Playtomic en Settings → Playtomic' }, { status: 400 })
  }

  // Auth con la API oficial de Playtomic
  const ptClient = new PlaytomicOfficialClient()
  try {
    await ptClient.login(club.playtomic_client_id, club.playtomic_client_secret)
  } catch (e: any) {
    return NextResponse.json({ error: `Auth Playtomic API falló: ${e.message}` }, { status: 502 })
  }

  // Traer todos los jugadores del venue
  let players
  try {
    players = await ptClient.getVenuePlayers(club.playtomic_tenant_id)
  } catch (e: any) {
    return NextResponse.json({ error: `Error obteniendo jugadores: ${e.message}` }, { status: 502 })
  }

  if (!players.length) {
    return NextResponse.json({ imported: 0, skipped: 0, errors: 0, message: 'No se encontraron jugadores en el venue de Playtomic' })
  }

  // Obtener emails ya existentes en este club
  const { data: existingUsers } = await admin
    .from('users')
    .select('email')
    .eq('club_id', clubId)

  const existingEmails = new Set((existingUsers ?? []).map((u) => u.email?.toLowerCase()))

  let imported = 0
  let skipped = 0
  let errors = 0

  for (const player of players) {
    if (!player.email) { errors++; continue }
    const email = player.email.toLowerCase()

    if (existingEmails.has(email)) { skipped++; continue }

    try {
      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: player.name, imported_from: 'playtomic' },
      })
      if (authError || !authData.user) { errors++; continue }

      // Crear registro en users
      const { error: insertError } = await admin.from('users').insert({
        id: authData.user.id,
        email,
        name: player.name || email,
        phone: player.phone ?? null,
        role: 'student',
        club_id: clubId,
      })
      if (insertError) { errors++; continue }

      existingEmails.add(email)
      imported++
    } catch {
      errors++
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    errors,
    total: players.length,
    message: `${imported} importados, ${skipped} ya existían, ${errors} errores`,
  })
}
