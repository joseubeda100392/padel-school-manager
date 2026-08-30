import type { SupabaseClient } from '@supabase/supabase-js'

export interface ScheduleReviewInfo {
  hasFalta: boolean
  substituteNames: string[]
  uncoveredCount: number
}

// Para cada horario con alguna falta futura (cualquier fecha por venir, no
// solo la próxima clase): quién ha ocupado ya el hueco libre (nombre) y
// cuántas plazas quedan sin cubrir todavía — para el aviso de "requiere
// revisión" tanto en Horarios (admin) como en Mis Clases (monitor).
export async function computeScheduleReviewMap(
  admin: SupabaseClient,
  scheduleIds: string[],
  todaySpain: string,
): Promise<Record<string, ScheduleReviewInfo>> {
  if (!scheduleIds.length) return {}

  const { data: enrollments } = await admin
    .from('group_enrollments')
    .select('schedule_id, schedule_exclusions(excluded_date)')
    .in('schedule_id', scheduleIds)
    .eq('status', 'active')

  const futureFaltasByDate: Record<string, string[]> = {}
  for (const e of enrollments ?? []) {
    const scheduleId = (e as any).schedule_id
    for (const x of (e as any).schedule_exclusions ?? []) {
      if (x.excluded_date >= todaySpain) {
        if (!futureFaltasByDate[scheduleId]) futureFaltasByDate[scheduleId] = []
        futureFaltasByDate[scheduleId].push(x.excluded_date)
      }
    }
  }
  const scheduleIdsWithFaltas = Object.keys(futureFaltasByDate)
  if (!scheduleIdsWithFaltas.length) return {}

  const { data: substituteBookingsRaw } = await admin
    .from('bookings')
    .select('schedule_id, class_date, student:users!bookings_student_id_fkey(name)')
    .in('schedule_id', scheduleIdsWithFaltas)
    .neq('status', 'cancelled')
    .gte('class_date', todaySpain)

  const reviewInfoMap: Record<string, ScheduleReviewInfo> = {}
  for (const scheduleId of scheduleIdsWithFaltas) {
    const faltaDates = futureFaltasByDate[scheduleId]
    const bookingsForSchedule = (substituteBookingsRaw ?? []).filter((b: any) => b.schedule_id === scheduleId)
    const remainingBookingsByDate: Record<string, string[]> = {}
    for (const b of bookingsForSchedule) {
      const name = (b.student as any)?.name
      if (!name) continue
      if (!remainingBookingsByDate[b.class_date]) remainingBookingsByDate[b.class_date] = []
      remainingBookingsByDate[b.class_date].push(name)
    }
    const substituteNames: string[] = []
    let uncoveredCount = 0
    for (const date of faltaDates) {
      const available = remainingBookingsByDate[date] ?? []
      if (available.length > 0) {
        substituteNames.push(available.shift()!)
      } else {
        uncoveredCount++
      }
    }
    reviewInfoMap[scheduleId] = { hasFalta: true, substituteNames, uncoveredCount }
  }
  return reviewInfoMap
}
