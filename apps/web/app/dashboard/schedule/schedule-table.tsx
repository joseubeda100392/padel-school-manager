'use client'

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

  return (
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
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {!schedules.length && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                No hay clases programadas. Crea la primera.
              </td>
            </tr>
          )}
          {schedules.map((s: any) => (
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
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
