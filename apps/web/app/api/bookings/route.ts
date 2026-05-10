export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const adminSupabase = () => createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { scheduleId } = await req.json()
  if (!scheduleId) return NextResponse.json({ error: 'Falta scheduleId' }, { status: 400 })

  const admin = adminSupabase()
  const { data, error } = await admin.rpc('book_with_bag', {
    p_schedule_id: scheduleId,
    p_student_id: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 })
  return NextResponse.json({ ok: true, bookingId: data.booking_id, newBalance: data.new_balance })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { scheduleId, refundBag } = await req.json()
  const admin = adminSupabase()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, source')
    .eq('schedule_id', scheduleId)
    .eq('student_id', user.id)
    .neq('status', 'cancelled')
    .single()

  if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  await admin.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)

  if (refundBag && booking.source === 'bag') {
    const { data: bag } = await admin.from('class_bag').select('id, balance').eq('user_id', user.id).single()
    if (bag) {
      await admin.from('class_bag').update({ balance: bag.balance + 1, updated_at: new Date().toISOString() }).eq('id', bag.id)
      await admin.from('bag_transactions').insert({
        user_id: user.id,
        class_bag_id: bag.id,
        delta: 1,
        type: 'credit',
        reason: 'Cancelación de clase',
        booking_id: booking.id,
      })
      return NextResponse.json({ ok: true, newBalance: bag.balance + 1 })
    }
  }

  return NextResponse.json({ ok: true })
}
