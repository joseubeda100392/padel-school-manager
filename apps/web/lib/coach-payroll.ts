import type { SupabaseClient } from '@supabase/supabase-js'
import { getDayOfWeek } from '@/lib/utils'

// Horas/importe pendientes de pagar a un profesor: suma la duración de
// todas las sesiones confirmadas como "dadas" desde el final del último
// periodo ya pagado (o desde siempre, si nunca se le ha pagado nada).
export async function calculateCoachPending(
  admin: SupabaseClient,
  coachId: string,
  clubId: string,
): Promise<{ hours: number; amountCents: number; sessionCount: number; periodStart: string | null; hourlyRateCents: number | null }> {
  const { data: coachRow } = await admin.from('users').select('hourly_rate_cents').eq('id', coachId).single()
  const hourlyRateCents = (coachRow as any)?.hourly_rate_cents ?? null

  const { data: lastPayout } = await admin
    .from('coach_payouts')
    .select('period_end')
    .eq('coach_id', coachId)
    .eq('club_id', clubId)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  const periodStart = (lastPayout as any)?.period_end ?? null

  let query = admin
    .from('class_sessions')
    .select('session_date, schedule:schedules!inner(coach_id, start_time, end_time)')
    .eq('club_id', clubId)
    .eq('status', 'given')
    .not('confirmed_by_admin', 'is', null)
    .eq('schedule.coach_id', coachId)
  if (periodStart) query = query.gt('session_date', periodStart)

  const { data: sessions } = await query

  let totalMinutes = 0
  for (const s of sessions ?? []) {
    const schedule = (s as any).schedule
    if (!schedule) continue
    totalMinutes += Math.round((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000)
  }
  const hours = totalMinutes / 60
  const amountCents = hourlyRateCents ? Math.round(hours * hourlyRateCents) : 0

  return { hours, amountCents, sessionCount: sessions?.length ?? 0, periodStart, hourlyRateCents }
}

// Horas dadas por un profesor dentro del mes en curso (huso Europe/Madrid).
// A diferencia de calculateCoachPending (que cuenta desde el último pago),
// esto es solo informativo para el admin y no depende de ningún ciclo de
// pago — se deriva de session_date en cada consulta, así que "se reinicia"
// solo por el hecho de que el mes nuevo aún no tiene sesiones.
export async function calculateCoachMonthlyHours(
  admin: SupabaseClient,
  coachId: string,
  clubId: string,
): Promise<{ hours: number; sessionCount: number }> {
  const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  const monthStart = todayMadrid.slice(0, 7) + '-01'

  const { data: sessions } = await admin
    .from('class_sessions')
    .select('session_date, schedule:schedules!inner(coach_id, start_time, end_time)')
    .eq('club_id', clubId)
    .eq('status', 'given')
    .not('confirmed_by_admin', 'is', null)
    .eq('schedule.coach_id', coachId)
    .gte('session_date', monthStart)

  let totalMinutes = 0
  for (const s of sessions ?? []) {
    const schedule = (s as any).schedule
    if (!schedule) continue
    totalMinutes += Math.round((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000)
  }

  return { hours: totalMinutes / 60, sessionCount: sessions?.length ?? 0 }
}

function durationMinutes(schedule: { start_time: string; end_time: string }): number {
  return Math.round((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000)
}

// Horas dadas por un profesor este mes, calculadas automáticamente a partir
// de su horario fijo — sin que nadie tenga que marcar nada. Pensado para
// clubes SIN el módulo de validación de clases (ese caso usa
// calculateCoachMonthlyHours, más preciso pero manual, exclusivo de las
// urbanizaciones). Cuenta una sesión por cada día que coincide con el día
// de la semana del horario, dentro del mes en curso y hasta hoy, salvo
// festivos del club o clases canceladas explícitamente por el club.
export async function calculateCoachScheduledMonthlyHours(
  admin: SupabaseClient,
  coachId: string,
  clubId: string,
): Promise<{ hours: number; sessionCount: number }> {
  const madridFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' })
  const todayMadrid = madridFmt.format(new Date())
  const monthStart = todayMadrid.slice(0, 7) + '-01'

  const [{ data: schedules }, { data: club }] = await Promise.all([
    admin
      .from('schedules')
      .select('id, start_time, end_time, recurrence, recurrence_end_date')
      .eq('coach_id', coachId)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .eq('type', 'regular'),
    admin.from('clubs').select('config').eq('id', clubId).single(),
  ])

  const holidaySet = new Set<string>((club as any)?.config?.holidays ?? [])
  const scheduleList = (schedules ?? []) as any[]
  const scheduleIds = scheduleList.map((s) => s.id)

  // Clases canceladas explícitamente por el club (cancel-session inserta una
  // schedule_exclusion con este motivo exacto para cada alumno inscrito) —
  // para no contarlas como dadas.
  const cancelledByScheduleDate = new Set<string>()
  if (scheduleIds.length) {
    const { data: enrollments } = await admin
      .from('group_enrollments')
      .select('id, schedule_id')
      .in('schedule_id', scheduleIds)
    const scheduleByEnrollment: Record<string, string> = {}
    for (const e of enrollments ?? []) scheduleByEnrollment[(e as any).id] = (e as any).schedule_id
    const enrollmentIds = (enrollments ?? []).map((e: any) => e.id)

    if (enrollmentIds.length) {
      const { data: cancellations } = await admin
        .from('schedule_exclusions')
        .select('group_enrollment_id, excluded_date')
        .in('group_enrollment_id', enrollmentIds)
        .eq('reason', 'Clase cancelada por el club')
        .gte('excluded_date', monthStart)
      for (const c of cancellations ?? []) {
        const scheduleId = scheduleByEnrollment[(c as any).group_enrollment_id]
        if (scheduleId) cancelledByScheduleDate.add(`${scheduleId}|${(c as any).excluded_date}`)
      }
    }
  }

  let totalMinutes = 0
  let sessionCount = 0

  for (const s of scheduleList) {
    const minutes = durationMinutes(s)

    if (s.recurrence === 'none') {
      const d = madridFmt.format(new Date(s.start_time))
      if (d >= monthStart && d <= todayMadrid && !cancelledByScheduleDate.has(`${s.id}|${d}`)) {
        totalMinutes += minutes
        sessionCount++
      }
      continue
    }

    const scheduleStartDate = madridFmt.format(new Date(s.start_time))
    const rangeStart = scheduleStartDate > monthStart ? scheduleStartDate : monthStart
    if (rangeStart > todayMadrid) continue

    const scheduleDow = getDayOfWeek(s.start_time)
    let cursor = new Date(rangeStart + 'T12:00:00Z')
    const end = new Date(todayMadrid + 'T12:00:00Z')
    while (cursor.getTime() <= end.getTime()) {
      const dateStr = madridFmt.format(cursor)
      if (
        getDayOfWeek(cursor) === scheduleDow &&
        !holidaySet.has(dateStr) &&
        (!s.recurrence_end_date || dateStr <= s.recurrence_end_date) &&
        !cancelledByScheduleDate.has(`${s.id}|${dateStr}`)
      ) {
        totalMinutes += minutes
        sessionCount++
      }
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    }
  }

  return { hours: totalMinutes / 60, sessionCount }
}
