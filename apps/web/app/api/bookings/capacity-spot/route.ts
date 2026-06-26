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

  const { data: schedule } = await admin
    .from('schedules')
    .select('id, max_students, start_time, end_time')
    .eq('id', scheduleId)
    .single()

  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  // Overlap check
  const { data: existingBookings } = await admin
    .from('bookings')
    .select('schedule_id, schedules(start_time, end_time)')
    .eq('student_id', user.id)
    .eq('class_date', date)
    .neq('status', 'cancelled')
    .neq('schedule_id', scheduleId)

  const nStartMin = new Date(schedule.start_time).getUTCHours() * 60 + new Date(schedule.start_time).getUTCMinutes()
  const nEndMin = new Date(schedule.end_time).getUTCHours() * 60 + new Date(schedule.end_time).getUTCMinutes()
  for (const b of existingBookings ?? []) {
    const s = (b as any).schedules
    if (!s) continue
    const sStartMin = new Date(s.start_time).getUTCHours() * 60 + new Date(s.start_time).getUTCMinutes()
    const sEndMin = new Date(s.end_time).getUTCHours() * 60 + new Date(s.end_time).getUTCMinutes()
    if (sStartMin < nEndMin && sEndMin > nStartMin) {
      return NextResponse.json({ error: 'Ya tienes una clase en ese horario' }, { status: 409 })
    }
  }

  const [{ count: enrolledCount }, { count: spotBookingCount }] = await Promise.all([
    admin.from('group_enrollments').select('id', { count: 'exact', head: true }).eq('schedule_id', scheduleId).eq('status', 'active'),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('schedule_id', scheduleId).eq('class_date', date).eq('status', 'confirmed'),
  ])

  if ((enrolledCount ?? 0) + (spotBookingCount ?? 0) >= schedule.max_students) {
    return NextResponse.json({ error: 'La clase ya está completa' }, { status: 409 })
  }

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

  const durationMin = Math.round((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000)
  const durationType: '60' | '90' = durationMin >= 80 ? '90' : '60'

  const { data: bag } = await admin
    .from('class_bag')
    .select('id, balance_60, balance_90')
    .eq('user_id', user.id)
    .single()

  const hasBalance = durationType === '90'
    ? (bag?.balance_90 ?? 0) > 0
    : ((bag?.balance_60 ?? 0) > 0 || (bag?.balance_90 ?? 0) > 0)

  if (!bag || !hasBalance) {
    const msg = durationType === '90'
      ? 'No tienes bonos de 90min disponibles en tu bolsa'
      : 'No tienes clases disponibles en tu bolsa'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const useBalance90 = durationType === '90' || bag.balance_60 <= 0

  const { data: booking, error: bookErr } = await admin
    .from('bookings')
    .insert({ schedule_id: scheduleId, student_id: user.id, status: 'confirmed', source: 'bag', class_date: date })
    .select('id')
    .single()

  if (bookErr || !booking) {
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
  }

  const newBal60 = useBalance90 ? bag.balance_60 : bag.balance_60 - 1
  const newBal90 = useBalance90 ? bag.balance_90 - 1 : bag.balance_90

  await admin
    .from('class_bag')
    .update({ balance_60: newBal60, balance_90: newBal90, updated_at: new Date().toISOString() })
    .eq('id', bag.id)

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

  await admin.from('bag_transactions').insert({
    user_id: user.id,
    class_bag_id: bag.id,
    delta: -1,
    type: 'debit',
    reason: `Plaza libre del ${dateLabel}`,
    booking_id: booking.id,
    class_duration: durationType,
  })

  return NextResponse.json({ ok: true, newBalance: newBal60 + newBal90 })
}
