export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { formatDate, formatTime, getDayOfWeek, mostCommonMonthlyPrice } from '@/lib/utils'
import { ScheduleActions } from './schedule-actions'
import AttendanceForm from './attendance-form'
import GroupEnrollment from './group-enrollment'
import ScheduleMaterials from './schedule-materials'
import { AdminAddSpotBooking } from './add-spot-booking'
import { SpotBookingsList } from './spot-bookings-list'
import { TimeOverride } from './time-override'
import { CoachOverride } from './coach-override'
import Link from 'next/link'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { getClubFeatures } from '@/lib/get-club-features'
import { DevError } from '@/components/dev-error'

const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TZ = 'Europe/Madrid'

// Igual que en dashboard/schedule/page.tsx: HOY sigue siendo la referencia
// todo el día si le toca hoy, no solo hasta que empiece la clase.
function getNextDate(startTime: string): string {
  const classDow = getDayOfWeek(new Date(startTime))
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const [sy, sm, sd] = todaySpain.split('-').map(Number)
  const todayDow = getDayOfWeek(new Date(Date.UTC(sy, sm - 1, sd, 10, 0, 0)))
  const daysUntil = (classDow - todayDow + 7) % 7
  const result = new Date(Date.UTC(sy, sm - 1, sd + daysUntil, 10, 0, 0))
  const next = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(result)
  const scheduleStartDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(startTime))
  return next < scheduleStartDate ? scheduleStartDate : next
}

export default async function ScheduleDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { from?: string; date?: string } }) {
  const backHref = searchParams.from === 'master' ? '/dashboard/schedule/master' : '/dashboard/schedule'
  const backLabel = searchParams.from === 'master' ? '← Calendario maestro' : '← Horarios'

  const supabase = createClient()
  const admin = getAdminClient()

  const { data: schedule } = await admin
    .from('schedules')
    .select('*, court:courts(name), coach:users!schedules_coach_id_fkey(name, email), level:levels(name, color)')
    .eq('id', params.id)
    .single()

  if (!schedule) notFound()

  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  // Si venimos de una celda concreta del calendario semanal (?date=), respetar
  // esa fecha en vez de recalcular la "próxima clase" — evita que, al pinchar
  // en la clase de hoy pasadas las 9:30, la ficha salte directa a la semana
  // siguiente y pierda el contexto (falta, sustituto, hueco libre) por el que
  // se pinchó.
  const isValidDateParam = !!searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
  const nextDate = isValidDateParam ? searchParams.date! : getNextDate(schedule.start_time)

  // Independientes entre sí una vez tenemos schedule — en paralelo en vez
  // de en cadena, para no sumar la latencia de cada una por separado.
  const [
    features,
    { data: clubRow },
    { data: bookings },
    { data: groupEnrollments, error: errGroupEnrollments },
    { data: allStudents },
    { data: timeOverride },
    { data: coaches },
    { data: coachOverride },
  ] = await Promise.all([
    getClubFeatures(schedule.club_id ?? undefined),
    schedule.club_id
      ? admin.from('clubs').select('config').eq('id', schedule.club_id).single()
      : Promise.resolve({ data: null }),
    // Simplified join: avoid nested currentLevel:levels that can fail silently
    admin
      .from('bookings')
      .select('id, status, source, class_date, student_id, student:users!bookings_student_id_fkey(name, email, avatar_url)')
      .eq('schedule_id', params.id)
      .neq('status', 'cancelled')
      .not('class_date', 'is', null)
      .gte('class_date', todaySpain)
      .order('class_date'),
    admin
      .from('group_enrollments')
      .select('id, monthly_price, price_per_class_cents, court_pricing, discount_classes_pending, paid_until, status, student:users!group_enrollments_student_id_fkey(id, name, email, current_level_id)')
      .eq('schedule_id', params.id)
      .eq('status', 'active')
      .order('enrolled_at'),
    admin
      .from('users')
      .select('id, name, email')
      .or('role.eq.student,and(role.eq.coach,also_student.eq.true)')
      .eq('is_active', true)
      .eq('club_id', schedule.club_id)
      .order('name'),
    admin
      .from('schedule_time_overrides')
      .select('id, override_date, new_start_time, new_end_time, reason')
      .eq('schedule_id', params.id)
      .eq('override_date', nextDate)
      .maybeSingle(),
    admin
      .from('users')
      .select('id, name, email')
      .eq('role', 'coach')
      .eq('is_active', true)
      .eq('club_id', schedule.club_id)
      .order('name'),
    admin
      .from('schedule_coach_overrides')
      .select('id, override_date, new_coach_id, reason, coach:users!schedule_coach_overrides_new_coach_id_fkey(name)')
      .eq('schedule_id', params.id)
      .eq('override_date', nextDate)
      .maybeSingle(),
  ])
  if (errGroupEnrollments) console.error('[schedule/[id]] group_enrollments query failed:', errGroupEnrollments.message)

  const billingStartDate: string | null = (clubRow as any)?.config?.billing_start_date ?? null
  const paymentsActive = features.enable_payments && (!billingStartDate || todaySpain >= billingStartDate)

  const enrollmentIds = (groupEnrollments ?? []).map((e: any) => e.id)
  const { data: exclusionsRaw } = enrollmentIds.length
    ? await admin
        .from('schedule_exclusions')
        .select('id, group_enrollment_id, excluded_date, publish_spot')
        .in('group_enrollment_id', enrollmentIds)
        .gte('excluded_date', todaySpain)
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

  const start = new Date(schedule.start_time)
  const end = new Date(schedule.end_time)

  // All upcoming spot bookings (for display in Reservas puntuales)
  const spotBookings = bookings ?? []

  // For the counter: only the next occurrence, excluding group members with falta that day
  const nextDateSpots = spotBookings.filter((b: any) => b.class_date === nextDate)
  const groupAttendingNextDate = (groupEnrollments ?? []).filter((e: any) => {
    const excls = exclusionsByEnrollment[e.id] ?? []
    return !excls.some((x: any) => x.excluded_date === nextDate)
  }).length
  const enrolled = nextDateSpots.length + groupAttendingNextDate

  const nextDateLabel = new Date(nextDate + 'T12:00:00Z').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ,
  })

  const enrolledStudentIds = new Set(
    (groupEnrollments ?? []).map((e: any) => e.student?.id).filter(Boolean)
  )
  const spotAvailableStudents = (allStudents ?? [])
    .map((s: any) => ({ id: s.id, name: s.name, email: s.email }))
    .filter((s: any) => !enrolledStudentIds.has(s.id))
  const existingBookings = (bookings ?? [])
    .filter((b: any) => b.student_id)
    .map((b: any) => ({ studentId: b.student_id as string, classDate: b.class_date as string }))

  return (
    <div className="max-w-2xl">
      <DevError errors={[errGroupEnrollments?.message]} />
      <RealtimeRefresh
        channelName={`admin-schedule-${params.id}`}
        subs={[
          { table: 'bookings', filter: `schedule_id=eq.${params.id}` },
          { table: 'group_enrollments', filter: `schedule_id=eq.${params.id}` },
          { table: 'schedule_exclusions' },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-700">{backLabel}</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-gray-900">Detalle de clase</h1>
        </div>
        <ScheduleActions scheduleId={params.id} nextDate={nextDate} />
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
                  Sin nivel · <Link href={`/dashboard/schedule/${params.id}/edit`} className="underline hover:text-gray-600">Asignar nivel</Link>
                </span>
              )}
            </div>
            <TimeOverride
              scheduleId={params.id}
              nextDate={nextDate}
              nextDateLabel={nextDateLabel}
              existingOverride={timeOverride ?? null}
            />
            <CoachOverride
              scheduleId={params.id}
              nextDate={nextDate}
              nextDateLabel={nextDateLabel}
              coaches={coaches ?? []}
              existingOverride={coachOverride ?? null}
              regularCoachId={(schedule as any).coach_id ?? null}
            />
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{enrolled}<span className="text-lg text-gray-400">/{schedule.max_students}</span></p>
            <p className="text-xs text-gray-400">alumnos</p>
            <p className="mt-1 text-xs text-gray-400 capitalize">{nextDateLabel}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-brand-500 transition-all"
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
          scheduleEndTime={schedule.end_time}
          courtPricing={{
            withCourt60: (clubRow as any)?.config?.price_per_class_with_court_60 ?? 0,
            withCourt90: (clubRow as any)?.config?.price_per_class_with_court_90 ?? 0,
            withoutCourt60: (clubRow as any)?.config?.price_per_class_without_court_60 ?? 0,
            withoutCourt90: (clubRow as any)?.config?.price_per_class_without_court_90 ?? 0,
          }}
          otherTariffs={{
            claseSuelta60: (clubRow as any)?.config?.pay_per_class_price_60 ?? 0,
            claseSuelta90: (clubRow as any)?.config?.pay_per_class_price_90 ?? 0,
            claseEntera60: (clubRow as any)?.config?.whole_class_price_60 ?? 0,
            claseEntera90: (clubRow as any)?.config?.whole_class_price_90 ?? 0,
          }}
          initialEnrollments={(groupEnrollments ?? []).map((e: any) => ({
            id: e.id,
            monthly_price: e.monthly_price,
            price_per_class_cents: e.price_per_class_cents,
            court_pricing: e.court_pricing,
            discount_classes_pending: e.discount_classes_pending,
            paid_until: e.paid_until,
            status: e.status,
            student: { id: e.student?.id, name: e.student?.name, email: e.student?.email },
          }))}
          initialExclusions={exclusionsByEnrollment}
          availableStudents={(allStudents ?? []).map((s: any) => ({ id: s.id, name: s.name, email: s.email }))}
          defaultMonthlyPrice={mostCommonMonthlyPrice(groupEnrollments ?? [])}
          enablePayments={paymentsActive}
          enableSpots={features.enable_spots}
          enableClassValidation={features.enable_class_validation}
        />
      </div>

      {/* Material de clase */}
      {features.enable_materials && (
        <div className="mb-6">
          <ScheduleMaterials scheduleId={params.id} />
        </div>
      )}

      {/* Reservas puntuales (huecos) */}
      {features.enable_spots && (
        <div className="mb-6 rounded-xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Reservas puntuales</h2>
            <p className="mt-0.5 text-xs text-gray-400">Alumnos apuntados a un hueco libre en una fecha concreta</p>
          </div>
          <SpotBookingsList
            bookings={spotBookings.map((b: any) => ({
              id: b.id,
              source: b.source,
              class_date: b.class_date,
              student: b.student ? { name: b.student.name, email: b.student.email } : null,
            }))}
          />
          <AdminAddSpotBooking
            scheduleId={params.id}
            nextDate={nextDate}
            availableStudents={spotAvailableStudents}
            clubId={schedule.club_id ?? null}
            existingBookings={existingBookings}
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
          bookings={nextDateSpots.map((b: any) => ({
            id: b.id,
            status: b.status,
            source: b.source ?? null,
            scheduleId: params.id,
            student: {
              name: b.student?.name,
              email: b.student?.email,
              avatar_url: b.student?.avatar_url,
              currentLevel: null,
            }
          }))}
        />
      </div>
    </div>
  )
}
