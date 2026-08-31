import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatCurrency, formatTime, getDayOfWeek } from '@/lib/utils'
import { StudentScheduleClient } from './schedule-client'
import { SpotBookingCard } from './spot-booking-card'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { getClubFeatures } from '@/lib/get-club-features'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function getUpcomingOccurrences(
  startTime: string,
  cancellationHours: number,
  overrides: { override_date: string; new_start_time: string }[],
  count = 8,
): { dateStr: string; label: string; canRegister: boolean; overrideTime: string | null }[] {
  const base = new Date(startTime)
  const now = new Date()
  const first = new Date(now)
  first.setHours(base.getHours(), base.getMinutes(), 0, 0)
  const diff = (base.getDay() - now.getDay() + 7) % 7
  first.setDate(now.getDate() + (diff === 0 && first <= now ? 7 : diff))
  while (first < base) first.setDate(first.getDate() + 7)

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first)
    d.setDate(d.getDate() + i * 7)
    const dateStr = d.toISOString().split('T')[0]
    const hoursUntil = (d.getTime() - Date.now()) / 3600000
    const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    const override = overrides.find(o => o.override_date === dateStr)
    const overrideTime = override
      ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date(override.new_start_time))
      : null
    return { dateStr, label, canRegister: hoursUntil >= cancellationHours, overrideTime }
  })
}

function isPaidThisMonth(paidUntil: string | null) {
  if (!paidUntil) return false
  const now = new Date()
  return new Date(paidUntil) >= new Date(now.getFullYear(), now.getMonth() + 1, 0)
}

export default async function StudentSchedulePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  // Stage 1: solo dependen de user.id, en paralelo.
  const [
    { data: enrollments },
    { data: userRow },
    { data: spotBookings },
  ] = await Promise.all([
    getAdminClient()
      .from('group_enrollments')
      .select(`
        id, monthly_price, paid_until, enrolled_at, start_date,
        schedule:schedules(id, start_time, end_time, max_students,
          court:courts(name),
          level:levels(name, color),
          coach:users!schedules_coach_id_fkey(name)
        )
      `)
      .eq('student_id', user.id)
      .eq('status', 'active')
      .order('enrolled_at'),
    getAdminClient().from('users').select('club_id').eq('id', user.id).single(),
    getAdminClient()
      .from('bookings')
      .select(`
        id, class_date, status, source,
        schedule:schedules(id, start_time, end_time, max_students,
          court:courts(name),
          level:levels(name, color),
          coach:users!schedules_coach_id_fkey(name)
        )
      `)
      .eq('student_id', user.id)
      .eq('status', 'confirmed')
      .not('class_date', 'is', null)
      .gte('class_date', (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })())
      .order('class_date'),
  ])

  const clubId = (userRow as any)?.club_id ?? null
  const enrollmentIds = (enrollments ?? []).map(e => e.id)
  const scheduleIdsForOverrides = (enrollments ?? []).map(e => (e.schedule as any)?.id).filter(Boolean)
  const TZ = 'Europe/Madrid'
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())

  // Stage 2: dependen de datos de la stage 1 (clubId / enrollmentIds), pero no entre sí.
  const [
    { data: exclusionsRaw },
    { data: clubRow },
    features,
    { data: timeOverrides },
  ] = await Promise.all([
    enrollmentIds.length
      ? getAdminClient()
          .from('schedule_exclusions')
          .select('id, group_enrollment_id, excluded_date, publish_spot')
          .in('group_enrollment_id', enrollmentIds)
          .gte('excluded_date', today)
          .order('excluded_date')
      : { data: [] },
    clubId
      ? getAdminClient().from('clubs').select('config').eq('id', clubId).single()
      : { data: null },
    getClubFeatures(clubId),
    scheduleIdsForOverrides.length
      ? getAdminClient()
          .from('schedule_time_overrides')
          .select('schedule_id, override_date, new_start_time')
          .in('schedule_id', scheduleIdsForOverrides)
          .gte('override_date', todaySpain)
      : { data: [] },
  ])

  const cancellationHours = (clubRow as any)?.config?.cancellation_hours ?? 24
  const billingStartDate: string | null = (clubRow as any)?.config?.billing_start_date ?? null
  const billingActive = !billingStartDate || todaySpain >= billingStartDate

  const items = (enrollments ?? []).map(e => {
    const schedule = e.schedule as any
    const myOverrides = (timeOverrides ?? []).filter((o: any) => o.schedule_id === schedule?.id)
    const upcomingOccurrences = getUpcomingOccurrences(schedule?.start_time ?? '', cancellationHours, myOverrides)
    const myExclusions = (exclusionsRaw ?? [])
      .filter((x: any) => x.group_enrollment_id === e.id)
      .map((x: any) => ({ id: x.id, excluded_date: x.excluded_date, publish_spot: x.publish_spot }))

    return {
      enrollmentId: e.id,
      monthlyPrice: e.monthly_price,
      paidUntil: e.paid_until,
      // Si la facturación de esta inscripción todavía no ha arrancado
      // (start_date en el futuro), no mostrarla como pendiente de pago —
      // la clase no ha dado ni una sesión todavía, no debe nada.
      isPaid: (e.start_date && e.start_date > todaySpain) || isPaidThisMonth(e.paid_until),
      upcomingOccurrences,
      schedule: {
        id: schedule?.id,
        dayLabel: DAYS[getDayOfWeek(schedule?.start_time)],
        startTime: formatTime(schedule?.start_time),
        endTime: formatTime(schedule?.end_time),
        courtName: schedule?.court?.name ?? '—',
        coachName: schedule?.coach?.name ?? null,
        level: schedule?.level ?? null,
      },
      exclusions: myExclusions,
    }
  })

  return (
    <div className="max-w-2xl space-y-8">
      <RealtimeRefresh
        channelName={`student-schedule-${user.id}`}
        subs={[
          { table: 'schedule_exclusions' },
          { table: 'bookings', filter: `student_id=eq.${user.id}` },
          { table: 'group_enrollments', filter: `student_id=eq.${user.id}` },
        ]}
      />
      <div>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Mis Clases</h1>
          <p className="text-sm text-gray-500">Tus clases de grupo fijo</p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center shadow-sm">
            <p className="text-gray-400">No estás inscrito en ninguna clase de grupo fijo.</p>
            <p className="mt-1 text-xs text-gray-400">Habla con tu administrador para inscribirte.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <StudentScheduleClient
                key={item.enrollmentId}
                item={item}
                cancellationHours={cancellationHours}
                enablePayments={features.enable_payments && billingActive}
              />
            ))}
          </div>
        )}
      </div>

      {(spotBookings ?? []).length > 0 && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Reservas puntuales</h2>
            <p className="text-sm text-gray-500">Huecos libres en los que estás apuntado</p>
          </div>
          <div className="space-y-3">
            {(spotBookings ?? []).map(b => (
              <SpotBookingCard
                key={b.id}
                booking={{
                  id: b.id,
                  class_date: b.class_date as string,
                  source: b.source as string,
                  schedule: b.schedule as any,
                }}
                cancellationHours={cancellationHours}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
