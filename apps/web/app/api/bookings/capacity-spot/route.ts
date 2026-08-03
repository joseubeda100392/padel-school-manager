export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const TZ = 'Europe/Madrid'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { scheduleId, date } = await req.json()
  if (!scheduleId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 })
  }

  const admin = getAdminClient()

  const [{ data: userProfile }, { data: schedule }] = await Promise.all([
    admin.from('users').select('club_id').eq('id', user.id).single(),
    admin.from('schedules').select('id, max_students, start_time, end_time, club_id, recurrence_end_date').eq('id', scheduleId).single(),
  ])

  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  if ((userProfile as any)?.club_id && (schedule as any).club_id !== (userProfile as any).club_id) {
    return NextResponse.json({ error: 'Sin acceso a esta clase' }, { status: 403 })
  }

  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  if (date < todaySpain) {
    return NextResponse.json({ error: 'Esa fecha ya ha pasado' }, { status: 400 })
  }
  const scheduleStartDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(schedule.start_time))
  if (date < scheduleStartDate) {
    return NextResponse.json({ error: 'Esa clase todavía no ha empezado' }, { status: 400 })
  }
  if ((schedule as any).recurrence_end_date && date > (schedule as any).recurrence_end_date) {
    return NextResponse.json({ error: 'Esa clase ya ha terminado' }, { status: 400 })
  }
  const scheduleDow = new Date(schedule.start_time).getUTCDay()
  const requestedDow = new Date(date + 'T12:00:00Z').getUTCDay()
  if (scheduleDow !== requestedDow) {
    return NextResponse.json({ error: 'La fecha no corresponde al día de esta clase' }, { status: 400 })
  }

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

  // Aforo, duplicados y descuento de bolsa se comprueban de forma atómica
  // dentro de la función (lock sobre schedules), para que dos reservas
  // simultáneas no puedan superar max_students ni gastar el mismo crédito.
  const { data: result, error: rpcErr } = await admin.rpc('book_capacity_spot', {
    p_schedule_id: scheduleId,
    p_student_id: user.id,
    p_class_date: date,
  })

  if (rpcErr || result?.error) {
    const msg = result?.error ?? 'Error al crear la reserva'
    const status = result?.error ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }

  return NextResponse.json({ ok: true, newBalance: result.new_balance })
}
