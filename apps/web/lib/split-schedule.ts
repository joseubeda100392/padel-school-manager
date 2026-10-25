import type { SupabaseClient } from '@supabase/supabase-js'
import { dayBefore } from '@/lib/enrollment-window'
import { endEnrollment } from '@/lib/end-enrollment'
import { madridDayOfWeek } from '@/lib/madrid-time'
import { cancelBookingsAfter, moveOrDropDayItemsAfter } from '@/lib/schedule-from-date'

export interface ScheduleChanges {
  court_id: string
  coach_id: string
  level_id: string | null
  start_time: string
  end_time: string
  recurrence: string
  recurrence_end_date: string | null
  max_students: number
}

// Editar una clase a partir de un día sin tocar lo anterior: la clase de
// siempre acaba el día antes de `fromDay` (fecha de changes.start_time) y la
// versión cambiada es una clase nueva desde ese día. Así las clases pasadas
// conservan su hora, monitor, pista y alumnos de entonces.
// - Fijos: cada uno pasa a la clase nueva desde ese día con su cuota, lo
//   pagado (paid_until), sus descuentos y sus faltas posteriores; la
//   inscripción vieja termina el día anterior (historial) y la nueva la
//   sustituye (replaces_enrollment_id), así la cuota de ese mes se cobra una
//   sola vez (ver get_pending_payments).
// - Reservas, cambios de un día y listas de espera posteriores pasan a la clase
//   nueva si se queda el mismo día de la semana; si cambia de día, esas fechas
//   ya no tienen clase: se anulan (devolviendo la bolsa) y las faltas se borran.
export async function splitSchedule(
  admin: SupabaseClient,
  old: Record<string, any>,
  changes: ScheduleChanges,
  fromDay: string,
  today: string,
): Promise<{ newId: string; moved: number; bookingsCancelled: number; paidByCard: number }> {
  const lastDay = dayBefore(fromDay)
  const sameWeekday = madridDayOfWeek(old.start_time) === madridDayOfWeek(changes.start_time)

  const { id: _id, created_at: _c, updated_at: _u, ...copy } = old
  const { data: created, error: insErr } = await admin.from('schedules').insert({ ...copy, ...changes }).select('id').single()
  if (insErr || !created) throw new Error(insErr?.message ?? 'No se ha podido crear la clase nueva')
  const newId = created.id as string

  const { data: enrollments } = await admin
    .from('group_enrollments')
    .select('*')
    .eq('schedule_id', old.id)
    .eq('status', 'active')
  const moving = (enrollments ?? []).filter(e => !e.end_date || e.end_date >= fromDay)

  const newRows = moving.map(e => ({
    schedule_id: newId,
    student_id: e.student_id,
    club_id: e.club_id,
    monthly_price: e.monthly_price,
    price_per_class_cents: e.price_per_class_cents,
    court_pricing: e.court_pricing,
    discount_applied: e.discount_applied,
    discount_cents: e.discount_cents,
    discount_classes_pending: e.discount_classes_pending,
    paid_until: e.paid_until,
    status: 'active',
    start_date: e.start_date && e.start_date > fromDay ? e.start_date : fromDay,
    end_date: e.end_date,
    enrolled_by: e.enrolled_by,
    enrolled_at: new Date().toISOString(),
    replaces_enrollment_id: e.id,
  }))
  if (newRows.length) {
    const { data: inserted, error } = await admin.from('group_enrollments').insert(newRows).select('id, replaces_enrollment_id')
    if (error || !inserted) {
      await admin.from('schedules').delete().eq('id', newId)
      throw new Error(error?.message ?? 'No se han podido pasar los alumnos a la clase nueva')
    }
    for (const n of inserted) {
      // Faltas posteriores: a la inscripción nueva si siguen siendo días de clase.
      if (sameWeekday) {
        await admin.from('schedule_exclusions').update({ group_enrollment_id: n.id }).eq('group_enrollment_id', n.replaces_enrollment_id).gte('excluded_date', fromDay)
      }
    }
    // Los descuentos pendientes pasan a la nueva (no se aplican dos veces).
    await admin.from('group_enrollments').update({ discount_applied: false, discount_cents: null, discount_classes_pending: 0 }).in('id', moving.map(e => e.id))
    for (const e of moving) await endEnrollment(admin, e, lastDay, today)
  }

  let bookingsCancelled = 0, paidByCard = 0
  if (sameWeekday) {
    await admin.from('bookings').update({ schedule_id: newId }).eq('schedule_id', old.id).not('class_date', 'is', null).gt('class_date', lastDay)
  } else {
    ;({ cancelled: bookingsCancelled, paidByCard } = await cancelBookingsAfter(admin, old.id, lastDay, old.club_id, 'Clase cambiada de día por el club'))
  }
  await moveOrDropDayItemsAfter(admin, old.id, lastDay, sameWeekday ? newId : null)

  const oldEnd = old.recurrence_end_date && old.recurrence_end_date < lastDay ? old.recurrence_end_date : lastDay
  await admin.from('schedules').update({ recurrence_end_date: oldEnd }).eq('id', old.id)

  return { newId, moved: moving.length, bookingsCancelled, paidByCard }
}
