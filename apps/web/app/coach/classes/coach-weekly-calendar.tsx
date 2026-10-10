'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLongDate } from '@/lib/format-date'
import { Card } from '@/components/ui/card'
import { LevelTag } from '@/components/ui/badge'
import { List, ListRow } from '@/components/ui/list'

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const JS_DAY_TO_IDX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }

type Schedule = {
  id: string
  start_time: string
  end_time: string
  max_students: number
  enrolled: number
  court?: { name: string }
  level?: { name: string; color: string }
  review?: { hasFalta: boolean; substituteNames: string[]; uncoveredCount: number } | null
  reviewByDate?: Record<string, { hasFalta: boolean; substituteNames: string[]; uncoveredCount: number }> | null
  group_size?: number | null
  bookedDates?: string[]
}

// Minutos desde medianoche en hora de Madrid — para ordenar por hora real del
// día, no por el navegador ni por la fecha que arrastra start_time.
function madridMinutesOfDay(dateStr: string): number {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' })
    .format(new Date(dateStr)).split(':').map(Number)
  return h * 60 + m
}

function timeOnly(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function getWeekDates(offset: number) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function CoachWeeklyCalendar({ schedules, holidays = [] }: { schedules: Schedule[]; holidays?: string[] }) {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  const weekRange = useMemo(() => {
    const from = weekDates[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    const to = weekDates[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    return `${from} — ${to}`
  }, [weekDates])

  const byDay = useMemo(() => {
    const map: Record<number, Schedule[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    schedules.forEach((s) => {
      const idx = JS_DAY_TO_IDX[new Date(s.start_time).getDay()]
      if (idx !== undefined) map[idx].push(s)
    })
    return map
  }, [schedules])


  const todayStr = new Date().toDateString()
  const days = DAY_NAMES.map((dayName, idx) => {
    const date = weekDates[idx]
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(date)
    const isHoliday = holidays.includes(dateStr)
    const classes = isHoliday ? [] : [...byDay[idx]]
      .filter((s) => {
        const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(s.start_time))
        return dateStr >= startDate
      })
      .sort((a, b) => madridMinutesOfDay(a.start_time) - madridMinutesOfDay(b.start_time))
    return { dayName, date, dateStr, isHoliday, isToday: date.toDateString() === todayStr, classes }
  })

  // Ocupación real = fijos que vienen ese día (grupo menos
  // ausentes) + reservas puntuales de esa fecha exacta —
  // sean sustitutos de una falta o plaza extra de aforo
  // sin relación con ninguna falta (ej. grupo de 3 en
  // clase de 4). Antes solo restaba faltas no cubiertas,
  // así que una reserva de "plaza extra" nunca se sumaba.
  function getOccupancy(s: Schedule, dateStr: string) {
    const review = s.reviewByDate?.[dateStr] ?? null
    const absentCount = review ? review.uncoveredCount + review.substituteNames.length : 0
    const bookingsThatDate = (s.bookedDates ?? []).filter((d) => d === dateStr).length
    const occupancy = typeof s.group_size === 'number' ? s.group_size - absentCount + bookingsThatDate : s.enrolled
    return { review, occupancy }
  }

  function reviewText(review: NonNullable<Schedule['review']>) {
    return review.uncoveredCount > 0
      ? `${review.uncoveredCount} plaza(s) libre(s) por falta`
      : `Sustituye: ${review.substituteNames.join(', ')}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o - 1)}
          aria-label="Semana anterior"
          className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line-strong/60 bg-surface text-ink hover:bg-surface-2"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="text-center">
          <p className="text-label tabular-nums text-ink">{weekRange}</p>
          {weekOffset !== 0 && (
            <button type="button" onClick={() => setWeekOffset(0)} className="min-h-11 text-meta font-medium text-accent-ink hover:underline">
              Volver a hoy
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o + 1)}
          aria-label="Semana siguiente"
          className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-line-strong/60 bg-surface text-ink hover:bg-surface-2"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Móvil: agenda por días */}
      <div className="space-y-5 md:hidden">
        {days.map(({ dayName, dateStr, isHoliday, isToday, classes }) => (
          <section key={dayName}>
            <h2 className={cn('flex items-baseline gap-2 border-b border-line pb-2 text-label', isToday ? 'text-accent-ink' : 'text-ink-2')}>
              {formatLongDate(dateStr)}
              {isToday && <span className="text-meta font-medium">Hoy</span>}
            </h2>
            {isHoliday ? (
              <p className="py-3 text-body text-warn-ink">Festivo</p>
            ) : classes.length === 0 ? (
              <p className="py-3 text-body text-ink-3">Sin clases</p>
            ) : (
              <Card className="mt-2 overflow-hidden">
                <List>
                  {classes.map((s) => {
                    const { review, occupancy } = getOccupancy(s, dateStr)
                    return (
                      <ListRow
                        key={s.id}
                        href={`/coach/classes/${s.id}?date=${dateStr}`}
                        title={
                          <span className="font-display text-heading tabular-nums">
                            {timeOnly(s.start_time)} – {timeOnly(s.end_time)}
                          </span>
                        }
                        subtitle={
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span>{s.court?.name ?? '—'}</span>
                            {s.level && <LevelTag name={s.level.name} color={s.level.color} />}
                            {review && (
                              <span className="inline-flex items-center gap-1 font-medium text-warn-ink">
                                <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                                {reviewText(review)}
                              </span>
                            )}
                          </span>
                        }
                        trailing={
                          <span className="text-ink">
                            <span className="font-display text-heading tabular-nums">{occupancy}</span>
                            <span className="text-meta tabular-nums text-ink-3">/{s.max_students}</span>
                          </span>
                        }
                      />
                    )
                  })}
                </List>
              </Card>
            )}
          </section>
        ))}
      </div>

      {/* Desde md: rejilla de 7 columnas */}
      <div className="hidden overflow-x-auto pb-2 md:block">
        <div className="grid grid-cols-7 gap-2">
          {days.map(({ dayName, date, dateStr, isHoliday, isToday, classes }) => (
            <div key={dayName} className="min-w-0">
              <div className={cn('mb-2 rounded-control px-2 py-2 text-center', isToday ? 'bg-chrome text-white' : 'bg-ink/[0.05] text-ink-2')}>
                <p className="text-meta font-medium">{dayName}</p>
                <p className="font-display text-heading tabular-nums">{date.getDate()}</p>
              </div>
              <div className="space-y-2">
                {isHoliday ? (
                  <div className="rounded-control border border-dashed border-warn-ink/30 bg-warn-soft px-2 py-4 text-center">
                    <p className="text-meta font-medium text-warn-ink">Festivo</p>
                  </div>
                ) : classes.length === 0 ? (
                  <div className="rounded-control border border-dashed border-line px-2 py-4 text-center">
                    <p className="text-meta text-ink-3">Sin clases</p>
                  </div>
                ) : (
                  classes.map((s) => {
                    const { review, occupancy } = getOccupancy(s, dateStr)
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => router.push(`/coach/classes/${s.id}?date=${dateStr}`)}
                        className="w-full rounded-control border border-line bg-surface p-2 text-left transition-colors hover:border-line-strong"
                      >
                        <p className="text-meta font-medium tabular-nums text-ink">{timeOnly(s.start_time)}–{timeOnly(s.end_time)}</p>
                        <p className="truncate text-meta text-ink-3">{s.court?.name ?? '—'}</p>
                        {s.level && <LevelTag name={s.level.name} color={s.level.color} className="mt-1" />}
                        <p className="mt-1 text-meta tabular-nums text-ink-3">{occupancy}/{s.max_students} alumnos</p>
                        {review && (
                          <p className="mt-1 flex items-start gap-1 text-meta font-medium text-warn-ink">
                            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                            {reviewText(review)}
                          </p>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
