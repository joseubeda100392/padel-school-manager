import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import Link from 'next/link'
import { RealtimeRefresh } from '@/components/realtime-refresh'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function CoachClassesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: schedules } = await supabase
    .from('schedules')
    .select('id, start_time, end_time, max_students, court:courts(name), level:levels(name, color)')
    .eq('coach_id', user.id)
    .eq('is_active', true)

  // Count group enrollments per schedule
  const ids = (schedules ?? []).map((s: any) => s.id)
  const { data: enrollments } = ids.length
    ? await supabase
        .from('group_enrollments')
        .select('schedule_id')
        .in('schedule_id', ids)
        .eq('status', 'active')
    : { data: [] }

  const countBySchedule: Record<string, number> = {}
  for (const e of enrollments ?? []) {
    countBySchedule[e.schedule_id] = (countBySchedule[e.schedule_id] ?? 0) + 1
  }

  // Group by day of week
  const byDay: Record<number, any[]> = {}
  for (const s of schedules ?? []) {
    const dow = getDayOfWeek(s.start_time)
    if (!byDay[dow]) byDay[dow] = []
    byDay[dow].push(s)
  }

  const orderedDays = [1, 2, 3, 4, 5, 6, 0].filter(d => byDay[d])

  return (
    <div className="max-w-2xl">
      <RealtimeRefresh
        channelName={`coach-classes-${user.id}`}
        subs={[
          { table: 'group_enrollments' },
          { table: 'schedule_exclusions' },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis Clases</h1>
        <p className="text-sm text-gray-500">{schedules?.length ?? 0} clases asignadas</p>
      </div>

      {orderedDays.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-gray-400">No tienes clases asignadas.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orderedDays.map(dow => (
            <div key={dow}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">{DAYS[dow]}</h2>
              <div className="space-y-3">
                {byDay[dow]
                  .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map((s: any) => {
                    const enrolled = countBySchedule[s.id] ?? 0
                    const pct = Math.min((enrolled / s.max_students) * 100, 100)
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
                        <div className="mt-3">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </Link>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
