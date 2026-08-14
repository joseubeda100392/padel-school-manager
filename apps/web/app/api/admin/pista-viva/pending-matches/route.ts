export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { PlaytomicOfficialClient, getMatchLevelRange } from '@/lib/playtomic'

function formatMadrid(isoNoTz: string): string {
  const utcDate = new Date(isoNoTz.endsWith('Z') ? isoNoTz : isoNoTz + 'Z')
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(utcDate)
}

// Comprobación en vivo (a demanda del admin) de los partidos abiertos que
// ahora mismo necesitan jugadores — mismo cálculo de nivel que usa el cron
// de detección, sin guardar nada ni notificar a nadie. Solo lectura.
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
    return NextResponse.json({ error: 'Configura las credenciales oficiales de Playtomic en Settings → Playtomic' }, { status: 400 })
  }

  const ptClient = new PlaytomicOfficialClient()
  try {
    await ptClient.login(club.playtomic_client_id, club.playtomic_client_secret)
  } catch (e: any) {
    return NextResponse.json({ error: 'Error de autenticación con Playtomic: ' + e.message }, { status: 502 })
  }

  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 19)

  let pending: any[]
  try {
    pending = await ptClient.getVenuePendingOpenMatches(club.playtomic_tenant_id, fmt(yesterday), fmt(in14Days))
  } catch (e: any) {
    return NextResponse.json({ error: 'Error al consultar Playtomic: ' + e.message }, { status: 502 })
  }

  const matches = await Promise.all(
    pending.map(async (m: any) => {
      const participants = m.participant_info?.participants ?? []
      const levelRange = await getMatchLevelRange(ptClient, club.playtomic_tenant_id!, participants)
      return {
        booking_id: m.booking_id,
        court_name: m.resource_name ?? null,
        start_label: formatMadrid(m.booking_start_date),
        num_participantes: participants.length,
        faltan: 4 - participants.length,
        level_min: levelRange?.min ?? null,
        level_max: levelRange?.max ?? null,
      }
    }),
  )

  return NextResponse.json({ matches })
}
