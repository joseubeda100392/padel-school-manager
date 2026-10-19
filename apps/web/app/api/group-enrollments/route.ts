export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { firstBillableMonth } from '@/lib/billing-cycle'
import { carriedOverPaidUntil, type CarryoverPayment } from '@/lib/enrollment-carryover'

const CARRYOVER_LOOKBACK_MONTHS = 3

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleId: z.string().uuid(),
    studentId: z.string().uuid(),
    monthlyPrice: z.number().nonnegative().optional(),
    pricePerClassCents: z.number().nonnegative().nullish(),
    courtPricing: z.enum(['con_pista', 'sin_pista']).nullish(),
    replacesEnrollmentId: z.string().uuid().optional(),
  }))
  if (badRequest) return badRequest
  const { scheduleId, studentId, monthlyPrice, pricePerClassCents, courtPricing, replacesEnrollmentId } = body

  const admin = getAdminClient()

  const { data: adminUser } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Grupo en formación (schedules.is_active = false): el alumno queda como
  // INTERESADO (status 'pending'). No ve la clase, no paga y no ocupa plaza en
  // ningún cálculo hasta que el club arranca el grupo
  // (/api/admin/schedules/[id]/start), porque todo lo demás de la app solo
  // mira inscripciones 'active'.
  const { data: target } = await admin.from('schedules').select('is_active, club_id, max_students').eq('id', scheduleId).single()
  if (!target) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })
  if (adminUser.role !== 'super_admin' && target.club_id !== adminUser.club_id) {
    return NextResponse.json({ error: 'Sin permisos sobre esta clase' }, { status: 403 })
  }
  if (target.is_active === false) {
    if (replacesEnrollmentId) {
      return NextResponse.json({ error: 'No se puede cambiar a un grupo que aún se está formando. Apúntale como interesado.' }, { status: 400 })
    }
    const [{ data: student }, { data: interested }] = await Promise.all([
      admin.from('users').select('club_id').eq('id', studentId).single(),
      admin.from('group_enrollments').select('student_id').eq('schedule_id', scheduleId).eq('status', 'pending'),
    ])
    if (!student || student.club_id !== target.club_id) {
      return NextResponse.json({ error: 'El alumno no es de este club' }, { status: 400 })
    }
    if ((interested ?? []).some((e: { student_id: string }) => e.student_id === studentId)) {
      return NextResponse.json({ error: 'Ya está apuntado como interesado.' }, { status: 409 })
    }
    if (target.max_students && (interested?.length ?? 0) >= target.max_students) {
      return NextResponse.json({ error: `El grupo ya tiene ${target.max_students}/${target.max_students} interesados.` }, { status: 409 })
    }
    const { data, error } = await admin.from('group_enrollments').insert({
      schedule_id: scheduleId,
      student_id: studentId,
      club_id: target.club_id,
      monthly_price: monthlyPrice ?? 0,
      price_per_class_cents: pricePerClassCents ?? null,
      court_pricing: courtPricing ?? null,
      status: 'pending',
      enrolled_by: user.id,
      enrolled_at: new Date().toISOString(),
      paid_until: null,
    }).select().single()
    if (error) {
      console.error('[group-enrollments] pending insert failed:', error.message)
      return NextResponse.json({ error: 'No se ha podido apuntar al interesado' }, { status: 500 })
    }
    return NextResponse.json({ data })
  }

  // Cambio de grupo: la inscripción vieja se sustituye por la nueva en un
  // solo paso, heredando lo pagado, la deuda y los descuentos. Así no importa
  // en qué orden lo haría el admin a mano (añadir y luego quitar dejaba el
  // grupo nuevo pendiente aunque ya hubiera pagado).
  let replaced: any = null
  if (replacesEnrollmentId) {
    const { data: old } = await admin
      .from('group_enrollments')
      .select('id, schedule_id, student_id, club_id, status, end_date, paid_until, start_date, monthly_price, discount_applied, discount_cents, discount_classes_pending, price_per_class_cents, court_pricing')
      .eq('id', replacesEnrollmentId)
      .single()
    if (!old || old.student_id !== studentId || old.status !== 'active') {
      return NextResponse.json({ error: 'La clase de origen no existe o no es de este alumno.' }, { status: 404 })
    }
    if (old.schedule_id === scheduleId) {
      return NextResponse.json({ error: 'El grupo de destino es el mismo que el de origen.' }, { status: 400 })
    }
    if (old.end_date) {
      return NextResponse.json({ error: 'Esta clase tiene una baja programada. Cancela la baja antes de cambiarle de grupo.' }, { status: 409 })
    }
    if (adminUser.role !== 'super_admin' && old.club_id !== adminUser.club_id) {
      return NextResponse.json({ error: 'Sin permisos: la clase de origen no pertenece a tu club' }, { status: 403 })
    }
    replaced = old
  }

  const [{ data: schedule }, { data: student }, { data: existingEnrollments }, { data: studentSchedulesAll }] = await Promise.all([
    admin.from('schedules').select('level_id, start_time, end_time, recurrence_end_date, club_id, max_students').eq('id', scheduleId).single(),
    admin.from('users').select('current_level_id, club_id').eq('id', studentId).single(),
    admin.from('group_enrollments')
      .select('student_id, start_date, end_date, student:users!group_enrollments_student_id_fkey(current_level_id)')
      .eq('schedule_id', scheduleId)
      .eq('status', 'active'),
    admin.from('group_enrollments')
      .select('paid_until, schedule:schedules!inner(id, start_time, end_time, recurrence_end_date)')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .neq('schedule_id', scheduleId),
  ])
  const studentSchedules = (studentSchedulesAll ?? []).filter((e: any) => !replaced || e.schedule?.id !== replaced.schedule_id)
  if (replaced && (schedule as any)?.club_id !== replaced.club_id) {
    return NextResponse.json({ error: 'El grupo de destino es de otro club.' }, { status: 400 })
  }

  // Un enrollment 'active' con baja programada (end_date en el pasado ya
  // procesado no debería existir, pero uno con end_date futuro sigue
  // ocupando su plaza hasta que el cron lo quite) o con start_date futuro
  // (sustituto aún no arrancado) no debe contarse fuera de su ventana real —
  // se filtra por "hoy" para el aforo inmediato.
  const TZ0 = 'Europe/Madrid'
  const todaySpain0 = new Intl.DateTimeFormat('en-CA', { timeZone: TZ0 }).format(new Date())
  const activeTodayEnrollments = (existingEnrollments ?? []).filter((e: any) =>
    (!e.start_date || e.start_date <= todaySpain0) && (!e.end_date || e.end_date >= todaySpain0)
  )
  const alreadyEnrolled = (existingEnrollments ?? []).some((e: any) => e.student_id === studentId)
  // La inscripción se guarda con upsert: volver a meter a alguien que ya está
  // en el grupo reescribiría su "pagado hasta", su alta y sus descuentos.
  if (alreadyEnrolled) {
    return NextResponse.json({ error: 'El alumno ya está en este grupo.' }, { status: 409 })
  }
  if (!alreadyEnrolled && schedule?.max_students && activeTodayEnrollments.length >= schedule.max_students) {
    return NextResponse.json({ error: `La clase ya tiene ${schedule.max_students}/${schedule.max_students} plazas ocupadas.` }, { status: 409 })
  }

  // Este chequeo de arriba solo mira cuántos fijos hay — no ve las reservas
  // puntuales ya confirmadas para fechas concretas. Incidente real: una
  // clase con 3 fijos tenía un hueco puntual ya cubierto por un alumno
  // suelto (source 'bag') un día concreto; al meter a un 4º fijo (3 < 4,
  // pasaba el chequeo de arriba) la clase quedó en 5 ese día sin que nadie
  // se diera cuenta. Se comprueba también contra cualquier reserva puntual
  // futura ya existente en este horario.
  if (!alreadyEnrolled && schedule?.max_students) {
    const TZ = 'Europe/Madrid'
    const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
    const { data: upcomingSpotBookings } = await admin
      .from('bookings')
      .select('class_date, student:users!bookings_student_id_fkey(name)')
      .eq('schedule_id', scheduleId)
      .neq('status', 'cancelled')
      .not('class_date', 'is', null)
      .gte('class_date', todaySpain)
    if (upcomingSpotBookings?.length) {
      const activeEnrollmentIds = (existingEnrollments ?? []).map((e: any) => e.student_id)
      const { data: exclusionsForActive } = activeEnrollmentIds.length
        ? await admin
            .from('group_enrollments')
            .select('id, start_date, end_date, schedule_exclusions(excluded_date)')
            .eq('schedule_id', scheduleId)
            .eq('status', 'active')
        : { data: [] }
      for (const b of upcomingSpotBookings) {
        // Fijos activos justo en la fecha de esta reserva puntual (respeta
        // start_date/end_date — un sustituto que aún no arranca o una baja
        // ya efectiva ese día no deben contar).
        const fixedActiveThatDate = (exclusionsForActive ?? []).filter((e: any) =>
          (!e.start_date || e.start_date <= b.class_date) && (!e.end_date || e.end_date >= b.class_date)
        ).length
        const absentThatDate = (exclusionsForActive ?? []).filter((e: any) =>
          (!e.start_date || e.start_date <= b.class_date) && (!e.end_date || e.end_date >= b.class_date) &&
          (e.schedule_exclusions ?? []).some((x: any) => x.excluded_date === b.class_date)
        ).length
        const bookedThatDate = upcomingSpotBookings.filter((x: any) => x.class_date === b.class_date).length
        const realCount = fixedActiveThatDate + 1 - absentThatDate + bookedThatDate
        if (realCount > schedule.max_students) {
          return NextResponse.json({
            error: `No se puede añadir como fijo: el ${b.class_date} ya hay una reserva puntual (${(b as any).student?.name ?? 'un alumno'}) que dejaría la clase en ${realCount}/${schedule.max_students}.`,
          }, { status: 409 })
        }
      }
    }
  }

  if (adminUser.role !== 'super_admin') {
    if (!schedule || (schedule as any).club_id !== adminUser.club_id) {
      return NextResponse.json({ error: 'Sin permisos: clase no pertenece a tu club' }, { status: 403 })
    }
    if (!student || (student as any).club_id !== adminUser.club_id) {
      return NextResponse.json({ error: 'Sin permisos: alumno no pertenece a tu club' }, { status: 403 })
    }
  }

  // level_id on schedule takes priority; if absent, infer from already-enrolled students
  const enrolledLevels = [...new Set(
    (existingEnrollments ?? []).map((e: any) => e.student?.current_level_id).filter(Boolean)
  )]
  const effectiveLevelId: string | null = schedule?.level_id ?? (enrolledLevels.length === 1 ? enrolledLevels[0] : null)

  if (schedule) {
    const TZ = 'Europe/Madrid'
    const dateOnly = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso))
    const newDow = new Date(schedule.start_time).getUTCDay()
    const newStart = new Date(schedule.start_time).getUTCHours() * 60 + new Date(schedule.start_time).getUTCMinutes()
    const newEnd = new Date(schedule.end_time).getUTCHours() * 60 + new Date(schedule.end_time).getUTCMinutes()
    const newStartDate = dateOnly(schedule.start_time)
    const newEndDate = (schedule as any).recurrence_end_date ?? null
    const clash = (studentSchedules ?? []).some((e: any) => {
      const s = e.schedule
      if (!s) return false
      if (new Date(s.start_time).getUTCDay() !== newDow) return false
      const exStart = new Date(s.start_time).getUTCHours() * 60 + new Date(s.start_time).getUTCMinutes()
      const exEnd = new Date(s.end_time).getUTCHours() * 60 + new Date(s.end_time).getUTCMinutes()
      if (newStart >= exEnd || newEnd <= exStart) return false
      const sStartDate = dateOnly(s.start_time)
      const sEndDate = s.recurrence_end_date ?? null
      if (newEndDate && sStartDate > newEndDate) return false
      if (sEndDate && newStartDate > sEndDate) return false
      return true
    })
    if (clash) return NextResponse.json({ error: 'El alumno ya tiene otra clase a esa hora.' }, { status: 409 })
  }

  // Pago ya hecho que pasa al grupo nuevo al AÑADIR (doblar clase no hereda;
  // ver carriedOverPaidUntil). Se miran pagos de los últimos meses para
  // incluir adelantos pagados antes del mes en curso. En un cambio de grupo
  // no hace falta: se hereda tal cual lo que tenía la inscripción vieja.
  let paidUntil: string | null = replaced?.paid_until ?? null
  if (!replaced) {
    const [nowYearStr, nowMonthStr] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date()).split('-')
    const currentMonth = `${nowYearStr}-${nowMonthStr}`
    const lookback = new Date(Number(nowYearStr), Number(nowMonthStr) - 1 - CARRYOVER_LOOKBACK_MONTHS, 1)
    const lookbackStr = `${lookback.getFullYear()}-${String(lookback.getMonth() + 1).padStart(2, '0')}-01`
    const { data: recentPayments } = await admin
      .from('payments')
      .select('amount, created_at, metadata')
      .eq('user_id', studentId)
      .eq('club_id', (schedule as any)?.club_id ?? null)
      .eq('type', 'fixed_group_month')
      .eq('status', 'succeeded')
      .gte('created_at', lookbackStr)

    paidUntil = carriedOverPaidUntil({
      payments: (recentPayments ?? []) as CarryoverPayment[],
      otherActivePaidUntil: studentSchedules.map((e: any) => e.paid_until ?? null),
      monthlyPrice: monthlyPrice ?? 0,
      currentMonth,
    })
  }

  // start_date marca desde qué mes debe dinero de verdad esta inscripción —
  // NO cuándo se dio de alta en el sistema (enrolled_at), que puede ser
  // semanas antes de que la clase arranque (ej. temporada nueva). Sin esto,
  // get_pending_payments() usa enrolled_at como respaldo y reclama meses en
  // los que la clase no llegó a dar ni una sola sesión.
  const usesPerClassPricing = !!(pricePerClassCents || courtPricing)
  const computedStartDate = schedule?.start_time ? firstBillableMonth(schedule.start_time, usesPerClassPricing) : null
  const startDate = replaced?.start_date ?? computedStartDate

  // Al cambiar de grupo con la misma cuota se hereda el descuento puntual
  // marcado (cuota ya rebajada + importe descontado). Con otra cuota no, para
  // que al cobrar no se "restaure" una cuota que ya no es la suya.
  const newMonthlyPrice = monthlyPrice ?? replaced?.monthly_price ?? 0
  const keepsDiscount = !!replaced && newMonthlyPrice === replaced.monthly_price
  const inherited = replaced ? {
    discount_classes_pending: replaced.discount_classes_pending ?? 0,
    discount_applied: keepsDiscount ? replaced.discount_applied : false,
    discount_cents: keepsDiscount ? replaced.discount_cents : null,
  } : {}

  // El club de la inscripción es el del propio horario, no el del admin
  // logueado — para un super_admin gestionando otro club, adminUser.club_id
  // suele ser NULL (no está atado a un club), y esto dejaba la inscripción
  // sin club_id, huérfana para cualquier consulta que sí filtre por club.
  const { data, error } = await admin.from('group_enrollments').upsert({
    schedule_id: scheduleId,
    student_id: studentId,
    club_id: (schedule as any)?.club_id ?? null,
    monthly_price: newMonthlyPrice,
    price_per_class_cents: pricePerClassCents ?? replaced?.price_per_class_cents ?? null,
    court_pricing: courtPricing ?? replaced?.court_pricing ?? null,
    status: 'active',
    enrolled_by: user.id,
    enrolled_at: new Date().toISOString(),
    start_date: startDate,
    paid_until: paidUntil,
    ...inherited,
  }, { onConflict: 'schedule_id,student_id' }).select().single()

  if (error) return NextResponse.json({ error: 'Error al inscribir el alumno' }, { status: 400 })

  // Solo con el grupo nuevo ya creado se quita el viejo (igual que "Quitar":
  // sus faltas y la inscripción). Si falla, se deshace el nuevo para no dejar
  // al alumno en los dos.
  if (replaced) {
    const { error: exclErr } = await admin.from('schedule_exclusions').delete().eq('group_enrollment_id', replaced.id)
    const { error: delErr } = exclErr
      ? { error: exclErr }
      : await admin.from('group_enrollments').delete().eq('id', replaced.id).eq('student_id', studentId)
    if (delErr) {
      await admin.from('group_enrollments').delete().eq('id', data.id)
      return NextResponse.json({ error: 'No se pudo completar el cambio de grupo' }, { status: 500 })
    }
  }

  // Cancelar reservas puntuales futuras del alumno en esta clase (ya no las necesita)
  const today = new Date().toISOString().split('T')[0]
  await admin
    .from('bookings')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('student_id', studentId)
    .eq('source', 'admin')
    .gte('class_date', today)

  return NextResponse.json({ data })
}
