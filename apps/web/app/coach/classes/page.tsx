export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import Link from 'next/link'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import CoachWeeklyCalendar from './coach-weekly-calendar'
import { computeScheduleReviewMap, computeScheduleReviewByDate } from '@/lib/schedule-review'
import { getHolidaySet } from '@/lib/club-holidays'
import { CalendarOff, CircleAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { LevelTag } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { List, ListRow } from '@/components/ui/list'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TZ = 'Europe/Madrid'

// Fecha de referencia para el enlace de Lista: hoy si le toca hoy, o si no la
// próxima fecha futura en que le toque — igual que en Horarios (admin), para
// que la ficha de clase abra la fecha correcta en vez de asumir siempre hoy.
// Los festivos del club se saltan: ese día no hay clase.
function nextClassDate(startTime: string, todaySpain: string, holidays: Set<string>): string {
  const classDow = getDayOfWeek(startTime)
  const [sy, sm, sd] = todaySpain.split('-').map(Number)
  const todayDow = getDayOfWeek(new Date(Date.UTC(sy, sm - 1, sd, 10, 0, 0)))
  let daysUntil = (classDow - todayDow + 7) % 7
  const format = (days: number) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.UTC(sy, sm - 1, sd + days, 10, 0, 0)))
  for (let i = 0; i < 52 && holidays.has(format(daysUntil)); i++) daysUntil += 7
  return format(daysUntil)
}

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

  const { data: coachRow } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const { data: clubRow } = coachRow?.club_id
    ? await admin.from('clubs').select('config').eq('id', coachRow.club_id).single()
    : { data: null }
  const holidays = getHolidaySet((clubRow as any)?.config)

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

  // Reservas puntuales (huecos libres cubiertos con bolsa/pago) — el grupo
  // fijo por sí solo no llega a max_students en muchas clases, así que estas
  // plazas extra no salían en el conteo aunque sí contaran en la ficha de
  // detalle de la clase.
  const { data: bookingsRaw } = ids.length
    ? await admin.from('bookings').select('schedule_id, class_date').eq('status', 'confirmed').in('schedule_id', ids)
    : { data: [] }

  const referenceDateBySchedule: Record<string, string> = {}
  for (const s of schedules ?? []) referenceDateBySchedule[s.id] = nextClassDate(s.start_time, todaySpain, holidays)

  for (const b of bookingsRaw ?? []) {
    if (b.class_date === referenceDateBySchedule[b.schedule_id]) {
      countBySchedule[b.schedule_id] = (countBySchedule[b.schedule_id] ?? 0) + 1
    }
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

  const bookedDatesBySchedule: Record<string, string[]> = {}
  for (const b of bookingsRaw ?? []) {
    if (!bookedDatesBySchedule[b.schedule_id]) bookedDatesBySchedule[b.schedule_id] = []
    bookedDatesBySchedule[b.schedule_id].push(b.class_date)
  }

  const schedulesWithCount = (schedules ?? []).map((s: any) => ({
    ...s,
    enrolled: countBySchedule[s.id] ?? 0,
    group_size: groupSizeMap[s.id] ?? null,
    review: reviewInfoMap[s.id] ?? null,
    reviewByDate: reviewByDate[s.id] ?? null,
    bookedDates: bookedDatesBySchedule[s.id] ?? [],
    reference_date: referenceDateBySchedule[s.id],
  }))

  const viewLink = (active: boolean) =>
    `inline-flex min-h-11 flex-1 items-center justify-center px-4 text-label transition-colors sm:flex-none ${
      active ? 'bg-ink text-surface' : 'bg-surface text-ink-2 hover:bg-surface-2'
    }`

  return (
    <div className={`mx-auto w-full space-y-6 ${view === 'week' ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <RealtimeRefresh
        channelName={`coach-classes-${user.id}`}
        subs={[
          { table: 'group_enrollments' },
          { table: 'schedule_exclusions' },
          { table: 'bookings' },
        ]}
      />
      <PageHeader
        title="Mis clases"
        description={`${schedules?.length ?? 0} clases asignadas`}
        actions={
          <div role="group" aria-label="Vista" className="flex w-full overflow-hidden rounded-control border border-line-strong/60 sm:w-auto">
            <Link href="/coach/classes?view=list" aria-pressed={view === 'list'} className={viewLink(view === 'list')}>
              Lista
            </Link>
            <Link href="/coach/classes?view=week" aria-pressed={view === 'week'} className={`border-l border-line-strong/60 ${viewLink(view === 'week')}`}>
              Calendario
            </Link>
          </div>
        }
      />

      {view === 'week' ? (
        <CoachWeeklyCalendar schedules={schedulesWithCount} holidays={[...holidays]} />
      ) : orderedDays.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarOff />}
            title="No tienes clases asignadas"
            description="Cuando el club te asigne una clase aparecerá aquí."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {orderedDays.map(dow => (
            <section key={dow} className="space-y-3">
              <SectionTitle>{DAYS[dow]}</SectionTitle>
              <Card className="overflow-hidden">
                <List>
                  {byDay[dow]
                    .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                    .map((s: any) => {
                      const enrolled = countBySchedule[s.id] ?? 0
                      const review = reviewInfoMap[s.id] ?? null
                      const referenceDate = referenceDateBySchedule[s.id]
                      return (
                        <ListRow
                          key={s.id}
                          href={`/coach/classes/${s.id}?date=${referenceDate}`}
                          title={
                            <span className="font-display text-heading tabular-nums">
                              {formatTime(s.start_time)} – {formatTime(s.end_time)}
                            </span>
                          }
                          subtitle={
                            <span className="flex flex-col gap-0.5">
                              <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                <span>{s.court?.name ?? '—'}</span>
                                {s.level && <LevelTag name={s.level.name} color={s.level.color} />}
                              </span>
                              {review && (
                                <span className="flex items-start gap-1.5 font-medium text-warn-ink">
                                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                                  <span className="flex flex-col">
                                    {review.substituteNames.map((name: string, i: number) => (
                                      <span key={i}>{name} sustituye</span>
                                    ))}
                                    {review.uncoveredCount > 0 && (
                                      <span>
                                        {review.uncoveredCount} plaza{review.uncoveredCount > 1 ? 's' : ''} libre{review.uncoveredCount > 1 ? 's' : ''}: avisa a los alumnos
                                      </span>
                                    )}
                                  </span>
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
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
