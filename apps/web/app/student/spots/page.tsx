import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import { SpotsClient } from './spots-client'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TZ = 'Europe/Madrid'

function getNextDate(startTime: string): string {
  const dt = new Date(startTime)
  const classDow = getDayOfWeek(dt)
  const nowUtc = new Date()
  const nowSpain = new Date(nowUtc.toLocaleString('en-US', { timeZone: TZ }))
  const todayDow = nowSpain.getDay()

  let daysUntil = (classDow - todayDow + 7) % 7
  if (daysUntil === 0) {
    // Class is today — check if it's already past
    const classHour = parseInt(formatTime(dt).split(':')[0])
    const classMin = parseInt(formatTime(dt).split(':')[1])
    if (nowSpain.getHours() > classHour || (nowSpain.getHours() === classHour && nowSpain.getMinutes() >= classMin)) {
      daysUntil = 7
    }
  }

  const next = new Date(nowUtc)
  next.setDate(nowUtc.getDate() + daysUntil)
  return next.toISOString().split('T')[0]
}

export default async function StudentSpotsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const today = new Date().toISOString().split('T')[0]

  const { data: userRow } = await admin
    .from('users')
    .select('current_level_id')
    .eq('id', user.id)
    .single()
  const myLevelId: string | null = userRow?.current_level_id ?? null

  const [{ data: spotsRaw }, { data: myEnrollments }, { data: bag }, { data: schedulesRaw }, { data: mySpotBookings }] = await Promise.all([
    admin
      .from('schedule_exclusions')
      .select(`
        id, excluded_date,
        group_enrollment:group_enrollments!group_enrollment_id(
          schedule_id,
          schedule:schedules!schedule_id(
            id, start_time, end_time, max_students,
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
    admin.from('class_bag').select('balance').eq('user_id', user.id).single(),
    admin
      .from('schedules')
      .select(`
        id, start_time, end_time, max_students,
        court:courts(name),
        level:levels(id, name, color),
        coach:users!schedules_coach_id_fkey(name),
        enrollments:group_enrollments(student_id, status)
      `),
    admin
      .from('bookings')
      .select('schedule_id, class_date, exclusion_id:group_enrollment_id')
      .eq('student_id', user.id)
      .eq('status', 'confirmed')
      .not('class_date', 'is', null),
  ])

  const myScheduleIds = new Set((myEnrollments ?? []).map(e => e.schedule_id))
  const bagBalance = bag?.balance ?? 0
  const bookedScheduleIds = new Set((mySpotBookings ?? []).map(b => b.schedule_id))

  // Absence spots (existing logic)
  const absenceSpots = (spotsRaw ?? [])
    .filter(s => {
      const ge = s.group_enrollment as any
      const schedule = ge?.schedule as any
      const levelId = schedule?.level?.id ?? null
      const levelOk = !myLevelId || !levelId || levelId === myLevelId
      const alreadyBooked = (mySpotBookings ?? []).some(
        b => b.schedule_id === ge?.schedule_id && b.class_date === s.excluded_date
      )
      return ge?.schedule_id && !myScheduleIds.has(ge.schedule_id) && levelOk && !alreadyBooked
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
      const alreadyBooked = bookedScheduleIds.has(s.id)
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
        <SpotsClient spots={allSpots} bagBalance={bagBalance} />
      )}
    </div>
  )
}
