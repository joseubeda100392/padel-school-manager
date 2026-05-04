'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
// JS getDay: 0=Dom,1=Lun... → map to our index (Mon=0)
const JS_DAY_TO_IDX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }

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

export default function WeeklyCalendar({ schedules }: { schedules: any[] }) {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  const byDay = useMemo(() => {
    const map: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    schedules.forEach((s) => {
      const idx = JS_DAY_TO_IDX[new Date(s.start_time).getDay()]
      if (idx !== undefined) map[idx].push(s)
    })
    return map
  }, [schedules])

  const weekRange = useMemo(() => {
    const from = weekDates[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    const to = weekDates[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    return `${from} — ${to}`
  }, [weekDates])

  return (
    <div>
      {/* Navegación de semana */}
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
            <button onClick={() => setWeekOffset(0)} className="text-xs text-green-600 hover:underline">
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

      {/* Columnas por día */}
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[700px] grid-cols-7 gap-2">
        {DAY_NAMES.map((dayName, idx) => {
          const date = weekDates[idx]
          const isToday = date.toDateString() === new Date().toDateString()
          const classes = byDay[idx].sort((a, b) =>
            new Date(a.start_time).getHours() - new Date(b.start_time).getHours()
          )

          return (
            <div key={idx}>
              {/* Header del día */}
              <div className={`mb-2 rounded-lg px-2 py-2 text-center ${isToday ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <p className="text-xs font-semibold">{dayName}</p>
                <p className={`text-lg font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>
                  {date.getDate()}
                </p>
              </div>

              {/* Clases del día */}
              <div className="space-y-2">
                {classes.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 px-2 py-4 text-center">
                    <p className="text-xs text-gray-300">Sin clases</p>
                  </div>
                )}
                {classes.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/dashboard/schedule/${s.id}`)}
                    className="w-full rounded-lg bg-white p-2 text-left shadow-sm ring-1 ring-gray-100 hover:ring-green-400 transition-all"
                  >
                    <p className="text-xs font-semibold text-gray-900">
                      {timeOnly(s.start_time)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{s.court?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{s.coach?.name ?? '—'}</p>
                    {s.level && (
                      <span
                        className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: s.level.color }}
                      >
                        {s.level.name}
                      </span>
                    )}
                    {s.bookings_count !== undefined && (
                      <p className="mt-1 text-[10px] text-gray-400">
                        {s.bookings_count}/{s.max_students} plazas
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
