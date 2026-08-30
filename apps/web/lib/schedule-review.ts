import type { SupabaseClient } from '@supabase/supabase-js'
import { getDayOfWeek } from '@/lib/utils'

export interface ScheduleReviewInfo {
  hasFalta: boolean
  substituteNames: string[]
  uncoveredCount: number
}

// Domingo (fin de semana lunes-domingo) de la semana de "todaySpain", en hora
// de Madrid. Ancla a mediodía UTC para no toparse con el cambio de hora.
function endOfWeekMadrid(todaySpain: string): string {
  const [y, m, d] = todaySpain.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const jsDay = getDayOfWeek(anchor) // 0=Dom..6=Sáb, hora Madrid
  const daysUntilSunday = jsDay === 0 ? 0 : 7 - jsDay
  const end = new Date(Date.UTC(y, m - 1, d + daysUntilSunday, 12, 0, 0))
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(end)
}

// Para cada horario con alguna falta DENTRO DE LA SEMANA ACTUAL (lunes a
// domingo, no futuras sin límite — mezclar una falta de hoy con otra de
// dentro de 3 semanas en el mismo aviso resulta confuso): quién ha ocupado ya
// el hueco libre (nombre) y cuántas plazas quedan sin cubrir todavía — para
// el aviso de "requiere revisión" tanto en Horarios (admin) como en Mis
// Clases (monitor).
export async function computeScheduleReviewMap(
  admin: SupabaseClient,
  scheduleIds: string[],
  todaySpain: string,
): Promise<Record<string, ScheduleReviewInfo>> {
  if (!scheduleIds.length) return {}

  const weekEnd = endOfWeekMadrid(todaySpain)

  const { data: enrollments } = await admin
    .from('group_enrollments')
    .select('schedule_id, schedule_exclusions(excluded_date)')
    .in('schedule_id', scheduleIds)
    .eq('status', 'active')

  const futureFaltasByDate: Record<string, string[]> = {}
  for (const e of enrollments ?? []) {
    const scheduleId = (e as any).schedule_id
    for (const x of (e as any).schedule_exclusions ?? []) {
      if (x.excluded_date >= todaySpain && x.excluded_date <= weekEnd) {
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
    .lte('class_date', weekEnd)

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

// Igual que computeScheduleReviewMap, pero SIN colapsar por horario: un mapa
// horario → fecha exacta → aviso. Necesario en las vistas de calendario
// semanal (admin y monitor), donde la MISMA clase se repite en todas las
// semanas al navegar — si se colapsara por horario, la falta de una semana
// "se heredaría" visualmente en cualquier otra semana que se navegue. Aquí sí
// se puede mirar cualquier fecha futura sin límite de semana: al ir por fecha
// exacta, una falta de dentro de 3 semanas solo aparece en su propia columna,
// no se mezcla con la de hoy.
export async function computeScheduleReviewByDate(
  admin: SupabaseClient,
  scheduleIds: string[],
  todaySpain: string,
): Promise<Record<string, Record<string, ScheduleReviewInfo>>> {
  if (!scheduleIds.length) return {}

  const { data: enrollments } = await admin
    .from('group_enrollments')
    .select('schedule_id, schedule_exclusions(excluded_date)')
    .in('schedule_id', scheduleIds)
    .eq('status', 'active')

  const faltaDatesBySchedule: Record<string, string[]> = {}
  for (const e of enrollments ?? []) {
    const scheduleId = (e as any).schedule_id
    for (const x of (e as any).schedule_exclusions ?? []) {
      if (x.excluded_date >= todaySpain) {
        if (!faltaDatesBySchedule[scheduleId]) faltaDatesBySchedule[scheduleId] = []
        faltaDatesBySchedule[scheduleId].push(x.excluded_date)
      }
    }
  }
  const scheduleIdsWithFaltas = Object.keys(faltaDatesBySchedule)
  if (!scheduleIdsWithFaltas.length) return {}

  const { data: substituteBookingsRaw } = await admin
    .from('bookings')
    .select('schedule_id, class_date, student:users!bookings_student_id_fkey(name)')
    .in('schedule_id', scheduleIdsWithFaltas)
    .neq('status', 'cancelled')
    .gte('class_date', todaySpain)

  const reviewByDate: Record<string, Record<string, ScheduleReviewInfo>> = {}
  for (const scheduleId of scheduleIdsWithFaltas) {
    const bookingsForSchedule = (substituteBookingsRaw ?? []).filter((b: any) => b.schedule_id === scheduleId)
    const remainingBookingsByDate: Record<string, string[]> = {}
    for (const b of bookingsForSchedule) {
      const name = (b.student as any)?.name
      if (!name) continue
      if (!remainingBookingsByDate[b.class_date]) remainingBookingsByDate[b.class_date] = []
      remainingBookingsByDate[b.class_date].push(name)
    }
    const faltaCountByDate: Record<string, number> = {}
    for (const date of faltaDatesBySchedule[scheduleId]) {
      faltaCountByDate[date] = (faltaCountByDate[date] ?? 0) + 1
    }
    for (const [date, faltaCount] of Object.entries(faltaCountByDate)) {
      const available = [...(remainingBookingsByDate[date] ?? [])]
      const substituteNames: string[] = []
      let uncoveredCount = 0
      for (let i = 0; i < faltaCount; i++) {
        if (available.length > 0) substituteNames.push(available.shift()!)
        else uncoveredCount++
      }
      if (!reviewByDate[scheduleId]) reviewByDate[scheduleId] = {}
      reviewByDate[scheduleId][date] = { hasFalta: true, substituteNames, uncoveredCount }
    }
  }
  return reviewByDate
}
