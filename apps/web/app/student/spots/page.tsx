import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import { SpotsClient } from './spots-client'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { getClubFeatures } from '@/lib/get-club-features'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TZ = 'Europe/Madrid'

function getNextDate(startTime: string): string {
  const classDow = getDayOfWeek(new Date(startTime))

  // Today's date in Spain timezone — used as the arithmetic base
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const [sy, sm, sd] = todaySpain.split('-').map(Number)
  // Use 10:00 UTC (= noon Spain) so getDayOfWeek gives the correct Spain weekday
  const todayDow = getDayOfWeek(new Date(Date.UTC(sy, sm - 1, sd, 10, 0, 0)))

  const nowHourSpain = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date())
  )
  const classHourSpain = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date(startTime))
  )

  let daysUntil = (classDow - todayDow + 7) % 7
  if (daysUntil === 0 && nowHourSpain >= classHourSpain) {
    daysUntil = 7
  }

  // Add days to Spain's today (UTC noon base keeps the Spain date stable)
  const result = new Date(Date.UTC(sy, sm - 1, sd + daysUntil, 10, 0, 0))
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(result)
}

export default async function StudentSpotsPage() {
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

  const features = await getClubFeatures((userRow as any)?.club_id)
  if (!features.enable_spots) redirect('/student')

  const [{ data: spotsRaw }, { data: myEnrollments }, { data: bag }, { data: schedulesRaw }, { data: mySpotBookings }] = await Promise.all([
    admin
      .from('schedule_exclusions')
      .select(`
        id, excluded_date,
        group_enrollment:group_enrollments!group_enrollment_id(
          schedule_id,
          schedule:schedules!schedule_id(
            id, start_time, end_time, max_students, club_id,
            court:courts(name),
            level:levels(id, name, color),
            coach:users!schedules_coach_id_fkey(name)
          )
        )
      `)
      .eq('publish_spot', true)
      .gte('excluded_date', today)
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
        id, start_time, end_time, max_students,
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

  // Capacity spots: classes with open spots where student is not enrolled
  const absenceScheduleIds = new Set(absenceSpots.map(s => s.scheduleId))

  const capacitySpots = (schedulesRaw ?? [])
    .filter(s => {
      const enrollments = (s.enrollments ?? []) as any[]
      const active = enrollments.filter((e: any) => e.status === 'active')
      const alreadyIn = active.some((e: any) => e.student_id === user.id)
      const levelId = (s.level as any)?.id ?? null
      const levelOk = !myLevelId || !levelId || levelId === myLevelId
      const nextDate = getNextDate(s.start_time)
      const alreadyBooked = (mySpotBookings ?? []).some(
        b => b.schedule_id === s.id && b.class_date === nextDate
      )
      return !alreadyIn && active.length < s.max_students && !absenceScheduleIds.has(s.id) && levelOk && !alreadyBooked
    })
    .map(s => {
      const enrollments = (s.enrollments ?? []) as any[]
      const activeCount = enrollments.filter((e: any) => e.status === 'active').length
      const startDt = new Date(s.start_time)
      const endDt = new Date(s.end_time)
      return {
        spotType: 'capacity' as const,
        exclusionId: null,
        excludedDate: getNextDate(s.start_time),
        scheduleId: s.id,
        dayLabel: DAYS[getDayOfWeek(startDt)],
        startTime: formatTime(startDt),
        endTime: formatTime(endDt),
        durationMin: Math.round((endDt.getTime() - startDt.getTime()) / 60000),
        courtName: (s.court as any)?.name ?? '—',
        coachName: (s.coach as any)?.name ?? null,
        maxStudents: s.max_students,
        level: s.level as any,
        enrolledCount: activeCount,
      }
    })
    .sort((a, b) => a.excludedDate.localeCompare(b.excludedDate))

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

      {allSpots.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-2xl mb-2">🎾</p>
          <p className="text-gray-400">No hay huecos libres disponibles ahora mismo.</p>
          <p className="mt-1 text-xs text-gray-400">Vuelve a consultar más adelante.</p>
        </div>
      ) : (
        <SpotsClient
          spots={allSpots}
          balance60={balance60}
          balance90={balance90}
          enablePayments={features.enable_payments}
          enable60min={features.enable_60min}
          enable90min={features.enable_90min}
        />
      )}
    </div>
  )
}
