import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { ScheduleActions } from './schedule-actions'
import AttendanceForm from './attendance-form'
import GroupEnrollment from './group-enrollment'
import ScheduleMaterials from './schedule-materials'
import ScheduleMakeups from './schedule-makeups'
import ScheduleExclusions from './schedule-exclusions'

const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function ScheduleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: schedule } = await supabase
    .from('schedules')
    .select('*, court:courts(name), coach:users!schedules_coach_id_fkey(name, email), level:levels(name, color)')
    .eq('id', params.id)
    .single()

  if (!schedule) notFound()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, student:users!bookings_student_id_fkey(name, email, avatar_url, current_level_id, currentLevel:levels(name, color))')
    .eq('schedule_id', params.id)
    .neq('status', 'cancelled')
    .order('created_at')

  const { data: groupEnrollments } = await supabase
    .from('group_enrollments')
    .select('id, monthly_price, paid_until, status, student:users!group_enrollments_student_id_fkey(id, name, email)')
    .eq('schedule_id', params.id)
    .eq('status', 'active')
    .order('enrolled_at')

  const { data: allStudents } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'student')
    .eq('is_active', true)
    .eq('club_id', schedule.club_id)
    .order('name')

  const start = new Date(schedule.start_time)
  const end = new Date(schedule.end_time)
  const groupCount = groupEnrollments?.length ?? 0
  const enrolled = (bookings?.length ?? 0) + groupCount

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <a href="/dashboard/schedule" className="text-sm text-gray-500 hover:text-gray-700">← Horarios</a>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-gray-900">Detalle de clase</h1>
        </div>
        <ScheduleActions scheduleId={params.id} />
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

      {/* Grupo fijo */}
      <div className="mb-6">
        <GroupEnrollment
          scheduleId={params.id}
          initialEnrollments={(groupEnrollments ?? []).map((e: any) => ({
            id: e.id,
            monthly_price: e.monthly_price,
            paid_until: e.paid_until,
            status: e.status,
            student: { id: e.student?.id, name: e.student?.name, email: e.student?.email },
          }))}
          availableStudents={(allStudents ?? []).map((s: any) => ({ id: s.id, name: s.name, email: s.email }))}
          defaultMonthlyPrice={6000}
        />
      </div>

      {/* Material de clase */}
      <div className="mb-6">
        <ScheduleMaterials scheduleId={params.id} />
      </div>

      {/* Recuperaciones */}
      <div className="mb-6">
        <ScheduleMakeups
          scheduleId={params.id}
          students={(groupEnrollments ?? []).map((e: any) => ({ id: e.student?.id, name: e.student?.name }))}
        />
      </div>

      {/* Cancelaciones puntuales */}
      {(groupEnrollments?.length ?? 0) > 0 && (
        <div className="mb-6">
          <ScheduleExclusions
            scheduleId={params.id}
            enrollments={(groupEnrollments ?? []).map((e: any) => ({
              id: e.id,
              student: { id: e.student?.id, name: e.student?.name ?? '—' },
            }))}
          />
        </div>
      )}

      {/* Lista de alumnos + asistencia */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Alumnos apuntados</h2>
          <p className="mt-0.5 text-xs text-gray-400">Marca ✓ o ✗ para registrar la asistencia</p>
        </div>
        <AttendanceForm
          scheduleId={params.id}
          bookings={(bookings ?? []).map((b: any) => ({
            id: b.id,
            status: b.status,
            scheduleId: params.id,
            student: {
              name: b.student?.name,
              email: b.student?.email,
              avatar_url: b.student?.avatar_url,
              currentLevel: b.student?.currentLevel ?? null,
            }
          }))}
        />
      </div>
    </div>
  )
}
