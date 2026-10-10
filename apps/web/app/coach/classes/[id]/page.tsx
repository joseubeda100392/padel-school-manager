export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { formatTime, getDayOfWeek, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { DevError } from '@/components/dev-error'
import { getClubFeatures } from '@/lib/get-club-features'
import { ClassSessionMarker } from './class-session-marker'
import { AdminAddSpotBooking } from '@/app/dashboard/schedule/[id]/add-spot-booking'
import { SpotBookingsList } from '@/app/dashboard/schedule/[id]/spot-bookings-list'
import { getHolidaySet } from '@/lib/club-holidays'
import { CircleAlert, Clock, FileText } from 'lucide-react'
import { formatLongDate } from '@/lib/format-date'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { Notice } from '@/components/ui/feedback'
import { Avatar, List, ListRow } from '@/components/ui/list'
import { buttonVariants } from '@/components/ui/button'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function CoachClassDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { date?: string } }) {
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
  const TZ = 'Europe/Madrid'
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  // Si venimos de una celda concreta del calendario semanal (?date=), mostrar
  // esa fecha en vez de asumir siempre "hoy" — igual que ya hace la ficha de
  // admin. isViewingRealToday distingue "hoy de verdad" (donde sí tiene
  // sentido marcar asistencia) de una fecha futura/pasada solo consultada.
  const isValidDateParam = !!searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
  const resolvedDate = isValidDateParam ? searchParams.date! : todaySpain
  const isViewingRealToday = resolvedDate === todaySpain

  // Stage 1: solo dependen de schedule (ya disponible), en paralelo.
  const [
    { data: groupEnrollments, error: errEnrollments },
    { data: bookings, error: errBookings },
    features,
    { data: dateOverride },
    { data: allStudents },
    { data: futureBookings },
  ] = await Promise.all([
    admin
      .from('group_enrollments')
      .select('id, start_date, end_date, student:users!group_enrollments_student_id_fkey(id, name, email, current_level_id)')
      .eq('schedule_id', params.id)
      .eq('status', 'active')
      .order('enrolled_at'),
    admin
      .from('bookings')
      .select('id, status, source, created_at, student:users!bookings_student_id_fkey(name, email, avatar_url)')
      .eq('schedule_id', params.id)
      .eq('class_date', resolvedDate)
      .neq('status', 'cancelled')
      .order('created_at'),
    getClubFeatures(schedule.club_id ?? undefined),
    admin
      .from('schedule_time_overrides')
      .select('new_start_time, new_end_time')
      .eq('schedule_id', params.id)
      .eq('override_date', resolvedDate)
      .maybeSingle(),
    admin
      .from('users')
      .select('id, name, email')
      .or('role.eq.student,and(role.eq.coach,also_student.eq.true)')
      .eq('is_active', true)
      .eq('club_id', schedule.club_id)
      .order('name'),
    admin
      .from('bookings')
      .select('id, source, class_date, student_id, student:users!bookings_student_id_fkey(name, email)')
      .eq('schedule_id', params.id)
      .neq('status', 'cancelled')
      .not('class_date', 'is', null)
      .gte('class_date', todaySpain)
      .order('class_date'),
  ])

  const levelIds = [...new Set((groupEnrollments ?? []).map((e: any) => e.student?.current_level_id).filter(Boolean))]
  const enrollmentIds = (groupEnrollments ?? []).map((e: any) => e.id)
  const materialsQuery = admin
    .from('materials')
    .select('id, title, description, file_url, material_levels(level_id)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // Stage 2: dependen de datos de stage 1, pero no entre sí — en paralelo.
  const [{ data: levelsData }, { data: exclusions }, { data: allMaterials }] = await Promise.all([
    levelIds.length
      ? admin.from('levels').select('id, name, color').in('id', levelIds)
      : { data: [] },
    enrollmentIds.length
      ? admin
          .from('schedule_exclusions')
          .select('group_enrollment_id, excluded_date')
          .in('group_enrollment_id', enrollmentIds)
          // Si se está viendo una fecha pasada (?date= de un día ya dado),
          // hay que traer también la falta de ESE día — si no, el conteo de
          // asistentes no descuenta al ausente y "quién faltó" no se puede
          // mostrar, aunque el hueco sí se cubriera con un sustituto.
          .gte('excluded_date', resolvedDate < todaySpain ? resolvedDate : todaySpain)
          .order('excluded_date')
      : { data: [] },
    features.enable_materials
      ? (schedule.club_id ? materialsQuery.eq('club_id', schedule.club_id) : materialsQuery)
      : { data: [] },
  ])

  const levelsMap: Record<string, { name: string; color: string }> = {}
  for (const l of levelsData ?? []) levelsMap[l.id] = { name: l.name, color: l.color }

  const exclusionsByEnrollment: Record<string, string[]> = {}
  for (const x of exclusions ?? []) {
    if (!exclusionsByEnrollment[x.group_enrollment_id]) exclusionsByEnrollment[x.group_enrollment_id] = []
    exclusionsByEnrollment[x.group_enrollment_id].push(x.excluded_date)
  }

  const materials = (allMaterials ?? []).filter((m: any) => {
    if (!m.material_levels || m.material_levels.length === 0) return true
    if (!schedule.level_id) return true
    return m.material_levels.some((ml: any) => ml.level_id === schedule.level_id)
  })

  // Alumnos que el monitor puede meter en un hueco libre de ESTA clase suya —
  // el propio schedule ya viene filtrado por coach_id arriba, así que
  // cualquier scheduleId que llegue aquí es siempre una clase propia.
  const enrolledStudentIds = new Set((groupEnrollments ?? []).map((e: any) => e.student?.id).filter(Boolean))
  const spotAvailableStudents = (allStudents ?? [])
    .map((s: any) => ({ id: s.id, name: s.name, email: s.email }))
    .filter((s: any) => !enrolledStudentIds.has(s.id))
  const existingSpotBookings = (futureBookings ?? [])
    .filter((b: any) => b.student_id)
    .map((b: any) => ({ studentId: b.student_id as string, classDate: b.class_date as string }))

  const start = dateOverride?.new_start_time ?? schedule.start_time
  const end = dateOverride?.new_end_time ?? schedule.end_time
  const groupActiveOnDate = (groupEnrollments ?? []).filter((e: any) => {
    if (e.start_date && e.start_date > resolvedDate) return false
    if (e.end_date && e.end_date < resolvedDate) return false
    return true
  })
  const absentOnDateCount = groupActiveOnDate.filter((e: any) => (exclusionsByEnrollment[e.id] ?? []).includes(resolvedDate)).length
  const groupAttendingOnDate = groupActiveOnDate.length - absentOnDateCount
  const bookingCount = bookings?.length ?? 0
  const enrolled = groupAttendingOnDate + bookingCount

  const { data: clubRow } = schedule.club_id
    ? await admin.from('clubs').select('config').eq('id', schedule.club_id).single()
    : { data: null }
  const isHolidayOnResolvedDate = getHolidaySet((clubRow as any)?.config).has(resolvedDate)

  const resolvedDow = new Date(resolvedDate + 'T12:00:00Z').getUTCDay()
  const scheduleDow = new Date(schedule.start_time).getUTCDay()
  const isClassDayOnResolvedDate = resolvedDow === scheduleDow && !isHolidayOnResolvedDate

  let existingSessionData: { status: 'given' | 'not_given'; cancel_reason: string | null; confirmed_by_admin: string | null; absentStudentIds: string[] } | null = null
  if (features.enable_class_validation && isViewingRealToday && isClassDayOnResolvedDate) {
    const { data: sessionRow } = await admin
      .from('class_sessions')
      .select('id, status, cancel_reason, confirmed_by_admin')
      .eq('schedule_id', params.id)
      .eq('session_date', todaySpain)
      .maybeSingle()
    if (sessionRow) {
      const { data: absences } = await admin
        .from('class_session_absences')
        .select('student_id')
        .eq('class_session_id', sessionRow.id)
      existingSessionData = {
        status: sessionRow.status as 'given' | 'not_given',
        cancel_reason: sessionRow.cancel_reason,
        confirmed_by_admin: sessionRow.confirmed_by_admin,
        absentStudentIds: (absences ?? []).map((a) => a.student_id),
      }
    }
  }
  const resolvedDateLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(new Date(resolvedDate + 'T12:00:00Z'))

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <DevError errors={[errEnrollments?.message, errBookings?.message]} />
      <RealtimeRefresh
        channelName={`coach-class-${params.id}`}
        subs={[
          { table: 'bookings', filter: `schedule_id=eq.${params.id}` },
          { table: 'group_enrollments', filter: `schedule_id=eq.${params.id}` },
          { table: 'schedule_exclusions' },
        ]}
      />
      <PageHeader title="Detalle de clase" back={{ href: '/coach/classes', label: 'Mis clases' }} />

      {isHolidayOnResolvedDate && (
        <Notice tone="warn" icon={<CircleAlert />}>
          Festivo: no hay clase este día.
        </Notice>
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-title tabular-nums text-ink">
              {formatTime(start)} – {formatTime(end)}
            </p>
            <p className="mt-0.5 text-body text-ink-2">{DAYS[getDayOfWeek(start)]} · {schedule.court?.name ?? '—'}</p>
            {dateOverride && (
              <p className="mt-1 inline-flex items-center gap-1 text-meta font-medium text-warn-ink">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Cambio de hora puntual ese día
              </p>
            )}
            {schedule.level && (
              <div className="mt-2">
                <LevelTag name={schedule.level.name} color={schedule.level.color} />
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-display tabular-nums text-ink">
              {enrolled}<span className="text-heading text-ink-3">/{schedule.max_students}</span>
            </p>
            <p className="text-meta text-ink-3">alumnos</p>
          </div>
        </div>
        <div className="mt-4">
          <div
            role="progressbar"
            aria-label="Ocupación de la clase"
            aria-valuemin={0}
            aria-valuemax={schedule.max_students}
            aria-valuenow={enrolled}
            className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]"
          >
            <div
              className="h-1.5 rounded-full bg-accent"
              style={{ width: `${Math.min((enrolled / schedule.max_students) * 100, 100)}%` }}
            />
          </div>
          <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-meta text-ink-3">
            <span className="tabular-nums">{schedule.max_students - enrolled} plazas libres</span>
            <span>{formatLongDate(resolvedDate)}</span>
          </p>
        </div>
      </Card>

      {features.enable_class_validation && isViewingRealToday && isClassDayOnResolvedDate && (
        <ClassSessionMarker
          scheduleId={params.id}
          sessionDate={todaySpain}
          sessionDateLabel={resolvedDateLabel}
          students={groupActiveOnDate
            .map((e: any) => ({ id: e.student?.id, name: e.student?.name }))
            .filter((s: any) => s.id)}
          existingSession={existingSessionData}
        />
      )}

      {/* Grupo fijo — solo quien está activo en la fecha que se está viendo:
          un sustituto que aún no arranca o una baja ya efectiva ese día no
          deben aparecer mezclados con quien sí va a esa clase en concreto. */}
      {groupActiveOnDate.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Grupo fijo ({groupActiveOnDate.length})</SectionTitle>
          <Card className="overflow-hidden">
            <List>
              {groupActiveOnDate.map((e: any) => {
                const s = e.student
                const upcomingFaltas = exclusionsByEnrollment[e.id] ?? []
                const studentLevel = s?.current_level_id ? levelsMap[s.current_level_id] : null
                return (
                  <ListRow
                    key={e.id}
                    leading={<Avatar name={s?.name ?? '?'} />}
                    title={s?.name}
                    subtitle={
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {studentLevel && <LevelTag name={studentLevel.name} color={studentLevel.color} />}
                        {upcomingFaltas.map((date: string) => (
                          <Badge key={date} tone="warn">
                            <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                            Falta {formatLongDate(date, { weekday: false })}
                          </Badge>
                        ))}
                      </span>
                    }
                    trailing={
                      <Link
                        href={`/coach/students/${s?.id}`}
                        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                      >
                        Objetivos
                      </Link>
                    }
                  />
                )
              })}
            </List>
          </Card>
        </section>
      )}

      {materials.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Materia didáctica ({materials.length})</SectionTitle>
          <Card className="overflow-hidden">
            <List>
              {materials.map((m: any) => (
                <ListRow
                  key={m.id}
                  leading={
                    <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-control bg-ink/[0.05] text-ink-2">
                      <FileText className="h-5 w-5" />
                    </span>
                  }
                  title={m.title}
                  subtitle={m.description ? <span className="block truncate">{m.description}</span> : undefined}
                  trailing={
                    m.file_url ? (
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                      >
                        Abrir PDF
                      </a>
                    ) : undefined
                  }
                />
              ))}
            </List>
          </Card>
        </section>
      )}

      {features.enable_spots && (futureBookings ?? []).length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Reservas puntuales</SectionTitle>
          <p className="text-meta text-ink-3">Alumnos apuntados a un hueco libre en una fecha concreta</p>
          <Card className="overflow-hidden">
            <SpotBookingsList
              bookings={(futureBookings ?? []).map((b: any) => ({
                id: b.id,
                source: b.source,
                class_date: b.class_date,
                student: b.student ? { name: b.student.name, email: b.student.email } : null,
              }))}
            />
          </Card>
        </section>
      )}

      <Card>
        <AdminAddSpotBooking
          scheduleId={params.id}
          nextDate={resolvedDate}
          availableStudents={spotAvailableStudents}
          clubId={schedule.club_id ?? null}
          existingBookings={existingSpotBookings}
        />
      </Card>
    </div>
  )
}
