import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import ScheduleTable from './schedule-table'

export default async function SchedulePage() {
  const supabase = createClient()
  const clubId = await getClubId()

  const schedulesQuery = supabase
    .from('schedules')
    .select('*, court:courts(name), coach:users!schedules_coach_id_fkey(name)')
    .order('start_time', { ascending: true })
    .limit(100)

  const courtsQuery = supabase
    .from('courts')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  const [{ data: schedules }, { data: courts }] = await Promise.all([
    clubId ? schedulesQuery.eq('club_id', clubId) : schedulesQuery,
    clubId ? courtsQuery.eq('club_id', clubId) : courtsQuery,
  ])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Horarios</h1>
          <p className="text-sm text-gray-500">{schedules?.length ?? 0} clases programadas</p>
        </div>
        <a
          href="/dashboard/schedule/new"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          + Nueva clase
        </a>
      </div>

      {courts && courts.length === 0 && (
        <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          No hay pistas activas. Primero crea una pista en Configuración.
        </div>
      )}

      <ScheduleTable schedules={schedules ?? []} />
    </div>
  )
}
