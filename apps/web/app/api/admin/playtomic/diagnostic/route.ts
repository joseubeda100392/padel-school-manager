export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { PlaytomicOfficialClient } from '@/lib/playtomic'

// Endpoint de solo lectura y solo diagnóstico: nunca escribe en la base de
// datos. Sirve para inspeccionar qué devuelve de verdad la API oficial de
// Playtomic (jugadores y reservas/partidos) antes de construir lógica de
// negocio sobre un shape de respuesta no confirmado por documentación.
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

  const ptClient = new PlaytomicOfficialClient()
  try {
    await ptClient.login(club.playtomic_client_id, club.playtomic_client_secret)
  } catch (e: any) {
    return NextResponse.json({ error: 'Error de autenticación con la API de Playtomic: ' + e.message }, { status: 502 })
  }

  const result: {
    players?: unknown
    playersError?: string
    pendingOpenMatches?: unknown
    allOpenMatches?: unknown
    bookingsTotal?: number
    bookingTypeCounts?: Record<string, number>
    bookingsError?: string
  } = {}

  try {
    result.players = await ptClient.getVenuePlayersSample(club.playtomic_tenant_id, 10)
  } catch (e: any) {
    result.playersError = e.message
  }

  try {
    const now = new Date()
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const toBookingDate = (d: Date) => d.toISOString().slice(0, 19)
    const startBookingDate = toBookingDate(now)
    const endBookingDate = toBookingDate(in14Days)

    const allBookings = await ptClient.getVenueBookingsRaw(club.playtomic_tenant_id, startBookingDate, endBookingDate)
    result.bookingsTotal = allBookings.length
    result.bookingTypeCounts = allBookings.reduce((acc: Record<string, number>, b: any) => {
      const key = `${b.booking_type}${b.is_canceled ? ' (cancelado)' : ''}`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    result.pendingOpenMatches = allBookings
      .filter((b: any) =>
        b.booking_type === 'OPEN_MATCH' &&
        !b.is_canceled &&
        b.payment_status !== 'PAID' &&
        b.payment_status !== 'VOID' &&
        b.payment_status !== 'REFUNDED',
      )
      .map((b: any) => ({
        booking_id: b.booking_id,
        booking_start_date: b.booking_start_date,
        resource_name: b.resource_name,
        status: b.status,
        payment_status: b.payment_status,
        faltan: 4 - (b.participant_info?.participants ?? []).length,
        participantes: (b.participant_info?.participants ?? []).map((p: any) => ({ name: p.name, email: p.email })),
      }))
    // Todos los OPEN_MATCH sin filtrar por resource_id/cancelación — para
    // comparar campo a campo con lo que se ve en Manager y averiguar qué
    // campo real distingue "pendiente" de "cerrado" (resource_id no basta).
    result.allOpenMatches = allBookings
      .filter((b: any) => b.booking_type === 'OPEN_MATCH')
      .map((b: any) => ({
        booking_id: b.booking_id,
        booking_start_date: b.booking_start_date,
        resource_id: b.resource_id,
        resource_name: b.resource_name,
        status: b.status,
        is_canceled: b.is_canceled,
        payment_status: b.payment_status,
        num_participantes: (b.participant_info?.participants ?? []).length,
        participantes: (b.participant_info?.participants ?? []).map((p: any) => ({ name: p.name, email: p.email, tipo: p.participant_type })),
      }))
  } catch (e: any) {
    result.bookingsError = e.message
  }

  return NextResponse.json(result)
}
