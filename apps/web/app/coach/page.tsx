export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import Link from 'next/link'
import { CalendarOff, Clock } from 'lucide-react'
import { formatLongDate } from '@/lib/format-date'
import { Card } from '@/components/ui/card'
import { LevelTag } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { List, ListRow } from '@/components/ui/list'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { DevError } from '@/components/dev-error'
import { getHolidaySet } from '@/lib/club-holidays'

export default async function CoachHomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const TZ = 'Europe/Madrid'
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const todayDow = getDayOfWeek(new Date())

  const { data: allSchedules, error: errSchedules } = await admin
    .from('schedules')
    .select('id, start_time, end_time, max_students, recurrence, recurrence_end_date, court:courts(name), level:levels(name, color)')
    .eq('coach_id', user.id)
    .eq('is_active', true)

  const { data: coachRow } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const { data: clubRow } = coachRow?.club_id
    ? await admin.from('clubs').select('config').eq('id', coachRow.club_id).single()
    : { data: null }
  const isHolidayToday = getHolidaySet((clubRow as any)?.config).has(todaySpain)

  const todaySchedules = isHolidayToday ? [] : (allSchedules ?? []).filter((s: any) => {
    const scheduleDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(s.start_time))
    if (s.recurrence === 'none') return scheduleDate === todaySpain
    if (scheduleDate > todaySpain) return false
    if (s.recurrence_end_date && todaySpain > s.recurrence_end_date) return false
    return getDayOfWeek(s.start_time) === todayDow
  })

  // Count enrolled per today's classes + time overrides — ambas dependen
  // solo de todayIds, ninguna de la otra: en paralelo.
  const todayIds = todaySchedules.map((s: any) => s.id)
  const [{ data: enrollmentCounts }, { data: todayOverrides }] = await Promise.all([
    todayIds.length
      ? admin
          .from('group_enrollments')
          .select('schedule_id')
          .in('schedule_id', todayIds)
          .eq('status', 'active')
      : { data: [] },
    todayIds.length
      ? admin
          .from('schedule_time_overrides')
          .select('schedule_id, new_start_time, new_end_time')
          .in('schedule_id', todayIds)
          .eq('override_date', todaySpain)
      : { data: [] },
  ])

  const countBySchedule: Record<string, number> = {}
  for (const e of enrollmentCounts ?? []) {
    countBySchedule[e.schedule_id] = (countBySchedule[e.schedule_id] ?? 0) + 1
  }
  const overrideBySchedule = new Map((todayOverrides ?? []).map((o: any) => [o.schedule_id, o]))

  const firstName = user.user_metadata?.name?.split(' ')[0] ?? 'Monitor'

  const sortedToday = [...todaySchedules].sort((a: any, b: any) => {
    const aTime = (overrideBySchedule.get(a.id) as any)?.new_start_time ?? a.start_time
    const bTime = (overrideBySchedule.get(b.id) as any)?.new_start_time ?? b.start_time
    return new Date(aTime).getTime() - new Date(bTime).getTime()
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <DevError errors={[errSchedules?.message]} />
      <RealtimeRefresh
        channelName={`coach-home-${user.id}`}
        subs={[
          { table: 'group_enrollments' },
          { table: 'schedule_exclusions' },
        ]}
      />
      <header>
        <p className="text-meta text-ink-3">{formatLongDate(new Date())}</p>
        <h1 className="mt-1 font-display text-display text-ink">Hola, {firstName}</h1>
      </header>

      <Card className="overflow-hidden">
        <dl className="grid grid-cols-2 divide-x divide-line">
          <div className="p-4 sm:p-5">
            <dt className="text-meta text-ink-3">Clases asignadas</dt>
            <dd className="mt-1 font-display text-title tabular-nums text-ink">{allSchedules?.length ?? 0}</dd>
          </div>
          <div className="p-4 sm:p-5">
            <dt className="text-meta text-ink-3">Clases hoy</dt>
            <dd className="mt-1 font-display text-title tabular-nums text-ink">{todaySchedules.length}</dd>
          </div>
        </dl>
      </Card>

      <section className="space-y-3">
        <h2 className="border-b border-line pb-2 text-label text-ink-2">Clases de hoy</h2>
        {sortedToday.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarOff />}
              title={isHolidayToday ? 'Hoy es festivo' : 'No tienes clases hoy'}
              description={isHolidayToday ? 'No hay clases en el club.' : 'Cuando tengas una clase asignada para hoy aparecerá aquí.'}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <List>
              {sortedToday.map((s: any) => {
                const enrolled = countBySchedule[s.id] ?? 0
                const override = overrideBySchedule.get(s.id) as any
                return (
                  <ListRow
                    key={s.id}
                    href={`/coach/classes/${s.id}`}
                    title={
                      <span className="font-display text-heading tabular-nums">
                        {formatTime(override?.new_start_time ?? s.start_time)} – {formatTime(override?.new_end_time ?? s.end_time)}
                      </span>
                    }
                    subtitle={
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span>{s.court?.name ?? '—'}</span>
                        {s.level && <LevelTag name={s.level.name} color={s.level.color} />}
                        {override && (
                          <span className="inline-flex items-center gap-1 font-medium text-warn-ink">
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            Cambio de hora hoy
                          </span>
                        )}
                      </span>
                    }
                    trailing={
                      <span className="text-ink">
                        <span className="font-display text-heading tabular-nums">{enrolled}</span>
                        <span className="text-meta tabular-nums text-ink-3">/{s.max_students}</span>
                        <span className="block text-meta text-ink-3">alumnos</span>
                      </span>
                    }
                  />
                )
              })}
            </List>
          </Card>
        )}
      </section>
    </div>
  )
}
