import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatCurrency, formatTime, getDayOfWeek } from '@/lib/utils'
import Link from 'next/link'
import { RealtimeRefresh } from '@/components/realtime-refresh'

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

export default async function StudentHomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: userData }, { data: bag }, { data: enrollments }, { data: spots }] = await Promise.all([
    getAdminClient().from('users').select('name, current_level_id').eq('id', user.id).single(),
    getAdminClient().from('class_bag').select('balance').eq('user_id', user.id).single(),
    getAdminClient()
      .from('group_enrollments')
      .select('id, monthly_price, paid_until, schedule:schedules(id, start_time, end_time, court:courts(name))')
      .eq('student_id', user.id)
      .eq('status', 'active'),
    getAdminClient()
      .from('schedule_exclusions')
      .select('id')
      .eq('publish_spot', true)
      .gte('excluded_date', new Date().toISOString().split('T')[0]),
  ])

  const myLevelId = (userData as any)?.current_level_id ?? null
  const { data: levelData } = myLevelId
    ? await getAdminClient().from('levels').select('name, color').eq('id', myLevelId).single()
    : { data: null }

  const bagBalance = bag?.balance ?? 0
  const activeEnrollments = enrollments ?? []
  const pendingEnrollments = activeEnrollments.filter(e => !isPaidThisMonth(e.paid_until))

  const nextClass = activeEnrollments
    .map(e => ({ ...e, nextDate: getNextOccurrence((e.schedule as any)?.start_time ?? '') }))
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())[0]

  const level = levelData
  const spotsCount = spots?.length ?? 0

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
      {pendingEnrollments.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">
            Tienes {pendingEnrollments.length} cuota{pendingEnrollments.length > 1 ? 's' : ''} pendiente{pendingEnrollments.length > 1 ? 's' : ''} de pago
          </p>
          <Link href="/student/schedule" className="mt-1 block text-xs text-red-600 underline">
            Ver mis clases y pagar →
          </Link>
        </div>
      )}

      {/* Cards resumen */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Clases disponibles</p>
          <p className={`mt-2 text-4xl font-bold ${bagBalance > 0 ? 'text-green-600' : 'text-gray-400'}`}>{bagBalance}</p>
          <Link href="/student/bag" className="mt-2 block text-xs text-green-600 hover:underline">
            {bagBalance === 0 ? 'Comprar bono →' : 'Ver historial →'}
          </Link>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Mis clases</p>
          <p className="mt-2 text-4xl font-bold text-gray-900">{activeEnrollments.length}</p>
          <Link href="/student/schedule" className="mt-2 block text-xs text-green-600 hover:underline">Ver clases →</Link>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Huecos libres</p>
          <p className={`mt-2 text-4xl font-bold ${spotsCount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{spotsCount}</p>
          <Link href="/student/spots" className="mt-2 block text-xs text-green-600 hover:underline">Ver huecos →</Link>
        </div>
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
            <div className="text-right">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isPaidThisMonth(nextClass.paid_until) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {isPaidThisMonth(nextClass.paid_until) ? 'Pagado' : 'Pendiente'}
              </span>
              <p className="mt-1 text-xs text-gray-400">{formatCurrency(nextClass.monthly_price)}/mes</p>
            </div>
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
