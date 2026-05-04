import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import ScheduleTable from './schedule-table'
import WeeklyCalendar from './weekly-calendar'
import ScheduleViewToggle from './schedule-view-toggle'

export default async function SchedulePage({ searchParams }: { searchParams: { view?: string } }) {
  const supabase = createClient()
  const clubId = await getClubId()
  const view = searchParams.view === 'week' ? 'week' : 'list'

  const schedulesQuery = supabase
    .from('schedules')
    .select('*, court:courts(name), coach:users!schedules_coach_id_fkey(name), level:levels(name, color), bookings(count)')
    .eq('is_active', true)
    .order('start_time', { ascending: true })
    .limit(200)

  const courtsQuery = supabase
    .from('courts')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  const enrollmentsQuery = supabase
    .from('group_enrollments')
    .select('schedule_id')
    .eq('status', 'active')

  const [{ data: rawSchedules }, { data: courts }, { data: enrollments }] = await Promise.all([
    clubId ? schedulesQuery.eq('club_id', clubId) : schedulesQuery,
    clubId ? courtsQuery.eq('club_id', clubId) : courtsQuery,
    enrollmentsQuery,
  ])

  const enrollmentCountMap: Record<string, number> = {}
  ;(enrollments ?? []).forEach((e: any) => {
    enrollmentCountMap[e.schedule_id] = (enrollmentCountMap[e.schedule_id] ?? 0) + 1
  })

  const schedules = (rawSchedules ?? []).map((s: any) => ({
    ...s,
    bookings_count: (s.bookings?.[0]?.count ?? 0) + (enrollmentCountMap[s.id] ?? 0),
    is_fixed_group: (enrollmentCountMap[s.id] ?? 0) > 0,
  }))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Horarios</h1>
          <p className="text-sm text-gray-500">{schedules.length} clases programadas</p>
        </div>
        <div className="flex items-center gap-3">
          <ScheduleViewToggle current={view} />
          <a
            href="/dashboard/schedule/new"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
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
        ? <WeeklyCalendar schedules={schedules} />
        : <ScheduleTable schedules={schedules} />
      }
    </div>
  )
}
