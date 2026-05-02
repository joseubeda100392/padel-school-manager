import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'

const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function ScheduleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: schedule } = await supabase
    .from('schedules')
    .select('*, court:courts(name), coach:users!schedules_coach_id_fkey(name, email)')
    .eq('id', params.id)
    .single()

  if (!schedule) notFound()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, student:users!bookings_student_id_fkey(name, email, avatar_url, current_level_id, currentLevel:levels(name, color))')
    .eq('schedule_id', params.id)
    .neq('status', 'cancelled')
    .order('created_at')

  const start = new Date(schedule.start_time)
  const end = new Date(schedule.end_time)
  const enrolled = bookings?.length ?? 0

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <a href="/dashboard/schedule" className="text-sm text-gray-500 hover:text-gray-700">← Horarios</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Detalle de clase</h1>
      </div>

      {/* Info de la clase */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-gray-900">
              {days[start.getDay()]} — {start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} a {end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="mt-1 text-sm text-gray-500">{schedule.court?.name} · Monitor: {schedule.coach?.name}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {schedule.recurrence === 'weekly' ? 'Semanal' : schedule.recurrence === 'biweekly' ? 'Quincenal' : 'Clase única'} · Inicio: {formatDate(schedule.start_time)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{enrolled}<span className="text-lg text-gray-400">/{schedule.max_students}</span></p>
            <p className="text-xs text-gray-400">alumnos</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-green-500 transition-all"
              style={{ width: `${Math.min((enrolled / schedule.max_students) * 100, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">{schedule.max_students - enrolled} plazas libres</p>
        </div>
      </div>

      {/* Lista de alumnos */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Alumnos apuntados</h2>
        </div>
        {enrolled === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">Ningún alumno apuntado aún.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {bookings?.map((b: any) => {
              const student = b.student
              const initials = (student?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              return (
                <div key={b.id} className="flex items-center gap-4 px-6 py-4">
                  {student?.avatar_url ? (
                    <img src={student.avatar_url} className="h-10 w-10 rounded-full object-cover" alt={student.name} />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{student?.name}</p>
                    <p className="text-sm text-gray-400">{student?.email}</p>
                  </div>
                  {student?.currentLevel && (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: student.currentLevel.color }}
                    >
                      {student.currentLevel.name}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {b.status === 'confirmed' ? 'Confirmado' : b.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
