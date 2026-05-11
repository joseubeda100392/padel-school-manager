import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { formatDate, formatTime, getDayOfWeek } from '@/lib/utils'
import { ScheduleActions } from './schedule-actions'
import AttendanceForm from './attendance-form'
import GroupEnrollment from './group-enrollment'
import ScheduleMaterials from './schedule-materials'

const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function ScheduleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: schedule } = await supabase
    .from('schedules')
    .select('*, court:courts(name), coach:users!schedules_coach_id_fkey(name, email), level:levels(name, color)')
    .eq('id', params.id)
    .single()

  if (!schedule) notFound()

  const { data: bookings } = await admin
    .from('bookings')
    .select('*, student:users!bookings_student_id_fkey(name, email, avatar_url, current_level_id, currentLevel:levels(name, color))')
    .eq('schedule_id', params.id)
    .neq('status', 'cancelled')
    .order('created_at')

  const { data: groupEnrollments } = await admin
    .from('group_enrollments')
    .select('id, monthly_price, paid_until, status, student:users!group_enrollments_student_id_fkey(id, name, email, current_level_id)')
    .eq('schedule_id', params.id)
    .eq('status', 'active')
    .order('enrolled_at')

  const enrollmentIds = (groupEnrollments ?? []).map((e: any) => e.id)
  const today = new Date().toISOString().split('T')[0]
  const { data: exclusionsRaw } = enrollmentIds.length
    ? await admin
        .from('schedule_exclusions')
        .select('id, group_enrollment_id, excluded_date, publish_spot')
        .in('group_enrollment_id', enrollmentIds)
        .gte('excluded_date', today)
        .order('excluded_date')
    : { data: [] }

  const exclusionsByEnrollment: Record<string, { id: string; excluded_date: string; publish_spot: boolean }[]> = {}
  for (const x of exclusionsRaw ?? []) {
    if (!exclusionsByEnrollment[x.group_enrollment_id]) exclusionsByEnrollment[x.group_enrollment_id] = []
    exclusionsByEnrollment[x.group_enrollment_id].push({ id: x.id, excluded_date: x.excluded_date, publish_spot: x.publish_spot })
  }

  // Nivel efectivo: el del horario, o inferido de los alumnos ya inscritos si todos comparten nivel
  const enrolledLevelIds = (groupEnrollments ?? [])
    .map((e: any) => e.student?.current_level_id)
    .filter(Boolean)
  const uniqueEnrolledLevels = [...new Set(enrolledLevelIds)]
  const inferredLevelId = uniqueEnrolledLevels.length === 1 ? uniqueEnrolledLevels[0] : null
  const effectiveLevelId: string | null = schedule.level_id ?? inferredLevelId

  const studentsQuery = admin
    .from('users')
    .select('id, name, email')
    .eq('role', 'student')
    .eq('is_active', true)
    .eq('club_id', schedule.club_id)
    .order('name')

  const { data: allStudents } = await (
    effectiveLevelId
      ? studentsQuery.eq('current_level_id', effectiveLevelId)
      : studentsQuery
  )

  const start = new Date(schedule.start_time)
  const end = new Date(schedule.end_time)
  const spotBookings = (bookings ?? []).filter((b: any) => b.class_date != null)
  const groupCount = groupEnrollments?.length ?? 0
  const enrolled = spotBookings.length + groupCount

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
              {days[getDayOfWeek(start)]} — {formatTime(start)} a {formatTime(end)}
            </p>
            <p className="mt-1 text-sm text-gray-500">{schedule.court?.name} · Monitor: {schedule.coach?.name}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {schedule.recurrence === 'weekly' ? 'Semanal' : schedule.recurrence === 'biweekly' ? 'Quincenal' : 'Clase única'} · Inicio: {formatDate(schedule.start_time)}{schedule.recurrence_end_date ? ` · Fin: ${formatDate(schedule.recurrence_end_date)}` : ''}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {schedule.level ? (
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: schedule.level.color }}
                >
                  {schedule.level.name}
                </span>
              ) : inferredLevelId ? (
                <span className="inline-block rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-700">
                  Nivel inferido de alumnos
                </span>
              ) : (
                <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-400">
                  Sin nivel · <a href={`/dashboard/schedule/${params.id}/edit`} className="underline hover:text-gray-600">Asignar nivel</a>
                </span>
              )}
            </div>
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
          scheduleStartTime={schedule.start_time}
          initialEnrollments={(groupEnrollments ?? []).map((e: any) => ({
            id: e.id,
            monthly_price: e.monthly_price,
            paid_until: e.paid_until,
            status: e.status,
            student: { id: e.student?.id, name: e.student?.name, email: e.student?.email },
          }))}
          initialExclusions={exclusionsByEnrollment}
          availableStudents={(allStudents ?? []).map((s: any) => ({ id: s.id, name: s.name, email: s.email }))}
          defaultMonthlyPrice={6000}
        />
      </div>

      {/* Material de clase */}
      <div className="mb-6">
        <ScheduleMaterials scheduleId={params.id} />
      </div>

      {/* Reservas puntuales (huecos) */}
      {spotBookings.length > 0 && (
        <div className="mb-6 rounded-xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Reservas puntuales</h2>
            <p className="mt-0.5 text-xs text-gray-400">Alumnos apuntados a un hueco libre en una fecha concreta</p>
          </div>
          <div className="divide-y divide-gray-50">
            {spotBookings.map((b: any) => {
              const dateLabel = new Date(b.class_date + 'T12:00:00').toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long',
              })
              const initials = (b.student?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              return (
                <div key={b.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{b.student?.name}</p>
                    <p className="text-sm text-gray-400">{b.student?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700 capitalize">{dateLabel}</p>
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.source === 'bag' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {b.source === 'bag' ? 'Crédito bolsa' : 'Pago único'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
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
          bookings={spotBookings.map((b: any) => ({
            id: b.id,
            status: b.status,
            source: b.source ?? null,
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
