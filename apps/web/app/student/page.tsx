import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatCurrency, formatTime, getDayOfWeek } from '@/lib/utils'
import Link from 'next/link'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { getClubFeatures } from '@/lib/get-club-features'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function getNextOccurrence(startTime: string): Date | null {
  if (!startTime) return null
  const base = new Date(startTime)
  if (isNaN(base.getTime())) return null
  const now = new Date()
  const next = new Date(now)
  next.setHours(base.getHours(), base.getMinutes(), 0, 0)
  const diff = (base.getDay() - now.getDay() + 7) % 7
  next.setDate(now.getDate() + (diff === 0 && next <= now ? 7 : diff))
  return next
}

function isPaidThisMonth(paidUntil: string | null) {
  if (!paidUntil) return false
  const now = new Date()
  return new Date(paidUntil) >= new Date(now.getFullYear(), now.getMonth() + 1, 0)
}

export default async function StudentHomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: userData } = await admin.from('users').select('name, current_level_id, club_id').eq('id', user.id).single()
  const clubId = (userData as any)?.club_id as string | undefined

  const today = new Date().toISOString().split('T')[0]
  const TZ = 'Europe/Madrid'

  const [features, { data: bag }, { data: enrollments }, { data: spots }, { data: capacitySchedules }, { data: mySpotBookings }] = await Promise.all([
    getClubFeatures(clubId),
    admin.from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).single(),
    admin
      .from('group_enrollments')
      .select('id, monthly_price, paid_until, schedule:schedules(id, start_time, end_time, court:courts(name))')
      .eq('student_id', user.id)
      .eq('status', 'active'),
    clubId
      ? admin.from('schedule_exclusions').select('id, group_enrollment:group_enrollments!group_enrollment_id(schedule_id, schedule:schedules!schedule_id(club_id))').eq('publish_spot', true).gte('excluded_date', today)
      : admin.from('schedule_exclusions').select('id').eq('publish_spot', true).gte('excluded_date', today),
    clubId
      ? admin.from('schedules').select('id, max_students, type, recurrence, recurrence_end_date, start_time, level:levels(id), enrollments:group_enrollments(student_id, status)').eq('club_id', clubId).neq('type', 'intensivo')
      : Promise.resolve({ data: [] }),
    admin.from('bookings').select('schedule_id, class_date').eq('student_id', user.id).eq('status', 'confirmed').not('class_date', 'is', null),
  ])

  const myLevelId = (userData as any)?.current_level_id ?? null
  const { data: levelData } = myLevelId
    ? await admin.from('levels').select('name, color').eq('id', myLevelId).single()
    : { data: null }

  const bagBalance = (bag?.balance_60 ?? 0) + (bag?.balance_90 ?? 0)
  const activeEnrollments = enrollments ?? []
  const pendingEnrollments = activeEnrollments.filter((e: any) => !isPaidThisMonth(e.paid_until))

  const nextClass = (activeEnrollments as any[])
    .flatMap((e: any) => {
      const nextDate = getNextOccurrence((e.schedule as any)?.start_time ?? '')
      return nextDate ? [{ ...e, nextDate }] : []
    })
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())[0]

  const level = levelData

  const absenceSpots = clubId
    ? (spots ?? []).filter((s: any) => (s.group_enrollment as any)?.schedule?.club_id === clubId)
    : (spots ?? [])
  const absenceCount = absenceSpots.length
  const absenceScheduleIds = new Set(absenceSpots.map((s: any) => (s.group_enrollment as any)?.schedule_id).filter(Boolean))

  const myEnrolledScheduleIds = new Set(activeEnrollments.map((e: any) => (e.schedule as any)?.id).filter(Boolean))

  function getClassDateHome(s: any): string | null {
    if (!s.start_time) return null
    if (isNaN(new Date(s.start_time).getTime())) return null
    if (s.recurrence === 'none') {
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(s.start_time))
      return d < today ? null : d
    }
    const base = new Date(s.start_time)
    const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
    const [sy, sm, sd] = todaySpain.split('-').map(Number)
    const nowH = parseInt(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date()))
    const classH = parseInt(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: TZ }).format(base))
    const classDow = getDayOfWeek(base)
    const todayDow = getDayOfWeek(new Date(Date.UTC(sy, sm - 1, sd, 10, 0, 0)))
    let daysUntil = (classDow - todayDow + 7) % 7
    if (daysUntil === 0 && nowH >= classH) daysUntil = 7
    const result = new Date(Date.UTC(sy, sm - 1, sd + daysUntil, 10, 0, 0))
    const nextDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(result)
    if (s.recurrence_end_date && nextDate > s.recurrence_end_date) return null
    return nextDate
  }

  const capacityCount = (capacitySchedules ?? []).filter((s: any) => {
    const allEnrollments = (s.enrollments ?? []) as any[]
    const active = allEnrollments.filter((e: any) => e.status === 'active')
    const alreadyIn = active.some((e: any) => e.student_id === user.id) || myEnrolledScheduleIds.has(s.id)
    const levelId = (s.level as any)?.id ?? null
    const levelOk = !myLevelId || !levelId || levelId === myLevelId
    const classDate = getClassDateHome(s)
    if (!classDate) return false
    if (absenceScheduleIds.has(s.id)) return false
    const alreadyBooked = (mySpotBookings ?? []).some((b: any) => b.schedule_id === s.id && b.class_date === classDate)
    return !alreadyIn && active.length < s.max_students && levelOk && !alreadyBooked
  }).length

  const spotsCount = absenceCount + capacityCount

  return (
    <div className="max-w-2xl">
      <RealtimeRefresh
        channelName={`student-home-${user.id}`}
        subs={[
          { table: 'class_bag', filter: `user_id=eq.${user.id}` },
          { table: 'schedule_exclusions', event: 'INSERT' },
          { table: 'bookings', filter: `student_id=eq.${user.id}` },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hola, {(userData as any)?.name?.split(' ')[0] ?? user.user_metadata?.full_name?.split(' ')[0] ?? user.user_metadata?.name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'alumno'} 👋</h1>
        <p className="text-sm text-gray-500">Bienvenido a tu área personal</p>
      </div>

      {/* Alerta cuota pendiente */}
      {features.enable_payments && pendingEnrollments.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">
            Tienes {pendingEnrollments.length} cuota{pendingEnrollments.length > 1 ? 's' : ''} pendiente{pendingEnrollments.length > 1 ? 's' : ''} de pago
          </p>
          <Link href="/student/schedule" className="mt-1 block text-xs text-red-600 underline">
            Ver mis clases →
          </Link>
        </div>
      )}

      {/* Cards resumen */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {features.enable_bag && (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Clases disponibles</p>
            <p className={`mt-2 text-4xl font-bold ${bagBalance > 0 ? 'text-brand-500' : 'text-gray-400'}`}>{bagBalance}</p>
            <Link href="/student/bag" className="mt-2 block text-xs text-brand-500 hover:underline">
              Ver historial →
            </Link>
          </div>
        )}

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Mis clases</p>
          <p className="mt-2 text-4xl font-bold text-gray-900">{activeEnrollments.length}</p>
          <Link href="/student/schedule" className="mt-2 block text-xs text-brand-500 hover:underline">Ver clases →</Link>
        </div>

        {features.enable_spots && (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Huecos libres</p>
            <p className={`mt-2 text-4xl font-bold ${spotsCount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{spotsCount}</p>
            <Link href="/student/spots" className="mt-2 block text-xs text-brand-500 hover:underline">Ver huecos →</Link>
          </div>
        )}
      </div>

      {/* Próxima clase */}
      {nextClass && (
        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-medium uppercase text-gray-500">Próxima clase</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900">
                {DAYS[nextClass.nextDate.getDay()]} {nextClass.nextDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
              </p>
              <p className="text-sm text-gray-500">
                {formatTime((nextClass.schedule as any)?.start_time)}
                {' — '}
                {formatTime((nextClass.schedule as any)?.end_time)}
                {' · '}
                {(nextClass.schedule as any)?.court?.name}
              </p>
            </div>
            {features.enable_payments && (
              <div className="text-right">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isPaidThisMonth(nextClass.paid_until) ? 'bg-brand-100 text-brand-600' : 'bg-red-100 text-red-600'}`}>
                  {isPaidThisMonth(nextClass.paid_until) ? 'Pagado' : 'Pendiente'}
                </span>
                <p className="mt-1 text-xs text-gray-400">{formatCurrency(nextClass.monthly_price)}/mes</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nivel */}
      {level && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-medium uppercase text-gray-500">Mi nivel</p>
          <span
            className="inline-block rounded-full px-3 py-1 text-sm font-semibold text-white"
            style={{ backgroundColor: level.color }}
          >
            {level.name}
          </span>
        </div>
      )}
    </div>
  )
}

