export const dynamic = 'force-dynamic'

import { createClient, getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MasterWeeklyCalendar from '@/app/dashboard/schedule/master/master-weekly-calendar'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'
import { madridToday, rosterForMonth } from '@/lib/enrollment-window'

export default async function CoachMasterCalendarPage() {
  const supabase = createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const clubId = (profile as any)?.club_id as string | undefined

  let schedulesQuery = admin
    .from('schedules')
    .select('id, start_time, end_time, recurrence, recurrence_end_date, coach:users!schedules_coach_id_fkey(name), level:levels(name, description, color)')
    .eq('is_active', true)
    .eq('type', 'regular')
    .order('start_time', { ascending: true })
    .limit(200)
  if (clubId) schedulesQuery = schedulesQuery.eq('club_id', clubId)

  const [{ data: rawSchedules }, { data: enrollmentsRaw }] = await Promise.all([
    schedulesQuery,
    admin
      .from('group_enrollments')
      .select('schedule_id, start_date, end_date, student:users!group_enrollments_student_id_fkey(name)')
      .eq('status', 'active'),
  ])

  // Grupo de este mes, con quién entra o sale (altas y cambios programados).
  const bySchedule: Record<string, any[]> = {}
  for (const e of enrollmentsRaw ?? []) {
    if (!(e.student as any)?.name) continue
    if (!bySchedule[e.schedule_id]) bySchedule[e.schedule_id] = []
    bySchedule[e.schedule_id].push(e)
  }
  const today = madridToday()

  const schedules = (rawSchedules ?? []).filter((s: any) => !s.recurrence_end_date || s.recurrence_end_date >= today).map((s: any) => ({
    ...s,
    students: rosterForMonth(bySchedule[s.id] ?? [], today.slice(0, 7), today)
      .map(({ entry, change }) => ({ name: entry.student.name as string, change })),
  }))

  return (
    <div className="space-y-6">
      <RealtimeRefresh
        channelName="coach-schedule-master"
        subs={clubId ? [
          { table: 'group_enrollments', filter: `club_id=eq.${clubId}` },
          { table: 'schedules', filter: `club_id=eq.${clubId}` },
        ] : [{ table: 'group_enrollments' }, { table: 'schedules' }]}
      />
      <PageHeader title="Calendario maestro" description="Todas las clases del club, con monitor y nivel" />

      <MasterWeeklyCalendar schedules={schedules} readOnly />
    </div>
  )
}
