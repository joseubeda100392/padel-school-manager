import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { formatTime, getDayOfWeek, formatDate } from '@/lib/utils'
import AttendanceForm from '@/app/dashboard/schedule/[id]/attendance-form'
import Link from 'next/link'
import { RealtimeRefresh } from '@/components/realtime-refresh'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function CoachClassDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: schedule } = await admin
    .from('schedules')
    .select('*, court:courts(name), level:levels(name, color)')
    .eq('id', params.id)
    .eq('coach_id', user.id)
    .single()

  if (!schedule) notFound()

  const today = new Date().toISOString().split('T')[0]

  const [{ data: groupEnrollments }, { data: bookings }] = await Promise.all([
    admin
      .from('group_enrollments')
      .select('id, student:users!group_enrollments_student_id_fkey(id, name, email, current_level_id, currentLevel:levels(name, color))')
      .eq('schedule_id', params.id)
      .eq('status', 'active')
      .order('enrolled_at'),
    admin
      .from('bookings')
      .select('*, student:users!bookings_student_id_fkey(name, email, avatar_url, currentLevel:levels(name, color))')
      .eq('schedule_id', params.id)
      .neq('status', 'cancelled')
      .order('created_at'),
  ])

  const enrollmentIds = (groupEnrollments ?? []).map((e: any) => e.id)
  const { data: exclusions } = enrollmentIds.length
    ? await admin
        .from('schedule_exclusions')
        .select('group_enrollment_id, excluded_date')
        .in('group_enrollment_id', enrollmentIds)
        .gte('excluded_date', today)
        .order('excluded_date')
    : { data: [] }

  const exclusionsByEnrollment: Record<string, string[]> = {}
  for (const x of exclusions ?? []) {
    if (!exclusionsByEnrollment[x.group_enrollment_id]) exclusionsByEnrollment[x.group_enrollment_id] = []
    exclusionsByEnrollment[x.group_enrollment_id].push(x.excluded_date)
  }

  const start = schedule.start_time
  const end = schedule.end_time
  const groupCount = groupEnrollments?.length ?? 0
  const bookingCount = bookings?.length ?? 0
  const enrolled = groupCount + bookingCount

  return (
    <div className="max-w-2xl">
      <RealtimeRefresh
        channelName={`coach-class-${params.id}`}
        subs={[
          { table: 'bookings', filter: `schedule_id=eq.${params.id}` },
          { table: 'group_enrollments', filter: `schedule_id=eq.${params.id}` },
          { table: 'schedule_exclusions' },
        ]}
      />
      <div className="mb-6 flex items-center gap-3">
        <Link href="/coach/classes" className="text-sm text-gray-500 hover:text-gray-700">← Mis Clases</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">Detalle de clase</h1>
      </div>

      {/* Info */}
      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-gray-900">
              {DAYS[getDayOfWeek(start)]} · {formatTime(start)} – {formatTime(end)}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">{schedule.court?.name ?? '—'}</p>
            {schedule.level && (
              <span
                className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: schedule.level.color }}
              >
                {schedule.level.name}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">
              {enrolled}<span className="text-lg font-normal text-gray-400">/{schedule.max_students}</span>
            </p>
            <p className="text-xs text-gray-400">alumnos</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${Math.min((enrolled / schedule.max_students) * 100, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">{schedule.max_students - enrolled} plazas libres</p>
        </div>
      </div>

      {/* Grupo fijo */}
      {groupCount > 0 && (
        <div className="mb-6 rounded-xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Grupo fijo <span className="ml-1 text-sm font-normal text-gray-400">({groupCount})</span></h2>
          </div>
          <div className="divide-y divide-gray-50">
            {(groupEnrollments ?? []).map((e: any) => {
              const s = e.student
              const initials = (s?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              const upcomingFaltas = exclusionsByEnrollment[e.id] ?? []
              return (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{s?.name}</p>
                    {s?.currentLevel && (
                      <span
                        className="inline-block rounded-full px-2 py-0 text-xs font-medium text-white"
                        style={{ backgroundColor: s.currentLevel.color }}
                      >
                        {s.currentLevel.name}
                      </span>
                    )}
                  </div>
                  {upcomingFaltas.length > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-orange-500">Falta {new Date(upcomingFaltas[0] + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Asistencia (bookings puntuales) */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Lista de asistencia</h2>
          <p className="mt-0.5 text-xs text-gray-400">Marca ✓ o ✗ para registrar la asistencia</p>
        </div>
        <AttendanceForm
          scheduleId={params.id}
          bookings={(bookings ?? []).map((b: any) => ({
            id: b.id,
            status: b.status,
            source: b.source ?? null,
            scheduleId: params.id,
            student: {
              name: b.student?.name,
              email: b.student?.email,
              avatar_url: b.student?.avatar_url,
              currentLevel: b.student?.currentLevel ?? null,
            },
          }))}
        />
      </div>
    </div>
  )
}
