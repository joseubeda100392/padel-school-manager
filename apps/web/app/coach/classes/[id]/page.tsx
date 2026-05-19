import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { formatTime, getDayOfWeek, formatDate } from '@/lib/utils'
import AttendanceForm from '@/app/dashboard/schedule/[id]/attendance-form'
import Link from 'next/link'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { DevError } from '@/components/dev-error'

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

  const [{ data: groupEnrollments, error: errEnrollments }, { data: bookings, error: errBookings }] = await Promise.all([
    admin
      .from('group_enrollments')
      .select('id, student:users!group_enrollments_student_id_fkey(id, name, email, current_level_id)')
      .eq('schedule_id', params.id)
      .eq('status', 'active')
      .order('enrolled_at'),
    admin
      .from('bookings')
      .select('id, status, source, created_at, student:users!bookings_student_id_fkey(name, email, avatar_url)')
      .eq('schedule_id', params.id)
      .neq('status', 'cancelled')
      .order('created_at'),
  ])

  const levelIds = [...new Set((groupEnrollments ?? []).map((e: any) => e.student?.current_level_id).filter(Boolean))]
  const { data: levelsData } = levelIds.length
    ? await admin.from('levels').select('id, name, color').in('id', levelIds)
    : { data: [] }
  const levelsMap: Record<string, { name: string; color: string }> = {}
  for (const l of levelsData ?? []) levelsMap[l.id] = { name: l.name, color: l.color }

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

  const materialsQuery = admin
    .from('materials')
    .select('id, title, description, file_url, material_levels(level_id)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  const { data: allMaterials } = await (
    schedule.club_id ? materialsQuery.eq('club_id', schedule.club_id) : materialsQuery
  )
  const materials = (allMaterials ?? []).filter((m: any) => {
    if (!m.material_levels || m.material_levels.length === 0) return true
    if (!schedule.level_id) return true
    return m.material_levels.some((ml: any) => ml.level_id === schedule.level_id)
  })

  const start = schedule.start_time
  const end = schedule.end_time
  const groupCount = groupEnrollments?.length ?? 0
  const bookingCount = bookings?.length ?? 0
  const enrolled = groupCount + bookingCount

  return (
    <div className="max-w-2xl">
      <DevError errors={[errEnrollments?.message, errBookings?.message]} />
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
                    {s?.current_level_id && levelsMap[s.current_level_id] && (
                      <span
                        className="inline-block rounded-full px-2 py-0 text-xs font-medium text-white"
                        style={{ backgroundColor: levelsMap[s.current_level_id].color }}
                      >
                        {levelsMap[s.current_level_id].name}
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

      {/* Materiales */}
      {materials.length > 0 && (
        <div className="mb-6 rounded-xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Material didáctico
              <span className="ml-1 text-sm font-normal text-gray-400">({materials.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {materials.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                  <span className="text-xs font-bold text-red-600">PDF</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{m.title}</p>
                  {m.description && (
                    <p className="text-xs text-gray-400 truncate">{m.description}</p>
                  )}
                </div>
                {m.file_url && (
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Abrir
                  </a>
                )}
              </div>
            ))}
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
              currentLevel: null,
            },
          }))}
        />
      </div>
    </div>
  )
}
