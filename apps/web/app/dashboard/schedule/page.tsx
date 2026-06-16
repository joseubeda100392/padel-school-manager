export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { getDayOfWeek } from '@/lib/utils'
import ScheduleTable from './schedule-table'
import WeeklyCalendar from './weekly-calendar'
import ScheduleViewToggle from './schedule-view-toggle'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { DevError } from '@/components/dev-error'

const TZ = 'Europe/Madrid'

function getNextDate(startTime: string): string {
  const classDow = getDayOfWeek(new Date(startTime))
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const [sy, sm, sd] = todaySpain.split('-').map(Number)
  const todayDow = getDayOfWeek(new Date(Date.UTC(sy, sm - 1, sd, 10, 0, 0)))
  const nowHourSpain = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date())
  )
  const classHourSpain = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date(startTime))
  )
  let daysUntil = (classDow - todayDow + 7) % 7
  if (daysUntil === 0 && nowHourSpain >= classHourSpain) daysUntil = 7
  const result = new Date(Date.UTC(sy, sm - 1, sd + daysUntil, 10, 0, 0))
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(result)
}

export default async function SchedulePage({ searchParams }: { searchParams: { view?: string } }) {
  const supabase = createClient()
  const admin = getAdminClient()
  const clubId = await getClubId()
  const view = searchParams.view === 'week' ? 'week' : 'list'

  const schedulesQuery = admin
    .from('schedules')
    .select('*, court:courts(name), coach:users!schedules_coach_id_fkey(name), level:levels(name, color)')
    .eq('is_active', true)
    .order('start_time', { ascending: true })
    .limit(200)

  const courtsQuery = admin
    .from('courts')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  const [{ data: rawSchedules, error: errSchedules }, { data: courts, error: errCourts }, { data: enrollmentsRaw, error: errEnrollments }, { data: clubRow }] = await Promise.all([
    clubId ? schedulesQuery.eq('club_id', clubId) : schedulesQuery,
    clubId ? courtsQuery.eq('club_id', clubId) : courtsQuery,
    admin
      .from('group_enrollments')
      .select('id, schedule_id, schedule_exclusions(excluded_date)')
      .eq('status', 'active'),
    clubId ? admin.from('clubs').select('config').eq('id', clubId).single() : Promise.resolve({ data: null }),
  ])

  const holidays: string[] = (clubRow as any)?.config?.holidays ?? []
  const holidaySet = new Set(holidays)

  // Compute next occurrence date per schedule, skip if past recurrence_end_date or holiday
  const nextDateMap: Record<string, string> = {}
  for (const s of rawSchedules ?? []) {
    let next = getNextDate(s.start_time)
    // Advance past holidays (up to 52 weeks)
    for (let i = 0; i < 52 && holidaySet.has(next); i++) {
      const d = new Date(next + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() + 7)
      next = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
    }
    if (s.recurrence_end_date && next > s.recurrence_end_date) continue
    nextDateMap[s.id] = next
  }

  // Count group members attending on their schedule's next date (no falta that day)
  const groupAttendingMap: Record<string, number> = {}
  const isFixedGroupMap: Record<string, boolean> = {}
  for (const e of enrollmentsRaw ?? []) {
    isFixedGroupMap[e.schedule_id] = true
    const nextDate = nextDateMap[e.schedule_id]
    const hasFalta = (e.schedule_exclusions as any[])?.some((x: any) => x.excluded_date === nextDate)
    if (!hasFalta) {
      groupAttendingMap[e.schedule_id] = (groupAttendingMap[e.schedule_id] ?? 0) + 1
    }
  }

  // Fetch spot bookings only for the specific next occurrence date of each schedule
  const uniqueNextDates = [...new Set(Object.values(nextDateMap))]
  const { data: spotBookingsRaw } = uniqueNextDates.length
    ? await admin
        .from('bookings')
        .select('schedule_id, class_date')
        .eq('status', 'confirmed')
        .not('class_date', 'is', null)
        .in('class_date', uniqueNextDates)
    : { data: [] }

  const spotCountMap: Record<string, number> = {}
  for (const b of spotBookingsRaw ?? []) {
    if (b.class_date === nextDateMap[b.schedule_id]) {
      spotCountMap[b.schedule_id] = (spotCountMap[b.schedule_id] ?? 0) + 1
    }
  }

  const schedules = (rawSchedules ?? []).filter((s: any) => nextDateMap[s.id] !== undefined).map((s: any) => ({
    ...s,
    bookings_count: (groupAttendingMap[s.id] ?? 0) + (spotCountMap[s.id] ?? 0),
    is_fixed_group: isFixedGroupMap[s.id] ?? false,
  }))

  return (
    <div>
      <RealtimeRefresh
        channelName="admin-schedule-list"
        subs={[
          { table: 'bookings' },
          { table: 'group_enrollments' },
          { table: 'schedule_exclusions' },
        ]}
      />
      <DevError errors={[errSchedules?.message, errCourts?.message, errEnrollments?.message]} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Horarios</h1>
          <p className="text-sm text-gray-500">{schedules.length} clases programadas</p>
        </div>
        <div className="flex items-center gap-3">
          <ScheduleViewToggle current={view} />
          <a
            href="/dashboard/schedule/new"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            + Nueva clase
          </a>
        </div>
      </div>

      {courts && courts.length === 0 && (
        <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          No hay pistas activas. Primero crea una pista en Configuración.
        </div>
      )}

      {view === 'week'
        ? <WeeklyCalendar schedules={schedules} holidays={holidays} />
        : <ScheduleTable schedules={schedules} />
      }
    </div>
  )
}
