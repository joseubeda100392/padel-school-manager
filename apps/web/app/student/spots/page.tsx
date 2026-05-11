import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SpotsClient } from './spots-client'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function StudentSpotsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: spotsRaw }, { data: myEnrollments }, { data: bag }] = await Promise.all([
    supabase
      .from('schedule_exclusions')
      .select(`
        id, excluded_date,
        group_enrollment:group_enrollments!group_enrollment_id(
          schedule_id,
          schedule:schedules!schedule_id(
            id, start_time, end_time, max_students,
            court:courts(name),
            level:levels(name, color)
          )
        )
      `)
      .eq('publish_spot', true)
      .gte('excluded_date', today)
      .order('excluded_date'),
    supabase
      .from('group_enrollments')
      .select('schedule_id')
      .eq('student_id', user.id)
      .eq('status', 'active'),
    supabase.from('class_bag').select('balance').eq('user_id', user.id).single(),
  ])

  const myScheduleIds = new Set((myEnrollments ?? []).map(e => e.schedule_id))
  const bagBalance = bag?.balance ?? 0

  const spots = (spotsRaw ?? [])
    .filter(s => {
      const ge = s.group_enrollment as any
      return ge?.schedule_id && !myScheduleIds.has(ge.schedule_id)
    })
    .map(s => {
      const ge = s.group_enrollment as any
      const schedule = ge?.schedule
      const startDt = new Date(schedule?.start_time)
      const endDt = new Date(schedule?.end_time)
      return {
        exclusionId: s.id,
        excludedDate: s.excluded_date,
        scheduleId: ge?.schedule_id,
        dayLabel: DAYS[startDt.getDay()],
        startTime: startDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        endTime: endDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        courtName: schedule?.court?.name ?? '—',
        maxStudents: schedule?.max_students ?? 4,
        level: schedule?.level ?? null,
      }
    })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Huecos Libres</h1>
        <p className="text-sm text-gray-500">Plazas disponibles por ausencia de otro alumno</p>
      </div>

      {spots.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-2xl mb-2">🎾</p>
          <p className="text-gray-400">No hay huecos libres disponibles ahora mismo.</p>
          <p className="mt-1 text-xs text-gray-400">Vuelve a consultar más adelante.</p>
        </div>
      ) : (
        <SpotsClient spots={spots} bagBalance={bagBalance} />
      )}
    </div>
  )
}
