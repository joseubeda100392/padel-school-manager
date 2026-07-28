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
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { scheduleIds } = await req.json()
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    return NextResponse.json({ error: 'scheduleIds requerido' }, { status: 400 })
  }

  if (caller.role !== 'super_admin' && caller.club_id) {
    const { data: schedules } = await admin
      .from('schedules')
      .select('id, club_id')
      .in('id', scheduleIds)

    const foreign = (schedules ?? []).filter((s: any) => s.club_id !== caller.club_id)
    if (foreign.length > 0) {
      return NextResponse.json({ error: 'Sin permisos para borrar algunos horarios' }, { status: 403 })
    }
  }

  const { data: enrollments } = await admin.from('group_enrollments').select('id').in('schedule_id', scheduleIds)
  if (enrollments && enrollments.length > 0) {
    const { error: exclErr } = await admin.from('schedule_exclusions').delete().in('group_enrollment_id', enrollments.map((e: any) => e.id))
    if (exclErr) return NextResponse.json({ error: `Error al borrar exclusiones: ${exclErr.message}` }, { status: 500 })
  }
  const { error: enrollErr } = await admin.from('group_enrollments').delete().in('schedule_id', scheduleIds)
  if (enrollErr) return NextResponse.json({ error: `Error al borrar inscripciones: ${enrollErr.message}` }, { status: 500 })

  const { data: bookings } = await admin.from('bookings').select('id').in('schedule_id', scheduleIds)
  if (bookings && bookings.length > 0) {
    const bookingIds = bookings.map((b: any) => b.id)
    const { error: txErr } = await admin.from('bag_transactions').delete().in('booking_id', bookingIds)
    if (txErr) return NextResponse.json({ error: `Error al borrar transacciones: ${txErr.message}` }, { status: 500 })
    const { error: payErr } = await admin.from('payments').delete().in('booking_id', bookingIds)
    if (payErr) return NextResponse.json({ error: `Error al borrar pagos: ${payErr.message}` }, { status: 500 })
  }
  const { error: bookErr } = await admin.from('bookings').delete().in('schedule_id', scheduleIds)
  if (bookErr) return NextResponse.json({ error: `Error al borrar reservas: ${bookErr.message}` }, { status: 500 })
  await admin.from('makeups').update({ original_schedule_id: null }).in('original_schedule_id', scheduleIds)
  await admin.from('makeups').update({ makeup_schedule_id: null }).in('makeup_schedule_id', scheduleIds)
  const { error: schedErr } = await admin.from('schedules').delete().in('id', scheduleIds)
  if (schedErr) return NextResponse.json({ error: `Error al borrar horarios: ${schedErr.message}` }, { status: 500 })

  return NextResponse.json({ ok: true })
}
