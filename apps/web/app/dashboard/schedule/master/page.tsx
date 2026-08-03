export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { RealtimeRefresh } from '@/components/realtime-refresh'

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
// JS getDay: 0=Dom,1=Lun... → map to display order (Mon first)
const JS_DAY_TO_IDX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }

function timeOnly(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default async function MasterSchedulePage() {
  const admin = getAdminClient()
  const clubId = await getClubId()

  const schedulesQuery = admin
    .from('schedules')
    .select('id, start_time, end_time, type, court:courts(name), coach:users!schedules_coach_id_fkey(name), level:levels(name)')
    .eq('is_active', true)
    .order('start_time', { ascending: true })
    .limit(200)

  const [{ data: rawSchedules }, { data: enrollmentsRaw }] = await Promise.all([
    clubId ? schedulesQuery.eq('club_id', clubId) : schedulesQuery,
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

  const byDay: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const s of rawSchedules ?? []) {
    if (s.type === 'intensivo') continue // los intensivos no son grupo fijo semanal
    const idx = JS_DAY_TO_IDX[new Date(s.start_time).getDay()]
    if (idx !== undefined) byDay[idx].push(s)
  }
  for (const idx of Object.keys(byDay)) {
    byDay[Number(idx)].sort((a, b) => new Date(a.start_time).getHours() - new Date(b.start_time).getHours())
  }

  return (
    <div>
      <RealtimeRefresh
        channelName="admin-schedule-master"
        subs={[{ table: 'group_enrollments' }, { table: 'schedules' }]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario maestro</h1>
          <p className="text-sm text-gray-500">Grupos fijos con alumno, monitor y nivel de un vistazo</p>
        </div>
        <Link
          href="/dashboard/schedule"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          ← Volver a Horarios
        </Link>
      </div>

      <div className="space-y-6">
        {DAY_NAMES.map((dayName, idx) => {
          const classes = byDay[idx]
          if (!classes.length) return null
          return (
            <div key={idx}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">{dayName}</h2>
              <div className="space-y-2">
                {classes.map((s: any) => {
                  const students = studentsBySchedule[s.id] ?? []
                  return (
                    <Link
                      key={s.id}
                      href={`/dashboard/schedule/${s.id}`}
                      className="block rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900">
                          {timeOnly(s.start_time)}–{timeOnly(s.end_time)}
                        </span>
                        <span className="text-sm text-gray-500">{s.court?.name ?? '—'}</span>
                        <span className="text-sm text-gray-500">·</span>
                        <span className="text-sm text-gray-500">{s.coach?.name ?? 'Sin monitor'}</span>
                        {s.level?.name && (
                          <>
                            <span className="text-sm text-gray-500">·</span>
                            <span className="text-sm text-gray-500">{s.level.name}</span>
                          </>
                        )}
                        {students.length > 0 && (
                          <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                            Grupo fijo · {students.length}
                          </span>
                        )}
                      </div>
                      {students.length > 0 ? (
                        <p className="mt-2 text-sm text-gray-700">{students.join(', ')}</p>
                      ) : (
                        <p className="mt-2 text-sm text-gray-300">Sin alumnos de grupo fijo</p>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
        {(rawSchedules ?? []).filter((s: any) => s.type !== 'intensivo').length === 0 && (
          <p className="py-12 text-center text-gray-400">No hay clases programadas.</p>
        )}
      </div>
    </div>
  )
}
