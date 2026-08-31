export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { redirect } from 'next/navigation'
import { calculateCoachPending, calculateCoachMonthlyHours } from '@/lib/coach-payroll'
import { ClassValidationClient } from './class-validation-client'

export default async function ClassValidationPage({ searchParams }: { searchParams: { month?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const clubId = await getClubId()
  const features = await getClubFeatures(clubId ?? undefined)
  if (!features.enable_class_validation) redirect('/dashboard')

  // Horas trabajadas: el límite para "Siguiente" es el mes de calendario
  // real de hoy, no se puede adelantar a un mes que aún no ha pasado.
  const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  const [todayYear, todayMonth0] = [Number(todayMadrid.slice(0, 4)), Number(todayMadrid.slice(5, 7)) - 1]
  const parsedMonth = searchParams.month ? new Date(searchParams.month + '-01') : null
  const selectedYear = parsedMonth && !isNaN(parsedMonth.getTime()) ? parsedMonth.getFullYear() : todayYear
  const selectedMonth0 = parsedMonth && !isNaN(parsedMonth.getTime()) ? parsedMonth.getMonth() : todayMonth0

  // pendingRaw y coaches dependen solo de clubId, ninguno del otro: en paralelo.
  const [{ data: pendingRaw }, { data: coaches }] = await Promise.all([
    admin
      .from('class_sessions')
      .select(`
        id, schedule_id, session_date, status, cancel_reason, marked_by_coach_at,
        coach:users!class_sessions_marked_by_coach_fkey(name),
        schedule:schedules(start_time, end_time, court:courts(name), coach:users!schedules_coach_id_fkey(name)),
        absences:class_session_absences(id, student:users!class_session_absences_student_id_fkey(id, name))
      `)
      .eq('club_id', clubId ?? '')
      .not('marked_by_coach', 'is', null)
      .is('confirmed_by_admin', null)
      .order('session_date'),
    clubId
      ? admin.from('users').select('id, name, email, hourly_rate_cents').eq('club_id', clubId).eq('role', 'coach').eq('is_active', true).order('name')
      : { data: [] },
  ])

  const pending = (pendingRaw ?? []).map((s: any) => ({
    id: s.id,
    scheduleId: s.schedule_id,
    sessionDate: s.session_date,
    status: s.status as 'given' | 'not_given',
    cancelReason: s.cancel_reason,
    markedAt: s.marked_by_coach_at,
    coachName: s.schedule?.coach?.name ?? s.coach?.name ?? '—',
    courtName: s.schedule?.court?.name ?? '—',
    startTime: s.schedule?.start_time ?? null,
    absences: (s.absences ?? []).map((a: any) => ({ id: a.id, studentId: a.student?.id, studentName: a.student?.name })),
  }))

  const payroll = await Promise.all(
    (coaches ?? []).map(async (coach) => {
      const [pendingPay, monthly] = await Promise.all([
        calculateCoachPending(admin, coach.id, clubId ?? ''),
        calculateCoachMonthlyHours(admin, coach.id, clubId ?? '', { year: selectedYear, month0: selectedMonth0 }),
      ])
      return { id: coach.id, name: coach.name, email: coach.email, ...pendingPay, monthlyHours: monthly.hours, monthlySessionCount: monthly.sessionCount }
    })
  )

  return (
    <ClassValidationClient
      initialPending={pending}
      initialPayroll={payroll}
      selectedYear={selectedYear}
      selectedMonth={selectedMonth0}
      maxYear={todayYear}
      maxMonth={todayMonth0}
    />
  )
}
