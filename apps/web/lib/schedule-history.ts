import type { SupabaseClient } from '@supabase/supabase-js'

// Clases que ya tienen historial: sesiones dadas (horas de monitores),
// reservas de días pasados o alumnos fijos que ya han estado en el grupo.
// Borrarlas del todo se lleva ese historial (y antes devolvía a la bolsa
// clases ya disfrutadas): para estas se usa "Quitar a partir de un día".
export async function schedulesWithHistory(admin: SupabaseClient, scheduleIds: string[], today: string): Promise<Set<string>> {
  if (!scheduleIds.length) return new Set()
  const [{ data: sessions }, { data: pastBookings }, { data: enrollments }] = await Promise.all([
    admin.from('class_sessions').select('schedule_id').in('schedule_id', scheduleIds),
    admin.from('bookings').select('schedule_id').in('schedule_id', scheduleIds).not('class_date', 'is', null).lt('class_date', today),
    admin.from('group_enrollments').select('schedule_id, start_date, enrolled_at, status').in('schedule_id', scheduleIds).neq('status', 'pending'),
  ])
  const withHistory = new Set<string>()
  for (const s of sessions ?? []) withHistory.add(s.schedule_id)
  for (const b of pastBookings ?? []) withHistory.add(b.schedule_id)
  for (const e of enrollments ?? []) {
    const since = e.start_date ?? (e.enrolled_at ? String(e.enrolled_at).slice(0, 10) : null)
    if (e.status === 'ended' || (since && since < today)) withHistory.add(e.schedule_id)
  }
  return withHistory
}
