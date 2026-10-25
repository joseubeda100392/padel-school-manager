export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Download, Upload } from 'lucide-react'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import MasterWeeklyCalendar from './master-weekly-calendar'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'
import { buttonVariants } from '@/components/ui/button'
import { madridToday, rosterForMonth, upcomingMonths } from '@/lib/enrollment-window'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const PLANNABLE_MONTHS = 6
const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1]

export default async function MasterSchedulePage({ searchParams }: { searchParams: { mes?: string } }) {
  const admin = getAdminClient()
  const clubId = await getClubId()
  const today = madridToday()
  const months = upcomingMonths(today, PLANNABLE_MONTHS)
  const month = months.includes(searchParams.mes ?? '') ? searchParams.mes! : months[0]
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10)

  const schedulesQuery = admin
    .from('schedules')
    .select('id, is_active, start_time, end_time, recurrence, recurrence_end_date, max_students, coach:users!schedules_coach_id_fkey(name), level:levels(name, description, color)')
    .eq('type', 'regular')
    .order('start_time', { ascending: true })
    .limit(200)

  const [{ data: rawSchedules }, { data: enrollmentsRaw }] = await Promise.all([
    clubId ? schedulesQuery.eq('club_id', clubId) : schedulesQuery,
    admin
      .from('group_enrollments')
      .select('schedule_id, status, start_date, end_date, student:users!group_enrollments_student_id_fkey(name)')
      .in('status', ['active', 'pending']),
  ])

  // Alumnos del grupo fijo por horario tal y como estarán el mes elegido (sin
  // filtrar por faltas), marcando quién entra o sale ese mes. Los interesados
  // de un grupo en formación no tienen fechas: salen siempre.
  const bySchedule: Record<string, any[]> = {}
  for (const e of enrollmentsRaw ?? []) {
    if (!(e.student as any)?.name) continue
    if (!bySchedule[e.schedule_id]) bySchedule[e.schedule_id] = []
    bySchedule[e.schedule_id].push(e)
  }

  const schedules = (rawSchedules ?? [])
    .filter((s: any) => (!s.recurrence_end_date || s.recurrence_end_date >= (`${month}-01` > today ? `${month}-01` : today)) && s.start_time.slice(0, 10) <= monthEnd)
    .map((s: any) => {
      const roster = rosterForMonth(bySchedule[s.id] ?? [], month, today)
      return {
        ...s,
        students: roster.map(({ entry, change }) => ({ name: entry.student.name as string, change })),
        // Grupo en formación: sus nombres son los interesados (status 'pending').
        forming: s.is_active === false,
      }
    })

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
        description={`Alumnos del grupo fijo, monitor y nivel de cada clase en ${monthName(month).toLowerCase()}. Elige otro mes para ver las altas, bajas y cambios de grupo ya programados.`}
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

      <nav aria-label="Mes" className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          {months.map(m => (
            <li key={m}>
              <Link
                href={m === months[0] ? '/dashboard/schedule/master' : `/dashboard/schedule/master?mes=${m}`}
                aria-current={m === month ? 'page' : undefined}
                className={buttonVariants({ variant: m === month ? 'primary' : 'secondary', size: 'sm', className: 'whitespace-nowrap' })}
              >
                {m === months[0] ? `Este mes · ${monthName(m)}` : monthName(m)}
                {m.slice(0, 4) !== today.slice(0, 4) ? ` ${m.slice(0, 4)}` : ''}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <MasterWeeklyCalendar schedules={schedules} showChanges />
    </div>
  )
}
