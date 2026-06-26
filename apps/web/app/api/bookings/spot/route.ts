export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { exclusionId, scheduleId } = await req.json()
  if (!exclusionId || !scheduleId) {
    return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 })
  }

  const admin = getAdminClient()

  const [{ data: exclusion }, { data: schedule }, { data: inGroup }] = await Promise.all([
    admin.from('schedule_exclusions').select('id, publish_spot, excluded_date').eq('id', exclusionId).single(),
    admin.from('schedules').select('start_time, end_time').eq('id', scheduleId).single(),
    admin.from('group_enrollments').select('id').eq('schedule_id', scheduleId).eq('student_id', user.id).eq('status', 'active').maybeSingle(),
  ])

  if (inGroup) {
    return NextResponse.json({ error: 'Ya formas parte del grupo fijo de esta clase' }, { status: 409 })
  }

  if (!exclusion || !exclusion.publish_spot) {
    return NextResponse.json({ error: 'Este hueco ya no está disponible' }, { status: 409 })
  }

  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  // Overlap check
  const { data: existingSpot } = await admin
    .from('bookings')
    .select('schedule_id, schedules(start_time, end_time)')
    .eq('student_id', user.id)
    .neq('status', 'cancelled')
    .neq('schedule_id', scheduleId)

  const nStart = new Date(schedule.start_time)
  const nEnd = new Date(schedule.end_time)
  const nDow = nStart.getUTCDay()
  const nStartMin = nStart.getUTCHours() * 60 + nStart.getUTCMinutes()
  const nEndMin = nEnd.getUTCHours() * 60 + nEnd.getUTCMinutes()

  for (const b of existingSpot ?? []) {
    const s = (b as any).schedules
    if (!s) continue
    const sStart = new Date(s.start_time)
    const sEnd = new Date(s.end_time)
    if (sStart.getUTCDay() === nDow) {
      const sStartMin = sStart.getUTCHours() * 60 + sStart.getUTCMinutes()
      const sEndMin = sEnd.getUTCHours() * 60 + sEnd.getUTCMinutes()
      if (sStartMin < nEndMin && sEndMin > nStartMin) {
        return NextResponse.json({ error: 'Ya tienes una clase en ese horario' }, { status: 409 })
      }
    }
  }

  const durationMin = Math.round((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000)
  const durationType: '60' | '90' = durationMin >= 80 ? '90' : '60'

  const { data: bag } = await admin
    .from('class_bag')
    .select('id, balance_60, balance_90')
    .eq('user_id', user.id)
    .single()

  // 90min: solo balance_90 / 60min: balance_60 primero, balance_90 como respaldo
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

  // Mark spot as taken (prevents concurrent double-booking)
  const { error: spotErr } = await admin
    .from('schedule_exclusions')
    .update({ publish_spot: false })
    .eq('id', exclusionId)
    .eq('publish_spot', true)

  if (spotErr) {
    return NextResponse.json({ error: 'Este hueco ya no está disponible' }, { status: 409 })
  }

  // Upsert booking
  const { data: existingBooking } = await admin
    .from('bookings')
    .select('id, status')
    .eq('schedule_id', scheduleId)
    .eq('student_id', user.id)
    .maybeSingle()

  let bookingId: string

  if (existingBooking) {
    await admin
      .from('bookings')
      .update({ status: 'confirmed', source: 'bag', updated_at: new Date().toISOString() })
      .eq('id', existingBooking.id)
    bookingId = existingBooking.id
  } else {
    const { data: newBooking, error: bookErr } = await admin
      .from('bookings')
      .insert({ schedule_id: scheduleId, student_id: user.id, status: 'confirmed', source: 'bag' })
      .select('id')
      .single()

    if (bookErr || !newBooking) {
      await admin.from('schedule_exclusions').update({ publish_spot: true }).eq('id', exclusionId)
      return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
    }
    bookingId = newBooking.id
  }

  // Decrement correct balance
  const newBal60 = useBalance90 ? bag.balance_60 : bag.balance_60 - 1
  const newBal90 = useBalance90 ? bag.balance_90 - 1 : bag.balance_90

  await admin
    .from('class_bag')
    .update({ balance_60: newBal60, balance_90: newBal90, updated_at: new Date().toISOString() })
    .eq('id', bag.id)

  const dateLabel = new Date(exclusion.excluded_date + 'T12:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long',
  })

  await admin.from('bag_transactions').insert({
    user_id: user.id,
    class_bag_id: bag.id,
    delta: -1,
    type: 'debit',
    reason: `Hueco libre del ${dateLabel}`,
    booking_id: bookingId,
    class_duration: durationType,
  })

  return NextResponse.json({ ok: true, newBalance: newBal60 + newBal90 })
}
