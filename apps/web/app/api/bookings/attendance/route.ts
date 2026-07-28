export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin', 'coach'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { bookingId, status } = await req.json()
  if (!bookingId || !['confirmed', 'no_show'].includes(status)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, schedule_id, club_id')
    .eq('id', bookingId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  if (caller.role === 'coach') {
    const { data: schedule } = await admin
      .from('schedules')
      .select('coach_id')
      .eq('id', booking.schedule_id)
      .single()
    if (!schedule || schedule.coach_id !== user.id) {
      return NextResponse.json({ error: 'Sin permisos para esta clase' }, { status: 403 })
    }
  } else if (caller.role === 'admin') {
    if (booking.club_id && booking.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
  }

  const { error } = await admin.from('bookings').update({ status }).eq('id', bookingId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
