'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

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

export default function CoachWeeklyCalendar({ schedules }: { schedules: Schedule[] }) {
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          ← Anterior
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{weekRange}</p>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-xs text-brand-500 hover:underline">
              Volver a hoy
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Siguiente →
        </button>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[700px] grid-cols-7 gap-2">
          {DAY_NAMES.map((dayName, idx) => {
            const date = weekDates[idx]
            const isToday = date.toDateString() === new Date().toDateString()
            const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(date)
            const classes = [...byDay[idx]]
              .filter((s) => {
                const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(s.start_time))
                return dateStr >= startDate
              })
              .sort((a, b) => new Date(a.start_time).getHours() - new Date(b.start_time).getHours())

            return (
              <div key={idx}>
                <div className={`mb-2 rounded-lg px-2 py-2 text-center ${isToday ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <p className="text-xs font-semibold">{dayName}</p>
                  <p className={`text-lg font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </p>
                </div>
                <div className="space-y-2">
                  {classes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 px-2 py-4 text-center">
                      <p className="text-xs text-gray-300">Sin clases</p>
                    </div>
                  ) : (
                    classes.map((s) => {
                      const review = s.reviewByDate?.[dateStr] ?? null
                      const occupancy = typeof s.group_size === 'number' ? s.group_size - (review?.uncoveredCount ?? 0) : s.enrolled
                      return (
                      <button
                        key={s.id}
                        onClick={() => router.push(`/coach/classes/${s.id}`)}
                        className="w-full rounded-lg bg-white p-2 text-left shadow-sm ring-1 ring-gray-100 transition-all hover:ring-brand-400"
                      >
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-semibold text-gray-900">{timeOnly(s.start_time)}</p>
                          {review && (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                              title={
                                review.uncoveredCount > 0
                                  ? `${review.uncoveredCount} plaza(s) libre(s) por falta`
                                  : `Sustituye: ${review.substituteNames.join(', ')}`
                              }
                            />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{s.court?.name ?? '—'}</p>
                        {s.level && (
                          <span
                            className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: s.level.color }}
                          >
                            {s.level.name}
                          </span>
                        )}
                        <p className="mt-1 text-[10px] text-gray-400">{occupancy}/{s.max_students} alumnos</p>
                      </button>
                    )})
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
