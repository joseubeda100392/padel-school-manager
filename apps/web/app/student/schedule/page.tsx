import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { StudentScheduleClient } from './schedule-client'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function getNextOccurrence(startTime: string): Date {
  const base = new Date(startTime)
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

export default async function StudentSchedulePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const { data: enrollments } = await supabase
    .from('group_enrollments')
    .select(`
      id, monthly_price, paid_until, enrolled_at,
      schedule:schedules(id, start_time, end_time, max_students,
        court:courts(name),
        level:levels(name, color)
      )
    `)
    .eq('student_id', user.id)
    .eq('status', 'active')
    .order('enrolled_at')

  const enrollmentIds = (enrollments ?? []).map(e => e.id)
  const { data: exclusionsRaw } = enrollmentIds.length
    ? await supabase
        .from('schedule_exclusions')
        .select('id, group_enrollment_id, excluded_date, publish_spot')
        .in('group_enrollment_id', enrollmentIds)
        .gte('excluded_date', today)
        .order('excluded_date')
    : { data: [] }

  const { data: cfgRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'cancellation_hours')
    .single()

  const cancellationHours = cfgRow ? Number(cfgRow.value) : 24

  const items = (enrollments ?? []).map(e => {
    const schedule = e.schedule as any
    const nextDate = getNextOccurrence(schedule?.start_time ?? '')
    const hoursUntil = (nextDate.getTime() - Date.now()) / 3600000
    const canRegisterFalta = hoursUntil >= cancellationHours
    const myExclusions = (exclusionsRaw ?? [])
      .filter(x => x.group_enrollment_id === e.id)
      .map(x => ({ id: x.id, excluded_date: x.excluded_date, publish_spot: x.publish_spot }))

    return {
      enrollmentId: e.id,
      monthlyPrice: e.monthly_price,
      paidUntil: e.paid_until,
      isPaid: isPaidThisMonth(e.paid_until),
      canRegisterFalta,
      nextDate: nextDate.toISOString(),
      schedule: {
        id: schedule?.id,
        dayLabel: DAYS[new Date(schedule?.start_time).getDay()],
        startTime: new Date(schedule?.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        endTime: new Date(schedule?.end_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        courtName: schedule?.court?.name ?? '—',
        level: schedule?.level ?? null,
      },
      exclusions: myExclusions,
    }
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
