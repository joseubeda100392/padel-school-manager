export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import Link from 'next/link'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import CoachWeeklyCalendar from './coach-weekly-calendar'
import { computeScheduleReviewMap, computeScheduleReviewByDate } from '@/lib/schedule-review'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function CoachClassesPage({
  searchParams,
}: {
  searchParams: { view?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: schedules } = await admin
    .from('schedules')
    .select('id, start_time, end_time, max_students, court:courts(name), level:levels(name, color)')
    .eq('coach_id', user.id)
    .eq('is_active', true)

  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

  const ids = (schedules ?? []).map((s: any) => s.id)
  const { data: enrollments } = ids.length
    ? await admin
        .from('group_enrollments')
        .select('schedule_id, schedule_exclusions(excluded_date)')
        .in('schedule_id', ids)
        .eq('status', 'active')
    : { data: [] }

  // Cuenta solo a quien no ha registrado falta para hoy — no el total del
  // grupo fijo, que no refleja quién viene de verdad. groupSizeMap es el
  // tamaño total (constante), para recalcular por fecha exacta en Semana.
  const countBySchedule: Record<string, number> = {}
  const groupSizeMap: Record<string, number> = {}
  for (const e of enrollments ?? []) {
    groupSizeMap[e.schedule_id] = (groupSizeMap[e.schedule_id] ?? 0) + 1
    const absentToday = ((e as any).schedule_exclusions ?? []).some((x: any) => x.excluded_date === todaySpain)
    if (absentToday) continue
    countBySchedule[e.schedule_id] = (countBySchedule[e.schedule_id] ?? 0) + 1
  }

  // Lista: un aviso por horario, de la semana actual. Semana: por fecha
  // exacta, sin límite — la misma clase se repite al navegar de semana y cada
  // columna debe mostrar solo lo suyo (ver comentario en schedule-review.ts).
  const [reviewInfoMap, reviewByDate] = await Promise.all([
    computeScheduleReviewMap(admin, ids, todaySpain),
    computeScheduleReviewByDate(admin, ids, todaySpain),
  ])

  const view = searchParams.view === 'list' ? 'list' : 'week'

  const byDay: Record<number, any[]> = {}
  for (const s of schedules ?? []) {
    const dow = getDayOfWeek(s.start_time)
    if (!byDay[dow]) byDay[dow] = []
    byDay[dow].push(s)
  }
  const orderedDays = [1, 2, 3, 4, 5, 6, 0].filter(d => byDay[d])

  const schedulesWithCount = (schedules ?? []).map((s: any) => ({
    ...s,
    enrolled: countBySchedule[s.id] ?? 0,
    group_size: groupSizeMap[s.id] ?? null,
    review: reviewInfoMap[s.id] ?? null,
    reviewByDate: reviewByDate[s.id] ?? null,
  }))

  return (
    <div>
      <RealtimeRefresh
        channelName={`coach-classes-${user.id}`}
        subs={[
          { table: 'group_enrollments' },
          { table: 'schedule_exclusions' },
          { table: 'bookings' },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Clases</h1>
          <p className="text-sm text-gray-500">{schedules?.length ?? 0} clases asignadas</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/coach/classes?view=list"
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${view === 'list' ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Lista
          </Link>
          <Link
            href="/coach/classes?view=week"
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${view === 'week' ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Calendario
          </Link>
        </div>
      </div>

      {view === 'week' ? (
        <CoachWeeklyCalendar schedules={schedulesWithCount} />
      ) : orderedDays.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-gray-400">No tienes clases asignadas.</p>
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {orderedDays.map(dow => (
            <div key={dow}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">{DAYS[dow]}</h2>
              <div className="space-y-3">
                {byDay[dow]
                  .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map((s: any) => {
                    const enrolled = countBySchedule[s.id] ?? 0
                    const pct = Math.min((enrolled / s.max_students) * 100, 100)
                    const review = reviewInfoMap[s.id] ?? null
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
                            {review && (
                              <div className="mt-2 flex items-start gap-1.5">
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" title="Hay faltas registradas" />
                                <div className="flex flex-col gap-0.5">
                                  {review.substituteNames.map((name: string, i: number) => (
                                    <span key={i} className="text-xs font-medium text-gray-700">{name} sustituye</span>
                                  ))}
                                  {review.uncoveredCount > 0 && (
                                    <span className="text-xs font-medium text-red-600">
                                      {review.uncoveredCount} plaza{review.uncoveredCount > 1 ? 's' : ''} libre{review.uncoveredCount > 1 ? 's' : ''} — avisa a los alumnos
                                    </span>
                                  )}
                                </div>
                              </div>
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
