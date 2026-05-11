export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { scheduleId, date } = await req.json()
  if (!scheduleId || !date) return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 })

  const admin = getAdminClient()

  // Verify schedule exists and still has capacity
  const { data: schedule } = await admin
    .from('schedules')
    .select('id, max_students')
    .eq('id', scheduleId)
    .single()

  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  const [{ count: enrolledCount }, { count: spotBookingCount }] = await Promise.all([
    admin
      .from('group_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('schedule_id', scheduleId)
      .eq('status', 'active'),
    admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('schedule_id', scheduleId)
      .eq('class_date', date)
      .eq('status', 'confirmed'),
  ])

  if ((enrolledCount ?? 0) + (spotBookingCount ?? 0) >= schedule.max_students) {
    return NextResponse.json({ error: 'La clase ya está completa' }, { status: 409 })
  }

  // Check not already booked for this date
  const { data: existing } = await admin
    .from('bookings')
    .select('id, status')
    .eq('schedule_id', scheduleId)
    .eq('student_id', user.id)
    .eq('class_date', date)
    .maybeSingle()

  if (existing && existing.status === 'confirmed') {
    return NextResponse.json({ error: 'Ya tienes esta plaza reservada' }, { status: 409 })
  }

  // Check bag balance
  const { data: bag } = await admin
    .from('class_bag')
    .select('id, balance')
    .eq('user_id', user.id)
    .single()

  if (!bag || bag.balance <= 0) {
    return NextResponse.json({ error: 'No tienes clases disponibles en tu bolsa' }, { status: 400 })
  }

  // Create booking
  const { data: booking, error: bookErr } = await admin
    .from('bookings')
    .insert({
      schedule_id: scheduleId,
      student_id: user.id,
      status: 'confirmed',
      source: 'bag',
      class_date: date,
    })
    .select('id')
    .single()

  if (bookErr || !booking) {
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
  }

  // Decrement bag
  await admin
    .from('class_bag')
    .update({ balance: bag.balance - 1, updated_at: new Date().toISOString() })
    .eq('id', bag.id)

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long',
  })

  await admin.from('bag_transactions').insert({
    user_id: user.id,
    class_bag_id: bag.id,
    delta: -1,
    type: 'debit',
    reason: `Plaza libre del ${dateLabel}`,
    booking_id: booking.id,
  })

  return NextResponse.json({ ok: true, newBalance: bag.balance - 1 })
}
