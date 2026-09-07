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

  // Una clase particular es 1 a 1 — si esa fecha ya tiene a alguien
  // asignado (pagado o pendiente de pago), no se puede meter a otro alumno más.
  if ((newSched as any)?.is_private) {
    const { data: otherBooking } = await admin
      .from('bookings')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('class_date', classDate)
      .neq('status', 'cancelled')
      .maybeSingle()
    if (otherBooking) {
      return NextResponse.json({ error: 'Esta clase particular ya tiene un alumno asignado ese día' }, { status: 409 })
    }
  } else {
    // Aforo real de esa fecha: grupo fijo activo, menos quien falta ese día,
    // más reservas puntuales ya confirmadas/pendientes — este endpoint no lo
    // comprobaba en absoluto, dejando meter alumnos por encima de max_students
    // sin avisar (ver incidente del 5/4 en un 4 plazas).
    const maxStudents = (newSched as any)?.max_students as number | undefined
    if (maxStudents) {
      const [{ count: activeGroupCount }, { data: exclusionsThatDate }, { count: existingSpotCount }] = await Promise.all([
        admin.from('group_enrollments').select('id', { count: 'exact', head: true }).eq('schedule_id', scheduleId).eq('status', 'active'),
        admin
          .from('schedule_exclusions')
          .select('id, group_enrollment:group_enrollments!inner(schedule_id, status)')
          .eq('excluded_date', classDate)
          .eq('group_enrollment.schedule_id', scheduleId)
          .eq('group_enrollment.status', 'active'),
        admin.from('bookings').select('id', { count: 'exact', head: true }).eq('schedule_id', scheduleId).eq('class_date', classDate).neq('status', 'cancelled'),
      ])
      const realCount = (activeGroupCount ?? 0) - (exclusionsThatDate ?? []).length + (existingSpotCount ?? 0)
      if (realCount >= maxStudents) {
        return NextResponse.json({ error: 'Esta clase ya está completa ese día' }, { status: 409 })
      }
    }
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
  // gratis una falta, tiene que pagar la tarifa de externo.
  const isPrivateLesson = (newSched as any)?.is_private === true
  const isExternalStudent = (studentExternalCheck as any)?.is_external === true
  const requiresPayment = isPrivateLesson || isExternalStudent

  if (requiresPayment) {
    const { data, error } = await admin
      .from('bookings')
      .insert({
        schedule_id: scheduleId,
        student_id: studentId,
        status: 'pending',
        source: 'admin',
        class_date: classDate,
        club_id: effectiveClubId ?? null,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este alumno ya tiene una reserva para esta fecha' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, bookingId: data.id })
  }

  // Alumno de la escuela en un hueco normal: esto SÍ tiene que gastar una
  // clase de su bolsa, igual que si él mismo hubiera cogido el hueco desde
  // la app — nunca se le regala en silencio. Si no tiene crédito, se corta
  // aquí con un aviso claro en vez de dejar entrar al admin/monitor igual.
  const durationMin = Math.round((new Date(newSched!.end_time).getTime() - new Date(newSched!.start_time).getTime()) / 60000)
  const durationType: '60' | '90' = durationMin >= 80 ? '90' : '60'

  const { data, error } = await admin
    .from('bookings')
    .insert({
      schedule_id: scheduleId,
      student_id: studentId,
      status: 'confirmed',
      source: 'bag',
      class_date: classDate,
      club_id: effectiveClubId ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este alumno ya tiene una reserva para esta fecha' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
  }

  const { data: debitResult, error: debitErr } = await admin.rpc('debit_class_bag_for_booking', {
    p_user_id: studentId,
    p_duration_type: durationType,
    p_reason: `Plaza libre del ${classDate} (añadida por ${caller.role === 'coach' ? 'monitor' : 'admin'})`,
    p_booking_id: data.id,
  })

  if (debitErr || debitResult?.error) {
    await admin.from('bookings').delete().eq('id', data.id)
    return NextResponse.json({ error: debitResult?.error ?? 'Este alumno no tiene clases disponibles en su bolsa' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, bookingId: data.id, newBalance: debitResult.new_balance })
}
