export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { exclusionId, scheduleId } = await req.json()
  if (!exclusionId || !scheduleId) {
    return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Verify exclusion still published
  const { data: exclusion } = await admin
    .from('schedule_exclusions')
    .select('id, publish_spot, excluded_date')
    .eq('id', exclusionId)
    .single()

  if (!exclusion || !exclusion.publish_spot) {
    return NextResponse.json({ error: 'Este hueco ya no está disponible' }, { status: 409 })
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

  // Mark spot as taken (prevents concurrent double-booking)
  const { error: spotErr } = await admin
    .from('schedule_exclusions')
    .update({ publish_spot: false })
    .eq('id', exclusionId)
    .eq('publish_spot', true)

  if (spotErr) {
    return NextResponse.json({ error: 'Este hueco ya no está disponible' }, { status: 409 })
  }

  // Upsert booking — update to confirmed if already exists (e.g. previously cancelled)
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
      // Rollback spot availability
      await admin.from('schedule_exclusions').update({ publish_spot: true }).eq('id', exclusionId)
      return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
    }
    bookingId = newBooking.id
  }

  // Decrement bag
  await admin
    .from('class_bag')
    .update({ balance: bag.balance - 1, updated_at: new Date().toISOString() })
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
  })

  return NextResponse.json({ ok: true, newBalance: bag.balance - 1 })
}
