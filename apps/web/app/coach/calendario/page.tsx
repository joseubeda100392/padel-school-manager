export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MasterWeeklyCalendar from '@/app/dashboard/schedule/master/master-weekly-calendar'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'

export default async function CoachMasterCalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
      .select('schedule_id, student:users!group_enrollments_student_id_fkey(name)')
      .eq('status', 'active'),
  ])

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
