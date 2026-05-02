import { createClient } from '@/lib/supabase/server'
const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function dayName(dateStr: string) {
  return days[new Date(dateStr).getDay()]
}

function timeOnly(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default async function SchedulePage() {
  const supabase = createClient()

  const { data: schedules } = await supabase
    .from('schedules')
    .select('*, court:courts(name), coach:users!schedules_coach_id_fkey(name)')
    .order('start_time', { ascending: true })
    .limit(100)

  const { data: courts } = await supabase
    .from('courts')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Horarios</h1>
          <p className="text-sm text-gray-500">{schedules?.length ?? 0} clases programadas</p>
        </div>
        <a
          href="/dashboard/schedule/new"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          + Nueva clase
        </a>
      </div>

      {courts && courts.length === 0 && (
        <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          No hay pistas activas. Primero crea una pista en Configuración.
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Día</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Horario</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Pista</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Monitor</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Recurrencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!schedules?.length && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  No hay clases programadas. Crea la primera.
                </td>
              </tr>
            )}
            {schedules?.map((s: any) => (
              <tr key={s.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { window.location.href = `/dashboard/schedule/${s.id}` }}>
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
