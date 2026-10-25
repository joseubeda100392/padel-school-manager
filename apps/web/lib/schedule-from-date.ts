import type { SupabaseClient } from '@supabase/supabase-js'

// Lo que pasa con lo "posterior" de una clase cuando cambia o se quita a
// partir de un día. lastDay es el último día de la versión vieja: lo de ese
// día y antes no se toca nunca.

// Reservas puntuales de días posteriores: se anulan y se devuelve a la bolsa la
// clase que gastaron. Las pagadas con tarjeta se cuentan para que el club
// devuelva el dinero aparte.
export async function cancelBookingsAfter(
  admin: SupabaseClient, scheduleId: string, lastDay: string, fallbackClubId: string | null, reason: string,
): Promise<{ cancelled: number; paidByCard: number }> {
  const { data: later } = await admin
    .from('bookings')
    .select('id, club_id, source, status')
    .eq('schedule_id', scheduleId)
    .not('class_date', 'is', null)
    .gt('class_date', lastDay)
  const ids = (later ?? []).map(b => b.id)
  const paidByCard = (later ?? []).filter(b => b.source === 'pay_per_class' && b.status !== 'cancelled').length
  if (!ids.length) return { cancelled: 0, paidByCard: 0 }

  const clubByBooking = new Map((later ?? []).map(b => [b.id, b.club_id]))
  const { data: debits } = await admin
    .from('bag_transactions')
    .select('user_id, delta, class_duration, booking_id')
    .in('booking_id', ids)
    .eq('type', 'debit')
  for (const tx of debits ?? []) {
    await admin.rpc('credit_class_bag', {
      p_user_id: tx.user_id,
      p_club_id: clubByBooking.get(tx.booking_id) ?? fallbackClubId,
      p_delta: Math.abs(tx.delta),
      p_pack_type: tx.class_duration ?? '60',
      p_reason: reason,
    })
  }
  await admin.from('bag_transactions').delete().in('booking_id', ids)
  await admin.from('bookings').delete().in('id', ids)
  return { cancelled: ids.length, paidByCard }
}

// Cambios de un día (hora, monitor) y listas de espera de días posteriores.
// Con toScheduleId se pasan a la clase nueva (mismo día de la semana: las
// fechas siguen siendo válidas); sin él, se borran.
export async function moveOrDropDayItemsAfter(
  admin: SupabaseClient, scheduleId: string, lastDay: string, toScheduleId: string | null,
): Promise<void> {
  const tables: [string, string][] = [
    ['schedule_time_overrides', 'override_date'],
    ['schedule_coach_overrides', 'override_date'],
    ['class_waitlist', 'class_date'],
  ]
  await Promise.all(tables.map(([table, col]) => toScheduleId
    ? admin.from(table).update({ schedule_id: toScheduleId }).eq('schedule_id', scheduleId).gt(col, lastDay)
    : admin.from(table).delete().eq('schedule_id', scheduleId).gt(col, lastDay)))
}
