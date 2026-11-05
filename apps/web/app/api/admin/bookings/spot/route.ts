export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { madridMinutesOfDay } from '@/lib/madrid-time'
import { COURTESY_NOTE, recordCourtesy } from '@/lib/booking-courtesy'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'coach', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleId: z.string().uuid(),
    studentId: z.string().uuid(),
    classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    clubId: z.string().uuid().nullable().optional(),
    courtesy: z.boolean().optional(),
  }))
  if (badRequest) return badRequest
  const { scheduleId, studentId, classDate, clubId, courtesy = false } = body
  // Clase de prueba o de cortesía: sin bolsa ni pago. Solo el club (admin o
  // superadmin), nunca un monitor, y queda marcada para que no sea un regalo
  // en silencio.
  if (courtesy && caller.role === 'coach') {
    return NextResponse.json({ error: 'Solo el club puede apuntar a alguien sin descontar clase' }, { status: 403 })
  }

  if (caller.role !== 'super_admin') {
    const [{ data: scheduleCheck }, { data: studentCheck }] = await Promise.all([
      admin.from('schedules').select('club_id, coach_id').eq('id', scheduleId).single(),
      admin.from('users').select('club_id').eq('id', studentId).single(),
    ])
    if (!scheduleCheck || !caller.club_id || (scheduleCheck as any).club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos para esta clase' }, { status: 403 })
    }
    // Un monitor solo puede rellenar huecos de SUS propias clases — la
    // comprobación de club de arriba no basta, dejaría meter alumnos en
    // clases de otros monitores del mismo club.
    if (caller.role === 'coach' && (scheduleCheck as any).coach_id !== user.id) {
      return NextResponse.json({ error: 'Esta clase no es tuya' }, { status: 403 })
    }
    if (!studentCheck || !caller.club_id || (studentCheck as any).club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos para este alumno' }, { status: 403 })
    }
  }
  const effectiveClubId = caller.role === 'super_admin' ? (clubId ?? caller.club_id) : caller.club_id

  // Overlap check
  const [{ data: newSched }, { data: studentExternalCheck }, { data: studentBag }] = await Promise.all([
    admin.from('schedules').select('start_time, end_time, is_private, max_students, recurrence_end_date').eq('id', scheduleId).single(),
    admin.from('users').select('is_external').eq('id', studentId).single(),
    admin.from('class_bag').select('balance_60, balance_90').eq('user_id', studentId).maybeSingle(),
  ])
  if (newSched?.recurrence_end_date && classDate > newSched.recurrence_end_date) {
    return NextResponse.json({ error: 'La clase ya no se da en esa fecha.' }, { status: 409 })
  }
  if (newSched) {
    const { data: existing } = await admin
      .from('bookings')
      .select('schedule_id, schedules(start_time, end_time)')
      .eq('student_id', studentId)
      .eq('class_date', classDate)
      .neq('status', 'cancelled')
      .neq('schedule_id', scheduleId)

    const nStart = new Date(newSched.start_time)
    const nEnd = new Date(newSched.end_time)
    const nStartMin = madridMinutesOfDay(nStart)
    const nEndMin = madridMinutesOfDay(nEnd)

    for (const b of existing ?? []) {
      const s = (b as any).schedules
      if (!s) continue
      const sStartMin = madridMinutesOfDay(new Date(s.start_time))
      const sEndMin = madridMinutesOfDay(new Date(s.end_time))
      if (sStartMin < nEndMin && sEndMin > nStartMin) {
        return NextResponse.json({ error: 'Este alumno ya tiene una clase en ese horario' }, { status: 409 })
      }
    }
  }

  const [{ data: inGroup }, { data: existingBooking }] = await Promise.all([
    admin
      .from('group_enrollments')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle(),
    admin
      .from('bookings')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('student_id', studentId)
      .eq('class_date', classDate)
      .neq('status', 'cancelled')
      .maybeSingle(),
  ])

  if (inGroup) {
    return NextResponse.json(
      { error: 'Este alumno ya está en el grupo fijo de esta clase' },
      { status: 409 }
    )
  }

  if (existingBooking) {
    return NextResponse.json(
      { error: 'Este alumno ya tiene una reserva para esta fecha' },
      { status: 409 }
    )
  }

  // Limpiar fila cancelada previa si existe (legacy antes de borrado directo)
  await admin
    .from('bookings')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('student_id', studentId)
    .eq('class_date', classDate)
    .eq('status', 'cancelled')

  // Una clase particular no se da por hecha al asignarla — el alumno tiene
  // que pagarla desde su app antes de que cuente como confirmada. Lo mismo
  // para un alumno externo sin bono para esta clase: la paga desde su app a
  // tarifa de externo. En cualquier otro caso, se cobra 1 clase de su bolsa
  // — nunca se regala en silencio.
  const isPrivateLesson = (newSched as any)?.is_private === true
  const isExternalStudent = (studentExternalCheck as any)?.is_external === true
  // Mismo criterio que debit_class_bag_for_booking: una clase de 1h30 solo
  // con bono de 1h30; una de 1h, con cualquiera de los dos.
  const isLongClass = newSched
    ? Math.round((new Date(newSched.end_time).getTime() - new Date(newSched.start_time).getTime()) / 60000) >= 80
    : false
  const hasBagForClass = isLongClass
    ? (studentBag?.balance_90 ?? 0) > 0
    : (studentBag?.balance_60 ?? 0) > 0 || (studentBag?.balance_90 ?? 0) > 0
  const requiresPayment = isPrivateLesson || (isExternalStudent && !hasBagForClass)

  // Aforo + inserción + cobro de bolsa + despublicar la falta cubierta, todo
  // en una única transacción con bloqueo de fila — evita la carrera que
  // dejaba pasar dos reservas simultáneas por encima de max_students (ver
  // incidente del 5/4 en una clase de 4).
  const { data: result, error: rpcErr } = await admin.rpc('admin_assign_spot_booking', {
    p_schedule_id: scheduleId,
    p_student_id: studentId,
    p_class_date: classDate,
    p_club_id: effectiveClubId ?? null,
    p_charge_bag: !courtesy && !requiresPayment,
    p_reason: `Plaza libre del ${classDate} (añadida por ${caller.role === 'coach' ? 'monitor' : 'admin'})`,
  })

  if (rpcErr) {
    console.error('[bookings/spot] admin_assign_spot_booking failed:', rpcErr.message)
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
  }
  if (result?.error) {
    const noBag = /bolsa/i.test(result.error) && caller.role !== 'coach'
    return NextResponse.json({
      error: noBag ? 'No le quedan clases en la bolsa. Si es de prueba o cortesía, marca «Sin descontar clase».' : result.error,
    }, { status: 409 })
  }

  if (courtesy) {
    // La función la deja pendiente de pago al no cobrar bolsa: se confirma y
    // se apunta en el historial de su bolsa (0 clases, ligado a la reserva:
    // si se anula, el apunte se va con ella).
    const { error: confirmErr } = await admin.from('bookings').update({ status: 'confirmed', notes: COURTESY_NOTE }).eq('id', result.booking_id)
    const txErr = confirmErr ?? await recordCourtesy(admin, studentId, effectiveClubId ?? null, result.booking_id, classDate)
    if (txErr) {
      console.error('[bookings/spot] courtesy failed:', txErr.message)
      await admin.from('bag_transactions').delete().eq('booking_id', result.booking_id)
      await admin.from('bookings').delete().eq('id', result.booking_id)
      return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, bookingId: result.booking_id, courtesy: true })
  }

  return NextResponse.json({ ok: true, bookingId: result.booking_id, newBalance: result.new_balance ?? undefined })
}
