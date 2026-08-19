import type { SupabaseClient } from '@supabase/supabase-js'

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
