export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { checkOverlap, checkCoachOverlap } from '@/lib/schedule-overlap'
import { cookies } from 'next/headers'
import { schedulesWithHistory } from '@/lib/schedule-history'
import { splitSchedule } from '@/lib/split-schedule'
import { madridDayOfWeek, madridMinutesOfDay } from '@/lib/madrid-time'
import { peakOccupancyFrom } from '@/lib/enrollment-window'
import { madridToday } from '@/lib/enrollment-window'

const scheduleSchema = z.object({
  court_id: z.string().uuid(),
  coach_id: z.string().uuid(),
  level_id: z.string().uuid().nullable().optional(),
  start_time: z.string(),
  end_time: z.string(),
  recurrence: z.enum(['none', 'weekly', 'biweekly']),
  recurrence_end_date: z.string().nullable().optional(),
  max_students: z.number().int().min(1).max(20),
  is_active: z.boolean().optional(),
  club_id: z.string().uuid().nullable().optional(),
  type: z.enum(['regular', 'intensivo']).optional(),
  price_cents: z.number().int().min(0).nullable().optional(),
  intensivo_group_id: z.string().uuid().nullable().optional(),
  is_private: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, scheduleSchema)
  if (badRequest) return badRequest

  const [courtBusy, coachBusy] = await Promise.all([
    checkOverlap(admin, body.court_id, body.start_time, body.end_time, body.recurrence_end_date),
    checkCoachOverlap(admin, body.coach_id, body.start_time, body.end_time, body.recurrence_end_date),
  ])
  if (courtBusy) return NextResponse.json({ error: 'Ya existe una clase activa en esa pista a esa hora.' }, { status: 409 })
  if (coachBusy) return NextResponse.json({ error: 'El monitor ya tiene otra clase a esa hora.' }, { status: 409 })

  const cookieStore = cookies()
  const effectiveClubId = caller.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? caller.club_id ?? null)
    : caller.club_id

  if (caller.role !== 'super_admin' && effectiveClubId) {
    const [{ data: courtRow }, { data: coachRow }] = await Promise.all([
      admin.from('courts').select('club_id').eq('id', body.court_id).single(),
      admin.from('users').select('club_id').eq('id', body.coach_id).single(),
    ])
    if (!courtRow || (courtRow as any).club_id !== effectiveClubId) {
      return NextResponse.json({ error: 'La pista no pertenece a tu club' }, { status: 403 })
    }
    if (!coachRow || (coachRow as any).club_id !== effectiveClubId) {
      return NextResponse.json({ error: 'El monitor no pertenece a tu club' }, { status: 403 })
    }
  }

  // Una clase particular es 1 a 1 siempre — el resto de la app (asignación
  // de plazas, cálculo de precio) ya lo asume así independientemente de lo
  // que llegue en max_students; se fuerza aquí también para que el dato
  // guardado no diga otra cosa.
  const isPrivate = body.recurrence === 'none' ? (body.is_private ?? false) : false

  const { data, error } = await admin.from('schedules').insert({
    court_id: body.court_id,
    coach_id: body.coach_id,
    level_id: body.level_id ?? null,
    start_time: body.start_time,
    end_time: body.end_time,
    recurrence: body.recurrence,
    recurrence_end_date: body.recurrence_end_date ?? null,
    max_students: isPrivate ? 1 : body.max_students,
    // Grupo en formación: solo grupos regulares que se repiten, no
    // particulares ni intensivos (ver /api/admin/schedules/[id]/start).
    is_active: !(body.is_active === false && body.recurrence !== 'none' && (body.type ?? 'regular') === 'regular' && !isPrivate),
    club_id: effectiveClubId,
    type: body.type ?? 'regular',
    price_cents: body.price_cents ?? null,
    intensivo_group_id: body.intensivo_group_id ?? null,
    is_private: isPrivate,
  }).select('id').single()

  if (error) return NextResponse.json({ error: 'Error al crear el horario' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, scheduleSchema.extend({
    id: z.string().uuid(),
    // Aplicar los cambios desde la fecha de start_time (clase que ya ha
    // empezado): lo anterior no cambia. Sin esto se corrige la clase entera.
    apply_from: z.boolean().optional(),
  }))
  if (badRequest) return badRequest

  if (caller.role !== 'super_admin') {
    const { data: existing } = await admin.from('schedules').select('club_id').eq('id', body.id).single()
    if (!existing || existing.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos para editar este horario' }, { status: 403 })
    }
    const [{ data: courtRow }, { data: coachRow }] = await Promise.all([
      admin.from('courts').select('club_id').eq('id', body.court_id).single(),
      admin.from('users').select('club_id').eq('id', body.coach_id).single(),
    ])
    if (!courtRow || (courtRow as any).club_id !== caller.club_id) {
      return NextResponse.json({ error: 'La pista no pertenece a tu club' }, { status: 403 })
    }
    if (!coachRow || (coachRow as any).club_id !== caller.club_id) {
      return NextResponse.json({ error: 'El monitor no pertenece a tu club' }, { status: 403 })
    }
  }

  const [courtBusy, coachBusy] = await Promise.all([
    checkOverlap(admin, body.court_id, body.start_time, body.end_time, body.recurrence_end_date, body.id),
    checkCoachOverlap(admin, body.coach_id, body.start_time, body.end_time, body.recurrence_end_date, body.id),
  ])
  if (courtBusy) return NextResponse.json({ error: 'Ya existe una clase activa en esa pista a esa hora.' }, { status: 409 })
  if (coachBusy) return NextResponse.json({ error: 'El monitor ya tiene otra clase a esa hora.' }, { status: 409 })

  if (body.apply_from) {
    const { data: old } = await admin.from('schedules').select('*').eq('id', body.id).single()
    if (!old) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })
    const today = madridToday()
    const fromDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(body.start_time))
    const oldFirstDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(old.start_time))
    // Solo tiene sentido partir una clase que se repite y que ya tenía días
    // antes de esa fecha; si no, se edita entera como siempre (más abajo).
    if (old.recurrence !== 'none' && (old.type ?? 'regular') === 'regular' && oldFirstDay < fromDay) {
      if (fromDay < today) return NextResponse.json({ error: 'El primer día con los cambios no puede ser anterior a hoy.' }, { status: 400 })
      if (old.recurrence_end_date && old.recurrence_end_date < fromDay) {
        return NextResponse.json({ error: 'La clase ya ha terminado antes de esa fecha.' }, { status: 400 })
      }
      const sameAsBefore =
        old.court_id === body.court_id && old.coach_id === body.coach_id && (old.level_id ?? null) === (body.level_id ?? null) &&
        madridDayOfWeek(old.start_time) === madridDayOfWeek(body.start_time) &&
        madridMinutesOfDay(old.start_time) === madridMinutesOfDay(body.start_time) &&
        madridMinutesOfDay(old.end_time) === madridMinutesOfDay(body.end_time) &&
        old.max_students === body.max_students && old.recurrence === body.recurrence &&
        (old.recurrence_end_date ?? null) === (body.recurrence_end_date ?? null)
      if (sameAsBefore) return NextResponse.json({ error: 'No has cambiado nada de la clase.' }, { status: 400 })

      const { data: fixed } = await admin.from('group_enrollments').select('start_date, end_date').eq('schedule_id', body.id).eq('status', 'active')
      const fixedFrom = peakOccupancyFrom((fixed ?? []).filter(e => !e.end_date || e.end_date >= fromDay), fromDay)
      if (fixedFrom > body.max_students) {
        return NextResponse.json({ error: `No se puede bajar a ${body.max_students} plazas: desde esa fecha habrá ${fixedFrom} alumnos fijos.` }, { status: 409 })
      }
      try {
        const result = await splitSchedule(admin, old, {
          court_id: body.court_id,
          coach_id: body.coach_id,
          level_id: body.level_id ?? null,
          start_time: body.start_time,
          end_time: body.end_time,
          recurrence: body.recurrence,
          recurrence_end_date: body.recurrence_end_date ?? null,
          max_students: body.max_students,
        }, fromDay, today)
        return NextResponse.json({ ok: true, id: result.newId, fromDay, ...result })
      } catch (err: any) {
        console.error('[schedules] split failed:', err?.message)
        return NextResponse.json({ error: 'No se ha podido aplicar el cambio. No se ha modificado nada.' }, { status: 500 })
      }
    }
  }

  // Bajar max_students por debajo de los fijos que ya hay dejaría la clase
  // sobre-ocupada al instante, sin avisar a nadie — mismo tipo de fallo que
  // ya hemos cerrado en "añadir alumno" y "añadir alumno fijo". Solo cuentan
  // los fijos activos hoy (un sustituto con start_date futuro o una baja ya
  // con end_date pasado no deben contar como ocupando plaza ahora mismo).
  const { data: enrollmentsForGuard } = await admin
    .from('group_enrollments')
    .select('start_date, end_date')
    .eq('schedule_id', body.id)
    .eq('status', 'active')
  const todaySpainGuard = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  const activeEnrollmentCount = (enrollmentsForGuard ?? []).filter((e: any) =>
    (!e.start_date || e.start_date <= todaySpainGuard) && (!e.end_date || e.end_date >= todaySpainGuard)
  ).length
  if (activeEnrollmentCount > body.max_students) {
    return NextResponse.json({
      error: `No se puede bajar a ${body.max_students} plazas: ya hay ${activeEnrollmentCount} alumnos fijos en esta clase.`,
    }, { status: 409 })
  }

  const { error } = await admin.from('schedules').update({
    court_id: body.court_id,
    coach_id: body.coach_id,
    level_id: body.level_id ?? null,
    start_time: body.start_time,
    end_time: body.end_time,
    recurrence: body.recurrence,
    recurrence_end_date: body.recurrence_end_date ?? null,
    max_students: body.max_students,
    type: body.type ?? 'regular',
    price_cents: body.price_cents ?? null,
  }).eq('id', body.id)

  if (error) return NextResponse.json({ error: 'Error al actualizar el horario' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { scheduleId } = await req.json()
  if (!scheduleId) return NextResponse.json({ error: 'scheduleId requerido' }, { status: 400 })

  if (caller.role !== 'super_admin') {
    const { data: existing } = await admin.from('schedules').select('club_id').eq('id', scheduleId).single()
    if (!existing || existing.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos para borrar este horario' }, { status: 403 })
    }
  }

  // Una clase con historial no se borra: se perderían las clases dadas, las
  // horas del monitor y quién estuvo (y se devolverían a la bolsa clases ya
  // disfrutadas). Para esas está "Quitar a partir de un día".
  if ((await schedulesWithHistory(admin, [scheduleId], madridToday())).size) {
    return NextResponse.json({ error: 'Esta clase ya tiene historial (clases dadas, alumnos o reservas pasadas). Para no perderlo, usa "Quitar a partir de un día".', code: 'has_history' }, { status: 409 })
  }

  // Step 1: get dependent IDs in parallel
  const [enrollmentsRes, bookingsRes] = await Promise.all([
    admin.from('group_enrollments').select('id').eq('schedule_id', scheduleId),
    admin.from('bookings').select('id, club_id').eq('schedule_id', scheduleId),
  ])
  const enrollmentIds = (enrollmentsRes.data ?? []).map((e: any) => e.id)
  const bookingIds = (bookingsRes.data ?? []).map((b: any) => b.id)
  const clubIdByBooking = new Map((bookingsRes.data ?? []).map((b: any) => [b.id, b.club_id]))

  // Step 1.5: devolver a la bolsa cualquier crédito ya gastado en estas
  // reservas antes de borrar su rastro (bag_transactions) — si no, el
  // alumno pierde el crédito sin que nadie se lo devuelva.
  if (bookingIds.length > 0) {
    const { data: debitTxs } = await admin
      .from('bag_transactions')
      .select('user_id, delta, class_duration, booking_id')
      .in('booking_id', bookingIds)
      .eq('type', 'debit')
    await Promise.all((debitTxs ?? []).map((tx: any) =>
      admin.rpc('credit_class_bag', {
        p_user_id: tx.user_id,
        p_club_id: clubIdByBooking.get(tx.booking_id) ?? null,
        p_delta: Math.abs(tx.delta),
        p_pack_type: tx.class_duration ?? '60',
        p_reason: 'Clase eliminada por el administrador',
      })
    ))
  }

  // Step 2: delete leaf rows in parallel. payments NO se borra — su FK a
  // bookings es ON DELETE SET NULL, así que sobrevive cuando se borre la
  // reserva en el paso 3 (se conserva el rastro de cobro de Redsys).
  await Promise.all([
    enrollmentIds.length > 0
      ? admin.from('schedule_exclusions').delete().in('group_enrollment_id', enrollmentIds)
      : Promise.resolve(),
    bookingIds.length > 0
      ? admin.from('bag_transactions').delete().in('booking_id', bookingIds)
      : Promise.resolve(),
  ])

  // Step 3: delete FK rows + null makeups in parallel
  await Promise.all([
    admin.from('group_enrollments').delete().eq('schedule_id', scheduleId),
    admin.from('bookings').delete().eq('schedule_id', scheduleId),
    admin.from('makeups').update({ original_schedule_id: null }).eq('original_schedule_id', scheduleId),
    admin.from('makeups').update({ makeup_schedule_id: null }).eq('makeup_schedule_id', scheduleId),
  ])

  // Step 4: delete schedule
  const { error: deleteErr } = await admin.from('schedules').delete().eq('id', scheduleId)
  if (deleteErr) return NextResponse.json({ error: 'Error al eliminar el horario' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
