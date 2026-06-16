export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import Link from 'next/link'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { DevError } from '@/components/dev-error'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function CoachHomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const todayDow = new Date().getDay()

  const { data: allSchedules, error: errSchedules } = await admin
    .from('schedules')
    .select('id, start_time, end_time, max_students, court:courts(name), level:levels(name, color)')
    .eq('coach_id', user.id)
    .eq('is_active', true)

  const todaySchedules = (allSchedules ?? []).filter(
    (s: any) => getDayOfWeek(s.start_time) === todayDow
  )

  // Count enrolled per today's classes
  const todayIds = todaySchedules.map((s: any) => s.id)
  const { data: enrollmentCounts } = todayIds.length
    ? await admin
        .from('group_enrollments')
        .select('schedule_id')
        .in('schedule_id', todayIds)
        .eq('status', 'active')
    : { data: [] }

  const countBySchedule: Record<string, number> = {}
  for (const e of enrollmentCounts ?? []) {
    countBySchedule[e.schedule_id] = (countBySchedule[e.schedule_id] ?? 0) + 1
  }

  const firstName = user.user_metadata?.name?.split(' ')[0] ?? 'Monitor'

  return (
    <div className="max-w-2xl">
      <DevError errors={[errSchedules?.message]} />
      <RealtimeRefresh
        channelName={`coach-home-${user.id}`}
        subs={[
          { table: 'group_enrollments' },
          { table: 'schedule_exclusions' },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hola, {firstName} 👋</h1>
        <p className="text-sm text-gray-500">Panel de monitor</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Clases asignadas</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{allSchedules?.length ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Clases hoy</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{todaySchedules.length}</p>
        </div>
      </div>

      {/* Clases de hoy */}
      <h2 className="mb-3 text-base font-semibold text-gray-700">
        {DAYS[todayDow]} — clases de hoy
      </h2>

      {todaySchedules.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-gray-400">No tienes clases hoy.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {todaySchedules
            .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
            .map((s: any) => {
              const enrolled = countBySchedule[s.id] ?? 0
              return (
                <Link
                  key={s.id}
                  href={`/coach/classes/${s.id}`}
                  className="block rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">
                        {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">{s.court?.name ?? '—'}</p>
                      {s.level && (
                        <span
                          className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                          style={{ backgroundColor: s.level.color }}
                        >
                          {s.level.name}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {enrolled}<span className="text-base font-normal text-gray-400">/{s.max_students}</span>
                      </p>
                      <p className="text-xs text-gray-400">alumnos</p>
                    </div>
                  </div>
                </Link>
              )
            })}
        </div>
      )}
    </div>
  )
}
