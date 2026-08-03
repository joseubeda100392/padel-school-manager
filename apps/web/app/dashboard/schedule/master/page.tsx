export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import MasterWeeklyCalendar from './master-weekly-calendar'
import { RealtimeRefresh } from '@/components/realtime-refresh'

export default async function MasterSchedulePage() {
  const admin = getAdminClient()
  const clubId = await getClubId()

  const schedulesQuery = admin
    .from('schedules')
    .select('id, start_time, end_time, recurrence, recurrence_end_date, coach:users!schedules_coach_id_fkey(name), level:levels(name, description, color)')
    .eq('is_active', true)
    .eq('type', 'regular')
    .order('start_time', { ascending: true })
    .limit(200)

  const [{ data: rawSchedules }, { data: enrollmentsRaw }] = await Promise.all([
    clubId ? schedulesQuery.eq('club_id', clubId) : schedulesQuery,
    admin
      .from('group_enrollments')
      .select('schedule_id, student:users!group_enrollments_student_id_fkey(name)')
      .eq('status', 'active'),
  ])

  // Alumnos del grupo fijo por horario (roster completo, sin filtrar por faltas)
  const studentsBySchedule: Record<string, string[]> = {}
  for (const e of enrollmentsRaw ?? []) {
    const name = (e.student as any)?.name
    if (!name) continue
    if (!studentsBySchedule[e.schedule_id]) studentsBySchedule[e.schedule_id] = []
    studentsBySchedule[e.schedule_id].push(name)
  }

  const schedules = (rawSchedules ?? []).map((s: any) => ({
    ...s,
    students: studentsBySchedule[s.id] ?? [],
  }))

  return (
    <div>
      <RealtimeRefresh
        channelName="admin-schedule-master"
        subs={clubId ? [
          { table: 'group_enrollments', filter: `club_id=eq.${clubId}` },
          { table: 'schedules', filter: `club_id=eq.${clubId}` },
        ] : [{ table: 'group_enrollments' }, { table: 'schedules' }]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario maestro</h1>
          <p className="text-sm text-gray-500">Con alumnos del grupo fijo, monitor y nivel real</p>
        </div>
        <Link
          href="/dashboard/schedule"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          ← Volver a Horarios
        </Link>
      </div>

      <MasterWeeklyCalendar schedules={schedules} />
    </div>
  )
}
