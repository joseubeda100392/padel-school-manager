export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { dayBefore, madridToday } from '@/lib/enrollment-window'
import { endEnrollment } from '@/lib/end-enrollment'

const MAX_DAYS_AHEAD = 366

// Quitar una clase recurrente a partir de un día: lastDay es su último día.
// Todo lo anterior (clases dadas, reservas, faltas, horas del monitor) se
// queda como estaba. Desde el día siguiente:
// - la clase deja de repetirse (recurrence_end_date = lastDay);
// - las reservas puntuales se anulan y se devuelve a la bolsa la clase que
//   gastaron (las pagadas con tarjeta se cuentan para que el club devuelva el
//   dinero aparte);
// - sobran las faltas, los cambios de un día y las listas de espera;
// - los fijos salen del grupo ese día (como "Quitar" con fecha: si era su
//   único grupo, se les da de baja). Se les puede cambiar de grupo antes.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    lastDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }))
  if (badRequest) return badRequest
  const { lastDay } = body
  const today = madridToday()
  if (Number.isNaN(Date.parse(lastDay))) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 })
  if (lastDay < dayBefore(today)) return NextResponse.json({ error: 'El último día no puede ser anterior a ayer.' }, { status: 400 })
  if (Date.parse(lastDay) - Date.parse(today) > MAX_DAYS_AHEAD * 86_400_000) {
    return NextResponse.json({ error: 'La fecha es demasiado lejana.' }, { status: 400 })
  }

  const { data: schedule } = await admin
    .from('schedules')
    .select('id, club_id, recurrence, start_time, recurrence_end_date')
    .eq('id', params.id)
    .single()
  if (!schedule || (caller.role !== 'super_admin' && schedule.club_id !== caller.club_id)) {
    return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })
  }
  if (schedule.recurrence === 'none') {
    return NextResponse.json({ error: 'Es una clase de un solo día: usa "Cancelar sesión" o "Eliminar clase".' }, { status: 400 })
  }
  const firstDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(schedule.start_time))
  if (lastDay < firstDay) {
    return NextResponse.json({ error: 'La clase aún no ha empezado en esa fecha: elimínala si no la quieres.' }, { status: 400 })
  }
  const newEnd = schedule.recurrence_end_date && schedule.recurrence_end_date < lastDay ? schedule.recurrence_end_date : lastDay

  const { error: updErr } = await admin.from('schedules').update({ recurrence_end_date: newEnd }).eq('id', schedule.id)
  if (updErr) {
    console.error('[schedules/end] update failed:', updErr.message)
    return NextResponse.json({ error: 'No se ha podido quitar la clase' }, { status: 500 })
  }

  // Reservas puntuales posteriores: anular y devolver la clase de la bolsa.
  const { data: laterBookings } = await admin
    .from('bookings')
    .select('id, club_id, source, status')
    .eq('schedule_id', schedule.id)
    .not('class_date', 'is', null)
    .gt('class_date', newEnd)
  const bookingIds = (laterBookings ?? []).map(b => b.id)
  const paidByCard = (laterBookings ?? []).filter(b => b.source === 'pay_per_class' && b.status !== 'cancelled').length
  if (bookingIds.length) {
    const clubByBooking = new Map((laterBookings ?? []).map(b => [b.id, b.club_id]))
    const { data: debits } = await admin
      .from('bag_transactions')
      .select('user_id, delta, class_duration, booking_id')
      .in('booking_id', bookingIds)
      .eq('type', 'debit')
    for (const tx of debits ?? []) {
      await admin.rpc('credit_class_bag', {
        p_user_id: tx.user_id,
        p_club_id: clubByBooking.get(tx.booking_id) ?? schedule.club_id,
        p_delta: Math.abs(tx.delta),
        p_pack_type: tx.class_duration ?? '60',
        p_reason: 'Clase quitada por el club',
      })
    }
    await admin.from('bag_transactions').delete().in('booking_id', bookingIds)
    await admin.from('bookings').delete().in('id', bookingIds)
  }

  // Fijos: salen del grupo ese día (sus faltas posteriores sobran).
  const { data: enrollments } = await admin
    .from('group_enrollments')
    .select('id, student_id, start_date, end_date')
    .eq('schedule_id', schedule.id)
    .eq('status', 'active')
  let leaving = 0
  for (const e of enrollments ?? []) {
    if (e.end_date && e.end_date <= newEnd) continue
    await endEnrollment(admin, e, newEnd, today)
    leaving++
  }

  await Promise.all([
    admin.from('schedule_time_overrides').delete().eq('schedule_id', schedule.id).gt('override_date', newEnd),
    admin.from('schedule_coach_overrides').delete().eq('schedule_id', schedule.id).gt('override_date', newEnd),
    admin.from('class_waitlist').delete().eq('schedule_id', schedule.id).gt('class_date', newEnd),
  ])

  return NextResponse.json({ ok: true, lastDay: newEnd, studentsLeaving: leaving, bookingsCancelled: bookingIds.length, paidByCard })
}
