export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { PlaytomicOfficialClient } from '@/lib/playtomic'
import { getClubFeatures } from '@/lib/get-club-features'

const PROFILE_URL_RE = /\/profile\/user\/(\d+)/

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { profileUrl } = await req.json()
  const match = typeof profileUrl === 'string' ? profileUrl.match(PROFILE_URL_RE) : null
  if (!match) {
    return NextResponse.json({ error: 'Enlace de perfil de Playtomic no válido. Copia el enlace desde "Compartir perfil" en la app de Playtomic.' }, { status: 400 })
  }
  const playerId = match[1]

  const admin = getAdminClient()
  const { data: me } = await admin.from('users').select('club_id').eq('id', user.id).single()
  if (!me?.club_id) return NextResponse.json({ error: 'Club no encontrado' }, { status: 400 })

  const features = await getClubFeatures(me.club_id)
  if (!features.enable_pista_viva) {
    return NextResponse.json({ error: 'Pista Viva no está activo en tu club' }, { status: 403 })
  }

  const { data: club } = await admin
    .from('clubs')
    .select('playtomic_client_id, playtomic_client_secret, playtomic_tenant_id')
    .eq('id', me.club_id)
    .single()

  if (!club?.playtomic_client_id || !club?.playtomic_client_secret || !club?.playtomic_tenant_id) {
    return NextResponse.json({ error: 'Tu club aún no tiene Playtomic configurado' }, { status: 400 })
  }

  const ptClient = new PlaytomicOfficialClient()
  try {
    await ptClient.login(club.playtomic_client_id, club.playtomic_client_secret)
  } catch {
    return NextResponse.json({ error: 'Error al conectar con Playtomic' }, { status: 502 })
  }

  let player
  try {
    player = await ptClient.getPlayerById(club.playtomic_tenant_id, playerId)
  } catch {
    return NextResponse.json({ error: 'Error al consultar tu perfil en Playtomic' }, { status: 502 })
  }
  if (!player) {
    return NextResponse.json({ error: 'No encontramos ese perfil en tu club de Playtomic' }, { status: 404 })
  }

  await admin.from('users').update({
    playtomic_player_id: playerId,
    playtomic_level: player.level ?? null,
    pista_viva_optin: true,
  }).eq('id', user.id)

  return NextResponse.json({ ok: true, level: player.level ?? null })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  await admin.from('users').update({ pista_viva_optin: false }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
