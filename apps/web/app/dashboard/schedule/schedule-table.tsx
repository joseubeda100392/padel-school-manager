'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function dayName(dateStr: string) {
  return days[new Date(dateStr).getDay()]
}

function timeOnly(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function ScheduleTable({ schedules }: { schedules: any[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [day, setDay] = useState('')

  const filtered = useMemo(() => {
    const qLower = q.toLowerCase()
    return schedules.filter((s) => {
      const matchQ = !q ||
        (s.court?.name ?? '').toLowerCase().includes(qLower) ||
        (s.coach?.name ?? '').toLowerCase().includes(qLower) ||
        (s.level?.name ?? '').toLowerCase().includes(qLower)
      const matchDay = !day || String(new Date(s.start_time).getDay()) === day
      return matchQ && matchDay
    })
  }, [schedules, q, day])

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por pista, monitor o nivel..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none"
        />
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
        >
          <option value="">Todos los días</option>
          <option value="1">Lunes</option>
          <option value="2">Martes</option>
          <option value="3">Miércoles</option>
          <option value="4">Jueves</option>
          <option value="5">Viernes</option>
          <option value="6">Sábado</option>
          <option value="0">Domingo</option>
        </select>
        {(q || day) && (
          <button
            onClick={() => { setQ(''); setDay('') }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Limpiar
          </button>
        )}
      </div>

      {(q || day) && (
        <p className="mb-3 text-sm text-gray-400">{filtered.length} de {schedules.length} clases</p>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Día</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Horario</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Pista</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Monitor</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nivel</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Recurrencia</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Ocupación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    {q || day ? 'Sin resultados para esa búsqueda.' : 'No hay clases programadas. Crea la primera.'}
                  </td>
                </tr>
              )}
              {filtered.map((s: any) => (
                <tr
                  key={s.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/dashboard/schedule/${s.id}`)}
                >
                  <td className="px-6 py-4">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-xs font-semibold text-green-700">
                      {dayName(s.start_time)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {timeOnly(s.start_time)} — {timeOnly(s.end_time)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.court?.name ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.coach?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    {s.level ? (
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                        style={{ backgroundColor: s.level.color }}
                      >
                        {s.level.name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Todos</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.recurrence === 'weekly' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.recurrence === 'weekly' ? 'Semanal' : s.recurrence === 'biweekly' ? 'Quincenal' : 'Única'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {s.max_students > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-1.5 rounded-full ${(s.bookings_count / s.max_students) >= 1 ? 'bg-red-500' : (s.bookings_count / s.max_students) >= 0.7 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min((s.bookings_count / s.max_students) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{s.bookings_count ?? 0}/{s.max_students}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
