export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Download, Upload } from 'lucide-react'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import MasterWeeklyCalendar from './master-weekly-calendar'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'
import { buttonVariants } from '@/components/ui/button'

export default async function MasterSchedulePage() {
  const admin = getAdminClient()
  const clubId = await getClubId()

  const schedulesQuery = admin
    .from('schedules')
    .select('id, is_active, start_time, end_time, recurrence, recurrence_end_date, coach:users!schedules_coach_id_fkey(name), level:levels(name, description, color)')
    .eq('type', 'regular')
    .order('start_time', { ascending: true })
    .limit(200)

  const [{ data: rawSchedules }, { data: enrollmentsRaw }] = await Promise.all([
    clubId ? schedulesQuery.eq('club_id', clubId) : schedulesQuery,
    admin
      .from('group_enrollments')
      .select('schedule_id, status, student:users!group_enrollments_student_id_fkey(name)')
      .in('status', ['active', 'pending']),
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
    // Grupo en formación: sus nombres son los interesados (status 'pending').
    forming: s.is_active === false,
  }))

  return (
    <div className="space-y-6">
      <RealtimeRefresh
        channelName="admin-schedule-master"
        subs={clubId ? [
          { table: 'group_enrollments', filter: `club_id=eq.${clubId}` },
          { table: 'schedules', filter: `club_id=eq.${clubId}` },
        ] : [{ table: 'group_enrollments' }, { table: 'schedules' }]}
      />
      <PageHeader
        back={{ href: '/dashboard/schedule', label: 'Horarios' }}
        title="Calendario maestro"
        description="Alumnos del grupo fijo, monitor y nivel de cada clase."
        actions={
          <>
            <a
              href="/api/admin/schedules/export"
              className={buttonVariants({ variant: 'secondary' })}
              title="Copia de seguridad del calendario en Excel"
            >
              <Download className="h-4 w-4" aria-hidden />
              Descargar Excel
            </a>
            <Link
              href="/dashboard/schedule/restore"
              className={buttonVariants({ variant: 'secondary' })}
              title="Restaurar clases desde un Excel descargado antes"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Restaurar Excel
            </Link>
          </>
        }
      />

      <MasterWeeklyCalendar schedules={schedules} />
    </div>
  )
}
