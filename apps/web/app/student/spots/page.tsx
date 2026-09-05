import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import { SpotsClient } from './spots-client'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { getClubFeatures } from '@/lib/get-club-features'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TZ = 'Europe/Madrid'

// Todas las ocurrencias de un horario dentro de [rangeStart, rangeEnd] — a
// diferencia de la versión anterior (solo "la próxima"), esto es lo que
// necesita el calendario de mes: puede haber varias fechas de la misma clase
// visibles a la vez.
function getMonthOccurrences(s: any, rangeStart: string, rangeEnd: string, holidaySet: Set<string>): string[] {
  if (s.recurrence === 'none') {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(s.start_time))
    return d >= rangeStart && d <= rangeEnd ? [d] : []
  }

  const scheduleStartDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(s.start_time))
  const effectiveStart = scheduleStartDate > rangeStart ? scheduleStartDate : rangeStart
  const effectiveEnd = s.recurrence_end_date && s.recurrence_end_date < rangeEnd ? s.recurrence_end_date : rangeEnd
  if (effectiveStart > effectiveEnd) return []

  const dow = getDayOfWeek(s.start_time)
  let cursor = new Date(effectiveStart + 'T12:00:00Z')
  while (getDayOfWeek(cursor) !== dow) cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  const endCursor = new Date(effectiveEnd + 'T12:00:00Z')

  const dates: string[] = []
  while (cursor.getTime() <= endCursor.getTime()) {
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(cursor)
    if (!holidaySet.has(dateStr)) dates.push(dateStr)
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
  }
  return dates
}

export default async function StudentSpotsPage({ searchParams }: { searchParams: { month?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

  const { data: userRow } = await admin
    .from('users')
    .select('current_level_id, club_id')
    .eq('id', user.id)
    .single()
  const myLevelId: string | null = userRow?.current_level_id ?? null
  const myClubId: string | null = (userRow as any)?.club_id ?? null

  // features y clubRow dependen solo de myClubId, ninguno del otro: en paralelo.
  const [features, { data: clubRow }] = await Promise.all([
    getClubFeatures((userRow as any)?.club_id),
    myClubId
      ? admin.from('clubs').select('config').eq('id', myClubId).single()
      : Promise.resolve({ data: null }),
  ])
  if (!features.enable_spots) redirect('/student')

  const holidaySet = new Set<string>((clubRow as any)?.config?.holidays ?? [])
  const billingStartDate: string | null = (clubRow as any)?.config?.billing_start_date ?? null
  const billingActive = !billingStartDate || today >= billingStartDate

  // Mes que se está viendo — por defecto el actual. La navegación no puede
  // pasar de la misma ventana de antelación que ya limita el registro de
  // faltas (Configuración → "Antelación para registrar falta"), porque más
  // allá no hay datos por diseño.
  const [todayYear, todayMonth0] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1]
  const parsedMonth = searchParams.month ? new Date(searchParams.month + '-01') : null
  const year = parsedMonth && !isNaN(parsedMonth.getTime()) ? parsedMonth.getFullYear() : todayYear
  const month0 = parsedMonth && !isNaN(parsedMonth.getTime()) ? parsedMonth.getMonth() : todayMonth0

  const advanceMonthsConfig = (clubRow as any)?.config?.falta_advance_months ?? 0
  const effectiveAdvanceMonths = advanceMonthsConfig > 0 ? advanceMonthsConfig : 2
  const maxDateObj = new Date(todayYear, todayMonth0 + effectiveAdvanceMonths, 1)
  const maxYear = maxDateObj.getFullYear()
  const maxMonth0 = maxDateObj.getMonth()

  const monthStart = `${year}-${String(month0 + 1).padStart(2, '0')}-01`
  const monthEnd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(year, month0 + 1, 0, 12))
  const rangeStart = monthStart > today ? monthStart : today

  const [{ data: spotsRaw }, { data: myEnrollments }, { data: bag }, { data: schedulesRaw }, { data: mySpotBookings }] = await Promise.all([
    admin
      .from('schedule_exclusions')
      .select(`
        id, excluded_date,
        group_enrollment:group_enrollments!group_enrollment_id(
          schedule_id,
          schedule:schedules!schedule_id(
            id, start_time, end_time, max_students, club_id, type, price_cents,
            court:courts(name),
            level:levels(id, name, color),
            coach:users!schedules_coach_id_fkey(name)
          )
        )
      `)
      .eq('publish_spot', true)
      .gte('excluded_date', rangeStart)
      .lte('excluded_date', monthEnd)
      .order('excluded_date'),
    admin
      .from('group_enrollments')
      .select('schedule_id')
      .eq('student_id', user.id)
      .eq('status', 'active'),
    admin.from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).single(),
    admin
      .from('schedules')
      .select(`
        id, start_time, end_time, max_students, recurrence_end_date, type, price_cents, recurrence, intensivo_group_id,
        court:courts(name),
        level:levels(id, name, color),
        coach:users!schedules_coach_id_fkey(name),
        enrollments:group_enrollments(student_id, status)
      `)
      .eq('club_id', myClubId ?? ''),
    admin
      .from('bookings')
      .select('schedule_id, class_date')
      .eq('student_id', user.id)
      .eq('status', 'confirmed')
      .not('class_date', 'is', null),
  ])

  const myScheduleIds = new Set((myEnrollments ?? []).map(e => e.schedule_id))
  const balance60 = bag?.balance_60 ?? 0
  const balance90 = bag?.balance_90 ?? 0

  // Absence spots (existing logic)
  const absenceSpots = (spotsRaw ?? [])
    .filter(s => {
      const ge = s.group_enrollment as any
      const schedule = ge?.schedule as any
      const levelId = schedule?.level?.id ?? null
      const levelOk = !myLevelId || !levelId || levelId === myLevelId
      const clubOk = !myClubId || schedule?.club_id === myClubId
      const alreadyBooked = (mySpotBookings ?? []).some(
        b => b.schedule_id === ge?.schedule_id && b.class_date === s.excluded_date
      )
      return ge?.schedule_id && !myScheduleIds.has(ge.schedule_id) && levelOk && clubOk && !alreadyBooked
    })
    .map(s => {
      const ge = s.group_enrollment as any
      const schedule = ge?.schedule
      const startDt = new Date(schedule?.start_time)
      const endDt = new Date(schedule?.end_time)
      return {
        spotType: 'absence' as const,
        exclusionId: s.id,
        excludedDate: s.excluded_date,
        scheduleId: ge?.schedule_id,
        scheduleType: (schedule?.type ?? 'regular') as 'regular' | 'intensivo',
        schedulePriceCents: (schedule?.price_cents as number | null) ?? null,
        dayLabel: DAYS[getDayOfWeek(startDt)],
        startTime: formatTime(startDt),
        endTime: formatTime(endDt),
        durationMin: Math.round((endDt.getTime() - startDt.getTime()) / 60000),
        courtName: schedule?.court?.name ?? '—',
        coachName: schedule?.coach?.name ?? null,
        maxStudents: schedule?.max_students ?? 4,
        level: schedule?.level ?? null,
        enrolledCount: null,
      }
    })

  // Capacity spots: classes with open spots where student is not enrolled —
  // ahora por cada fecha del mes visible, no solo "la próxima".
  const absenceScheduleIds = new Set(absenceSpots.map(s => s.scheduleId))

  const occurrencesBySchedule: Record<string, string[]> = {}
  for (const s of schedulesRaw ?? []) {
    if (absenceScheduleIds.has(s.id)) continue
    occurrencesBySchedule[s.id] = getMonthOccurrences(s, rangeStart, monthEnd, holidaySet)
  }

  const candidateIds = Object.keys(occurrencesBySchedule).filter(id => occurrencesBySchedule[id].length > 0)

  // Conteo real de asistentes de cada fecha: activos del grupo fijo MENOS
  // quien tiene falta registrada justo ese día, MÁS reservas puntuales ya
  // confirmadas para esa fecha — el mismo criterio que usan las funciones de
  // reserva atómica (book_capacity_spot), para no anunciar como libre una
  // plaza que en realidad ya está completa, ni bloquear una que sí está libre.
  const [{ data: exclusionsForCapacity }, { data: bookingsForCapacity }] = await Promise.all([
    candidateIds.length
      ? admin.from('group_enrollments').select('id, schedule_id, schedule_exclusions(excluded_date)').in('schedule_id', candidateIds).eq('status', 'active')
      : { data: [] },
    candidateIds.length
      ? admin.from('bookings').select('schedule_id, class_date').eq('status', 'confirmed').in('schedule_id', candidateIds)
      : { data: [] },
  ])

  function realAttendingCount(scheduleId: string, activeCount: number, classDate: string): number {
    const absentCount = (exclusionsForCapacity ?? []).filter((e: any) =>
      e.schedule_id === scheduleId && (e.schedule_exclusions ?? []).some((x: any) => x.excluded_date === classDate)
    ).length
    const bookedCount = (bookingsForCapacity ?? []).filter((b: any) =>
      b.schedule_id === scheduleId && b.class_date === classDate
    ).length
    return activeCount - absentCount + bookedCount
  }

  const schedulesById: Record<string, any> = {}
  for (const s of schedulesRaw ?? []) schedulesById[s.id] = s

  const capacitySpots = candidateIds.flatMap((scheduleId) => {
    const s = schedulesById[scheduleId]
    if (!s || s.type === 'intensivo') return [] // Intensivos are handled in /student/intensivos
    const enrollments = (s.enrollments ?? []) as any[]
    const active = enrollments.filter((e: any) => e.status === 'active')
    const alreadyIn = active.some((e: any) => e.student_id === user.id)
    if (alreadyIn) return []
    const levelId = (s.level as any)?.id ?? null
    const levelOk = !myLevelId || !levelId || levelId === myLevelId
    if (!levelOk) return []

    const startDt = new Date(s.start_time)
    const endDt = new Date(s.end_time)

    return occurrencesBySchedule[scheduleId]
      .filter((classDate) => {
        const alreadyBooked = (mySpotBookings ?? []).some(b => b.schedule_id === scheduleId && b.class_date === classDate)
        const realCount = realAttendingCount(scheduleId, active.length, classDate)
        return realCount < s.max_students && !alreadyBooked
      })
      .map((classDate) => ({
        spotType: 'capacity' as const,
        exclusionId: null,
        excludedDate: classDate,
        scheduleId,
        scheduleType: (s.type ?? 'regular') as 'regular' | 'intensivo',
        schedulePriceCents: (s.price_cents as number | null) ?? null,
        dayLabel: DAYS[getDayOfWeek(startDt)],
        startTime: formatTime(startDt),
        endTime: formatTime(endDt),
        durationMin: Math.round((endDt.getTime() - startDt.getTime()) / 60000),
        courtName: (s.court as any)?.name ?? '—',
        coachName: (s.coach as any)?.name ?? null,
        maxStudents: s.max_students,
        level: s.level as any,
        enrolledCount: realAttendingCount(scheduleId, active.length, classDate),
      }))
  }).sort((a, b) => a.excludedDate.localeCompare(b.excludedDate))

  const allSpots = [...absenceSpots, ...capacitySpots]

  return (
    <div className="max-w-2xl">
      <RealtimeRefresh
        channelName={`student-spots-${user.id}`}
        subs={[
          { table: 'schedule_exclusions' },
          { table: 'bookings', filter: `student_id=eq.${user.id}` },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Huecos Libres</h1>
        <p className="text-sm text-gray-500">Plazas disponibles por ausencia de otro alumno o por capacidad libre</p>
      </div>

      <SpotsClient
        spots={allSpots}
        balance60={balance60}
        balance90={balance90}
        enablePayments={features.enable_payments && billingActive}
        enable60min={features.enable_60min}
        enable90min={features.enable_90min}
        cashOnly={features.cash_only_payments}
        year={year}
        month0={month0}
        todayStr={today}
        maxYear={maxYear}
        maxMonth0={maxMonth0}
      />
    </div>
  )
}
