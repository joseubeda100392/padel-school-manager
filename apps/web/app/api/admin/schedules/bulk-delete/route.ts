export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
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

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleIds: z.array(z.string().uuid()).min(1).max(200),
  }))
  if (badRequest) return badRequest
  const { scheduleIds } = body

  if (caller.role !== 'super_admin') {
    if (!caller.club_id) return NextResponse.json({ error: 'Sin permisos (sin club asignado)' }, { status: 403 })
    const { data: schedules } = await admin
      .from('schedules')
      .select('id, club_id')
      .in('id', scheduleIds)

    const foreign = (schedules ?? []).filter((s: any) => s.club_id !== caller.club_id)
    if (foreign.length > 0) {
      return NextResponse.json({ error: 'Sin permisos para borrar algunos horarios' }, { status: 403 })
    }
  }

  // Step 1: get dependent IDs in parallel
  const [enrollmentsRes, bookingsRes] = await Promise.all([
    admin.from('group_enrollments').select('id').in('schedule_id', scheduleIds),
    admin.from('bookings').select('id').in('schedule_id', scheduleIds),
  ])
  const enrollmentIds = (enrollmentsRes.data ?? []).map((e: any) => e.id)
  const bookingIds = (bookingsRes.data ?? []).map((b: any) => b.id)

  // Step 2: delete leaf rows in parallel
  const [exclRes, txRes, payRes] = await Promise.all([
    enrollmentIds.length > 0
      ? admin.from('schedule_exclusions').delete().in('group_enrollment_id', enrollmentIds)
      : Promise.resolve({ error: null as null }),
    bookingIds.length > 0
      ? admin.from('bag_transactions').delete().in('booking_id', bookingIds)
      : Promise.resolve({ error: null as null }),
    bookingIds.length > 0
      ? admin.from('payments').delete().in('booking_id', bookingIds)
      : Promise.resolve({ error: null as null }),
  ])
  if (exclRes.error) return NextResponse.json({ error: 'Error al borrar exclusiones' }, { status: 500 })
  if (txRes.error) return NextResponse.json({ error: 'Error al borrar transacciones' }, { status: 500 })
  if (payRes.error) return NextResponse.json({ error: 'Error al borrar pagos' }, { status: 500 })

  // Step 3: delete FK rows + null makeups in parallel
  const [enrollRes, bookRes] = await Promise.all([
    admin.from('group_enrollments').delete().in('schedule_id', scheduleIds),
    admin.from('bookings').delete().in('schedule_id', scheduleIds),
    admin.from('makeups').update({ original_schedule_id: null }).in('original_schedule_id', scheduleIds),
    admin.from('makeups').update({ makeup_schedule_id: null }).in('makeup_schedule_id', scheduleIds),
  ])
  if (enrollRes.error) return NextResponse.json({ error: 'Error al borrar inscripciones' }, { status: 500 })
  if (bookRes.error) return NextResponse.json({ error: 'Error al borrar reservas' }, { status: 500 })

  // Step 4: delete schedules
  const { error: schedErr } = await admin.from('schedules').delete().in('id', scheduleIds)
  if (schedErr) return NextResponse.json({ error: 'Error al borrar horarios' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
