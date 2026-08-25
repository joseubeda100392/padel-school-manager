export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { checkOverlap, checkCoachOverlap } from '@/lib/schedule-overlap'
import { cookies } from 'next/headers'

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

  const { data, error } = await admin.from('schedules').insert({
    court_id: body.court_id,
    coach_id: body.coach_id,
    level_id: body.level_id ?? null,
    start_time: body.start_time,
    end_time: body.end_time,
    recurrence: body.recurrence,
    recurrence_end_date: body.recurrence_end_date ?? null,
    max_students: body.max_students,
    is_active: true,
    club_id: effectiveClubId,
    type: body.type ?? 'regular',
    price_cents: body.price_cents ?? null,
    intensivo_group_id: body.intensivo_group_id ?? null,
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

  const { error } = await admin.from('schedules').update({
    court_id: body.court_id,
    coach_id: body.coach_id,
    level_id: body.level_id ?? null,
    start_time: body.start_time,
    end_time: body.end_time,
    recurrence: body.recurrence,
    recurrence_end_date: body.recurrence_end_date ?? null,
    max_students: body.max_students,
    is_active: body.is_active ?? true,
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
