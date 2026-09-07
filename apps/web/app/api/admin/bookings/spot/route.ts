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
  if (!caller || !['admin', 'coach', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleId: z.string().uuid(),
    studentId: z.string().uuid(),
    classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    clubId: z.string().uuid().nullable().optional(),
  }))
  if (badRequest) return badRequest
  const { scheduleId, studentId, classDate, clubId } = body

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
  const [{ data: newSched }, { data: studentExternalCheck }] = await Promise.all([
    admin.from('schedules').select('start_time, end_time, is_private, max_students').eq('id', scheduleId).single(),
    admin.from('users').select('is_external').eq('id', studentId).single(),
  ])
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
    const nStartMin = nStart.getUTCHours() * 60 + nStart.getUTCMinutes()
    const nEndMin = nEnd.getUTCHours() * 60 + nEnd.getUTCMinutes()

    for (const b of existing ?? []) {
      const s = (b as any).schedules
      if (!s) continue
      const sStartMin = new Date(s.start_time).getUTCHours() * 60 + new Date(s.start_time).getUTCMinutes()
      const sEndMin = new Date(s.end_time).getUTCHours() * 60 + new Date(s.end_time).getUTCMinutes()
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
  // para un alumno externo en un hueco normal: no es un compañero cubriendo
  // gratis una falta, tiene que pagar la tarifa de externo. En cualquier
  // otro caso, se cobra 1 clase de su bolsa — nunca se regala en silencio.
  const isPrivateLesson = (newSched as any)?.is_private === true
  const isExternalStudent = (studentExternalCheck as any)?.is_external === true
  const requiresPayment = isPrivateLesson || isExternalStudent

  // Aforo + inserción + cobro de bolsa + despublicar la falta cubierta, todo
  // en una única transacción con bloqueo de fila — evita la carrera que
  // dejaba pasar dos reservas simultáneas por encima de max_students (ver
  // incidente del 5/4 en una clase de 4).
  const { data: result, error: rpcErr } = await admin.rpc('admin_assign_spot_booking', {
    p_schedule_id: scheduleId,
    p_student_id: studentId,
    p_class_date: classDate,
    p_club_id: effectiveClubId ?? null,
    p_charge_bag: !requiresPayment,
    p_reason: `Plaza libre del ${classDate} (añadida por ${caller.role === 'coach' ? 'monitor' : 'admin'})`,
  })

  if (rpcErr) {
    console.error('[bookings/spot] admin_assign_spot_booking failed:', rpcErr.message)
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
  }
  if (result?.error) {
    return NextResponse.json({ error: result.error }, { status: 409 })
  }

  return NextResponse.json({ ok: true, bookingId: result.booking_id, newBalance: result.new_balance ?? undefined })
}
