import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import { SpotBookingCard } from './spot-booking-card'
import { ScheduleSpotsPanel } from './schedule-spots-panel'
import { UpcomingClassCard } from './upcoming-class-card'
import { RealtimeRefresh } from '@/components/realtime-refresh'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TZ = 'Europe/Madrid'

function getNextDate(startTime: string): string {
  const classDow = getDayOfWeek(new Date(startTime))
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const [sy, sm, sd] = todaySpain.split('-').map(Number)
  const todayDow = getDayOfWeek(new Date(Date.UTC(sy, sm - 1, sd, 10, 0, 0)))
  const nowHourSpain = parseInt(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date()))
  const classHourSpain = parseInt(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date(startTime)))
  let daysUntil = (classDow - todayDow + 7) % 7
  if (daysUntil === 0 && nowHourSpain >= classHourSpain) daysUntil = 7
  const result = new Date(Date.UTC(sy, sm - 1, sd + daysUntil, 10, 0, 0))
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(result)
}

function getUpcomingOccurrences(
  startTime: string,
  cancellationHours: number,
  count = 8,
): { dateStr: string; label: string; canRegister: boolean }[] {
  const base = new Date(startTime)
  const now = new Date()
  const first = new Date(now)
  first.setHours(base.getHours(), base.getMinutes(), 0, 0)
  const diff = (base.getDay() - now.getDay() + 7) % 7
  first.setDate(now.getDate() + (diff === 0 && first <= now ? 7 : diff))

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first)
    d.setDate(d.getDate() + i * 7)
    const dateStr = d.toISOString().split('T')[0]
    const hoursUntil = (d.getTime() - Date.now()) / 3600000
    const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    return { dateStr, label, canRegister: hoursUntil >= cancellationHours }
  })
}

function isPaidThisMonth(paidUntil: string | null) {
  if (!paidUntil) return false
  const now = new Date()
  return new Date(paidUntil) >= new Date(now.getFullYear(), now.getMonth() + 1, 0)
}

export default async function StudentSchedulePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const todayISO = new Date().toISOString().split('T')[0]

  const { data: enrollments } = await getAdminClient()
    .from('group_enrollments')
    .select(`
      id, monthly_price, paid_until, enrolled_at,
      schedule:schedules(id, start_time, end_time, max_students,
        court:courts(name),
        level:levels(id, name, color)
      )
    `)
    .eq('student_id', user.id)
    .eq('status', 'active')
    .order('enrolled_at')

  const enrollmentIds = (enrollments ?? []).map(e => e.id)
  const { data: exclusionsRaw } = enrollmentIds.length
    ? await getAdminClient()
        .from('schedule_exclusions')
        .select('id, group_enrollment_id, excluded_date, publish_spot')
        .in('group_enrollment_id', enrollmentIds)
        .gte('excluded_date', todayISO)
        .order('excluded_date')
    : { data: [] }

  const [{ data: cfgRow }, { data: spotBookings }, { data: userRow }, { data: spotsRaw }, { data: schedulesRaw }, { data: bag }, { data: mySpotBookings }] = await Promise.all([
    getAdminClient().from('app_config').select('value').eq('key', 'cancellation_hours').single(),
    getAdminClient()
      .from('bookings')
      .select(`
        id, class_date, status, source,
        schedule:schedules(id, start_time, end_time, max_students,
          court:courts(name),
          level:levels(name, color),
          coach:users!schedules_coach_id_fkey(name)
        )
      `)
      .eq('student_id', user.id)
      .eq('status', 'confirmed')
      .not('class_date', 'is', null)
      .gte('class_date', (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })())
      .order('class_date'),
    getAdminClient().from('users').select('current_level_id').eq('id', user.id).single(),
    getAdminClient()
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
    getAdminClient()
      .from('schedules')
      .select(`
        id, start_time, end_time, max_students,
        court:courts(name),
        level:levels(id, name, color),
        coach:users!schedules_coach_id_fkey(name),
        enrollments:group_enrollments(student_id, status)
      `),
    getAdminClient().from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).single(),
    getAdminClient()
      .from('bookings')
      .select('schedule_id, class_date')
      .eq('student_id', user.id)
      .eq('status', 'confirmed')
      .not('class_date', 'is', null),
  ])

  const cancellationHours = cfgRow ? Number(cfgRow.value) : 24
  const myLevelId: string | null = userRow?.current_level_id ?? null
  const balance60 = bag?.balance_60 ?? 0
  const balance90 = bag?.balance_90 ?? 0
  const myScheduleIds = new Set((enrollments ?? []).map(e => (e.schedule as any)?.id).filter(Boolean))

  // Absence spots
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
        durationMin: Math.round((endDt.getTime() - startDt.getTime()) / 60000),
        courtName: schedule?.court?.name ?? '—',
        coachName: schedule?.coach?.name ?? null,
        maxStudents: schedule?.max_students ?? 4,
        level: schedule?.level ?? null,
        enrolledCount: null,
      }
    })

  // Capacity spots
  const absenceScheduleIds = new Set(absenceSpots.map(s => s.scheduleId))
  const capacitySpots = (schedulesRaw ?? [])
    .filter(s => {
      const enrollments2 = (s.enrollments ?? []) as any[]
      const active = enrollments2.filter((e: any) => e.status === 'active')
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
      const enrollments2 = (s.enrollments ?? []) as any[]
      const activeCount = enrollments2.filter((e: any) => e.status === 'active').length
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

  const availableSpots = [...absenceSpots, ...capacitySpots]

  const items = (enrollments ?? []).map(e => {
    const schedule = e.schedule as any
    const upcomingOccurrences = getUpcomingOccurrences(schedule?.start_time ?? '', cancellationHours)
    const myExclusions = (exclusionsRaw ?? [])
      .filter(x => x.group_enrollment_id === e.id)
      .map(x => ({ id: x.id, excluded_date: x.excluded_date, publish_spot: x.publish_spot }))

    return {
      enrollmentId: e.id,
      monthlyPrice: e.monthly_price,
      paidUntil: e.paid_until,
      isPaid: isPaidThisMonth(e.paid_until),
      upcomingOccurrences,
      schedule: {
        id: schedule?.id,
        dayLabel: DAYS[getDayOfWeek(schedule?.start_time)],
        startTime: formatTime(schedule?.start_time),
        endTime: formatTime(schedule?.end_time),
        courtName: schedule?.court?.name ?? '—',
        levelId: schedule?.level?.id ?? null,
        level: schedule?.level ? { name: schedule.level.name, color: schedule.level.color } : null,
      },
      exclusions: myExclusions,
    }
  })

  // Upcoming events — flat list of occurrences in the next 14 days, sorted by date
  const twoWeeksFromNow = new Date()
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14)
  const upcomingEvents = items
    .flatMap(item =>
      item.upcomingOccurrences
        .filter(occ => new Date(occ.dateStr) <= twoWeeksFromNow)
        .map(occ => ({
          ...occ,
          enrollmentId: item.enrollmentId,
          scheduleId: item.schedule.id,
          startTime: item.schedule.startTime,
          endTime: item.schedule.endTime,
          courtName: item.schedule.courtName,
          levelId: item.schedule.levelId,
          level: item.schedule.level,
          isPaid: item.isPaid,
          monthlyPrice: item.monthlyPrice,
          isExcluded: item.exclusions.some(x => x.excluded_date === occ.dateStr),
          exclusionId: item.exclusions.find(x => x.excluded_date === occ.dateStr)?.id ?? null,
        })),
    )
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr))

  return (
    <div className="space-y-5">
      <RealtimeRefresh
        channelName={`student-schedule-${user.id}`}
        subs={[
          { table: 'schedule_exclusions' },
          { table: 'bookings', filter: `student_id=eq.${user.id}` },
          { table: 'group_enrollments', filter: `student_id=eq.${user.id}` },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight" style={{color:'#0b1c30'}}>Mi Agenda</h1>
          <p className="text-[13px] mt-0.5" style={{color:'#3e4a3d'}}>Tus próximas clases y sesiones disponibles.</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold" style={{background:'rgba(0,107,44,0.08)',color:'#006b2c'}}>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          {items.length} clase{items.length !== 1 ? 's' : ''} activa{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Sesiones disponibles — horizontal ── */}
      <ScheduleSpotsPanel
        spots={availableSpots}
        balance60={balance60}
        balance90={balance90}
      />

      {/* ── Próximas clases — 2 semanas ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold" style={{color:'#0b1c30'}}>Próximas 2 semanas</h2>
          {upcomingEvents.length > 0 && (
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{background:'rgba(0,107,44,0.08)',color:'#006b2c'}}>
              {upcomingEvents.length}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border p-10 text-center" style={{background:'rgba(255,255,255,0.85)',backdropFilter:'blur(8px)',borderColor:'#bdcaba'}}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{background:'#eff4ff'}}>
              <svg className="h-6 w-6" style={{color:'#bdcaba'}} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <p className="text-[13px] font-semibold" style={{color:'#3e4a3d'}}>No estás inscrito en ninguna clase.</p>
            <p className="mt-1 text-[12px]" style={{color:'#bdcaba'}}>Habla con tu administrador para inscribirte.</p>
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center" style={{background:'rgba(255,255,255,0.85)',backdropFilter:'blur(8px)',borderColor:'#bdcaba'}}>
            <p className="text-[13px]" style={{color:'#bdcaba'}}>No hay clases en los próximos 14 días.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map(ev => (
              <UpcomingClassCard
                key={ev.scheduleId + '-' + ev.dateStr}
                event={ev}
                cancellationHours={cancellationHours}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Reservas puntuales confirmadas ── */}
      {(spotBookings ?? []).length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[15px] font-extrabold" style={{color:'#0b1c30'}}>Mis reservas</h2>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{background:'rgba(0,107,44,0.08)',color:'#006b2c'}}>
              {(spotBookings ?? []).length}
            </span>
          </div>
          <div className="space-y-3">
            {(spotBookings ?? []).map(b => (
              <SpotBookingCard
                key={b.id}
                booking={{
                  id: b.id,
                  class_date: b.class_date as string,
                  source: b.source as string,
                  schedule: b.schedule as any,
                }}
                cancellationHours={cancellationHours}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
