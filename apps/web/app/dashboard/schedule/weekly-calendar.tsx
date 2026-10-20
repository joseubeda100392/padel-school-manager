'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { TimetableGrid, type GridClass, type GridColumn } from './timetable-grid'

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
// JS getDay: 0=Dom,1=Lun... → map to our index (Mon=0)
const JS_DAY_TO_IDX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }
const madridDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d)

function timeOnly(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
}

// Minutos desde medianoche en hora de Madrid — para ordenar por hora real del
// día, no por el navegador del que abre la página ni por la fecha que
// arrastra start_time (los horarios recurrentes conservan la fecha en la que
// se crearon).
function madridMinutesOfDay(dateStr: string): number {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' })
    .format(new Date(dateStr)).split(':').map(Number)
  return (h % 24) * 60 + m
}

// "Hoy" en Madrid a las 12:00 UTC: el servidor (UTC) y el navegador calculan
// el mismo día también entre las 00:00 y las 02:00 de Madrid.
function madridToday(): Date {
  return new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date()) + 'T12:00:00Z')
}

function getWeekDates(offset: number) {
  const now = madridToday()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

interface TimeOverride {
  schedule_id: string
  override_date: string
  new_start_time: string
  new_end_time: string
}

export default function WeeklyCalendar({ schedules, holidays = [], enableIntensivos = true, timeOverrides = [], courtsCount = 0 }: { schedules: any[]; holidays?: string[]; enableIntensivos?: boolean; timeOverrides?: TimeOverride[]; courtsCount?: number }) {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)

  const overrideByKey = useMemo(() => {
    const map = new Map<string, TimeOverride>()
    for (const o of timeOverrides) map.set(`${o.schedule_id}_${o.override_date}`, o)
    return map
  }, [timeOverrides])

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  // Separate intensivos (shown as weekly banner) from regular classes
  const intensivoGroups = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const s of schedules) {
      if (s.type !== 'intensivo' || !s.intensivo_group_id) continue
      if (!groups[s.intensivo_group_id]) groups[s.intensivo_group_id] = []
      groups[s.intensivo_group_id].push(s)
    }
    return groups
  }, [schedules])

  const byDay = useMemo(() => {
    const map: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    schedules.forEach((s) => {
      if (s.type === 'intensivo' && s.intensivo_group_id) return // shown in banner
      const idx = JS_DAY_TO_IDX[new Date(s.start_time).getDay()]
      if (idx !== undefined) map[idx].push(s)
    })
    return map
  }, [schedules])

  // Las clases de cada día de la semana elegida, con lo que pasa ESE día
  // (cambio de hora, plazas por cubrir, sustitutos). Sirve para la lista del
  // móvil y para el cuadro por horas del ordenador.
  const weekDays = useMemo(() => weekDates.map((date, idx) => {
    const dateStr = madridDate(date)
    const isHoliday = holidays.includes(dateStr)
    const classes = isHoliday ? [] : byDay[idx]
      .filter((s: any) => {
        const scheduleDate = madridDate(new Date(s.start_time))
        if (s.recurrence === 'none') return dateStr === scheduleDate
        return dateStr >= scheduleDate && (!s.recurrence_end_date || dateStr <= s.recurrence_end_date)
      })
      .sort((a, b) => madridMinutesOfDay(a.start_time) - madridMinutesOfDay(b.start_time))
      .map((s: any) => {
        const override = overrideByKey.get(`${s.id}_${dateStr}`) ?? null
        const review = s.reviewByDate?.[dateStr] ?? null
        // Grupo fijo: la ocupación es constante salvo lo que pase ESE día concreto
        // (falta sin cubrir) — no el número de "hoy" heredado en cualquier semana.
        const occupancy = typeof s.group_size === 'number' ? s.group_size - (review?.uncoveredCount ?? 0) : s.bookings_count
        const reviewLabel: string | null = review
          ? review.uncoveredCount > 0
            ? `${review.uncoveredCount} plaza${review.uncoveredCount > 1 ? 's' : ''} por cubrir`
            : `Sustituye: ${review.substituteNames.join(', ')}`
          : null
        return { s, override, review, occupancy, reviewLabel }
      })
    return { date, dateStr, idx, isHoliday, isToday: date.toDateString() === madridToday().toDateString(), classes }
  }), [weekDates, holidays, byDay, overrideByKey])

  const gridColumns: GridColumn[] = weekDays.map(d => ({
    key: d.dateStr, label: DAY_NAMES[d.idx], dayNumber: d.date.getDate(), isToday: d.isToday, isHoliday: d.isHoliday,
  }))
  const gridClasses: GridClass[] = weekDays.flatMap(d => d.classes.map(({ s, override, occupancy, reviewLabel }) => ({
    id: `${s.id}_${d.dateStr}`,
    dayIndex: d.idx,
    startMin: madridMinutesOfDay(override?.new_start_time ?? s.start_time),
    endMin: madridMinutesOfDay(override?.new_end_time ?? s.end_time) || 24 * 60,
    courtId: s.court_id ?? null,
    href: `/dashboard/schedule/${s.id}?date=${d.dateStr}`,
    courtName: s.court?.name ?? '—',
    coachId: s.coach_id ?? null,
    coachName: s.coach?.name ?? '—',
    level: s.level ?? null,
    occupancy: s.forming ? `${s.interested_count}/${s.max_students} interesados` : `${occupancy ?? 0}/${s.max_students} plazas`,
    forming: !!s.forming,
    timeChanged: !!override,
    alert: reviewLabel,
  })))

  const weekRange = useMemo(() => {
    const from = weekDates[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    const to = weekDates[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    return `${from} — ${to}`
  }, [weekDates])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Anterior
        </Button>
        <div className="text-center">
          <p className="text-label tabular-nums text-ink">{weekRange}</p>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className={buttonVariants({ variant: 'link', size: 'sm' })}>
              Volver a hoy
            </button>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
          Siguiente
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {enableIntensivos && (() => {
        const weekStart = madridDate(weekDates[0])
        const weekEnd = madridDate(weekDates[6])
        const weekGroups = Object.entries(intensivoGroups)
          .map(([gid, classes]) => {
            const thisWeek = classes.filter(s => {
              const d = madridDate(new Date(s.start_time))
              return d >= weekStart && d <= weekEnd
            })
            if (!thisWeek.length) return null
            const sorted = [...thisWeek].sort((a, b) => a.start_time.localeCompare(b.start_time))
            return { gid, classes: sorted }
          })
          .filter(Boolean)

        if (!weekGroups.length) return null
        return (
          <div className="space-y-2">
            {weekGroups.map(group => {
              if (!group) return null
              const first = group.classes[0]
              const dayNames = group.classes.map((s: any) => DAY_NAMES[JS_DAY_TO_IDX[new Date(s.start_time).getDay()]])
              const enrolled = first.bookings_count ?? 0
              return (
                <Card key={group.gid}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-3 rounded-card px-4 py-3 text-left transition-colors hover:bg-ink/[0.03]"
                    onClick={() => router.push(`/dashboard/schedule/${first.id}`)}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Badge tone="outline">Intensivo</Badge>
                      <span className="text-label tabular-nums text-ink">
                        {dayNames.join(' · ')} — {timeOnly(first.start_time)}–{timeOnly(group.classes[group.classes.length - 1].end_time)}
                      </span>
                      <span className="text-meta text-ink-3">{first.court?.name ?? '—'}</span>
                      {first.coach?.name && <span className="text-meta text-ink-3">{first.coach.name}</span>}
                      {first.level && <LevelTag name={first.level.name} color={first.level.color} />}
                    </div>
                    <span className="text-meta tabular-nums text-ink-3">{enrolled}/{first.max_students} alumnos · {group.classes.length} clases</span>
                  </button>
                </Card>
              )
            })}
          </div>
        )
      })()}

      {/* Ordenador: cuadro por horas con las pistas libres de cada franja */}
      <div className="hidden md:block">
        <TimetableGrid columns={gridColumns} classes={gridClasses} courtsCount={courtsCount} />
      </div>

      {/* Móvil: lista por días */}
      <div className="grid grid-cols-1 gap-5 md:hidden">
        {weekDays.map(({ date, dateStr, idx, isHoliday, isToday, classes }) => (
          <section key={idx} className="min-w-0" aria-label={`${DAY_FULL[idx]} ${date.getDate()}`}>
            <div
              className={`mb-2 flex items-baseline gap-2 border-b pb-2 ${isToday ? 'border-ink' : 'border-line'}`}
              aria-current={isToday ? 'date' : undefined}
            >
              <p className="text-label text-ink-2">{DAY_FULL[idx]}</p>
              <p className="font-display text-heading tabular-nums text-ink">{date.getDate()}</p>
              {isHoliday && <Badge tone="warn">Festivo</Badge>}
            </div>

            <div className="space-y-2">
              {!isHoliday && classes.length === 0 && (
                <p className="rounded-control border border-dashed border-line px-2 py-3 text-center text-meta text-ink-3">Sin clases</p>
              )}
              {classes.map(({ s, override, review, occupancy, reviewLabel }) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/dashboard/schedule/${s.id}?date=${dateStr}`)}
                  className={`w-full rounded-control border p-3 text-left shadow-card transition-colors hover:border-line-strong ${s.forming ? 'border-dashed border-line-strong bg-surface-2' : 'border-line bg-surface'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <p className="flex items-center gap-1 whitespace-nowrap text-label tabular-nums text-ink">
                      {timeOnly(override?.new_start_time ?? s.start_time)}–{timeOnly(override?.new_end_time ?? s.end_time)}
                      {override && <TriangleAlert className="ml-1 h-4 w-4 text-warn-ink" aria-label="Horario modificado" />}
                      {review && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-danger-ink" role="img" aria-label={reviewLabel ?? undefined} title={reviewLabel ?? undefined} />
                      )}
                    </p>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      {s.forming && <Badge tone="warn">En formación</Badge>}
                      {s.is_fixed_group && <Badge tone="outline">Fijo</Badge>}
                      {s.type === 'intensivo' && <Badge tone="outline">Intensivo</Badge>}
                    </div>
                  </div>
                  <p className="mt-0.5 truncate text-meta text-ink-2">{s.court?.name ?? '—'}</p>
                  <p className="truncate text-meta text-ink-3">{s.coach?.name ?? '—'}</p>
                  {s.level && <LevelTag name={s.level.name} color={s.level.color} className="mt-1" />}
                  {s.forming ? (
                    <p className="mt-1 text-meta tabular-nums text-warn-ink">
                      {s.interested_count}/{s.max_students} interesados
                    </p>
                  ) : occupancy !== undefined && (
                    <p className="mt-1 text-meta tabular-nums text-ink-3">
                      {occupancy}/{s.max_students} plazas
                    </p>
                  )}
                  {review && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {review.substituteNames.map((name: string, i: number) => (
                        <span key={i} className="truncate text-meta font-medium text-ink-2">{name}</span>
                      ))}
                      {review.uncoveredCount > 0 && (
                        <span className="text-meta font-medium text-danger-ink">
                          {review.uncoveredCount} plaza{review.uncoveredCount > 1 ? 's' : ''} por cubrir
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
