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
    getAdminClient().from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).single(),
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

  const bagBalance = (bag?.balance_60 ?? 0) + (bag?.balance_90 ?? 0)
  const activeEnrollments = enrollments ?? []
  const pendingEnrollments = activeEnrollments.filter(e => !isPaidThisMonth(e.paid_until))

  const nextClass = activeEnrollments
    .map(e => ({ ...e, nextDate: getNextOccurrence((e.schedule as any)?.start_time ?? '') }))
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())[0]

  const level = levelData
  const spotsCount = spots?.length ?? 0
  const firstName = (userData as any)?.name?.split(' ')[0] ?? user.user_metadata?.full_name?.split(' ')[0] ?? user.user_metadata?.name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'alumno'

  return (
    <div className="space-y-6 pb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      <RealtimeRefresh
        channelName={`student-home-${user.id}`}
        subs={[
          { table: 'class_bag', filter: `user_id=eq.${user.id}` },
          { table: 'schedule_exclusions', event: 'INSERT' },
          { table: 'bookings', filter: `student_id=eq.${user.id}` },
        ]}
      />

      {/* Cabecera de bienvenida */}
      <div className="rounded-xl p-5 sm:p-6" style={{ background: 'linear-gradient(135deg, #006b2c 0%, #00873a 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>Bienvenido de nuevo</p>
            <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-white mt-0.5">Hola, {firstName} 👋</h1>
          </div>
          {level && (
            <span
              className="hidden sm:inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white shadow"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              {level.name}
            </span>
          )}
        </div>
        {level && (
          <span
            className="mt-3 inline-flex sm:hidden items-center rounded-full px-3 py-1 text-[11px] font-bold text-white"
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            {level.name}
          </span>
        )}
      </div>

      {/* Alerta de cuotas pendientes */}
      {pendingEnrollments.length > 0 && (
        <div className="rounded-xl border p-4 flex items-start gap-3" style={{ borderColor: '#fca5a5', background: '#fef2f2' }}>
          <svg className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#dc2626' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-[13px] font-bold" style={{ color: '#991b1b' }}>
              {pendingEnrollments.length} cuota{pendingEnrollments.length > 1 ? 's' : ''} pendiente{pendingEnrollments.length > 1 ? 's' : ''} de pago
            </p>
            <Link href="/student/schedule" className="mt-0.5 block text-[12px] font-semibold hover:underline" style={{ color: '#dc2626' }}>
              Ver mis clases y pagar →
            </Link>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div
          className="rounded-xl border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
          style={{ background: '#ffffff', borderColor: '#bdcaba', borderTopColor: '#006b2c', borderTopWidth: 4 }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Clases disponibles</p>
          <p className="mt-2 text-[36px] sm:text-[40px] font-extrabold leading-none" style={{ color: bagBalance > 0 ? '#006b2c' : '#bdcaba' }}>
            {bagBalance}
          </p>
          <Link href="/student/bag" className="mt-2 block text-[12px] font-bold hover:underline" style={{ color: '#006b2c' }}>
            {bagBalance === 0 ? 'Comprar bono →' : 'Ver tienda →'}
          </Link>
        </div>
        <div
          className="rounded-xl border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
          style={{ background: '#ffffff', borderColor: '#bdcaba', borderTopColor: '#006a61', borderTopWidth: 4 }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Mis clases</p>
          <p className="mt-2 text-[36px] sm:text-[40px] font-extrabold leading-none" style={{ color: activeEnrollments.length > 0 ? '#006a61' : '#bdcaba' }}>
            {activeEnrollments.length}
          </p>
          <Link href="/student/schedule" className="mt-2 block text-[12px] font-bold hover:underline" style={{ color: '#006b2c' }}>
            Ver clases →
          </Link>
        </div>
      </div>

      {/* Próxima clase */}
      {nextClass && (
        <div className="rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: '#bdcaba' }}>
          <div className="px-4 sm:px-5 py-3" style={{ background: '#eff4ff', borderBottom: '1px solid #bdcaba' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Próxima clase</p>
          </div>
          <div className="p-4 sm:p-5" style={{ background: '#ffffff' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: '#e5eeff' }}>
                  <svg className="h-5 w-5" style={{ color: '#006b2c' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[16px] sm:text-[18px] font-bold leading-tight" style={{ color: '#0b1c30' }}>
                    {DAYS[nextClass.nextDate.getDay()]}
                  </p>
                  <p className="text-[13px] mt-0.5" style={{ color: '#6e7b6c' }}>
                    {formatTime((nextClass.schedule as any)?.start_time)} — {formatTime((nextClass.schedule as any)?.end_time)}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: '#6e7b6c' }}>
                    {(nextClass.schedule as any)?.court?.name}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className="inline-block rounded-lg px-3 py-1.5 text-[12px] font-bold"
                  style={isPaidThisMonth(nextClass.paid_until)
                    ? { background: '#e5eeff', color: '#006b2c' }
                    : { background: '#fef2f2', color: '#dc2626' }
                  }
                >
                  {isPaidThisMonth(nextClass.paid_until) ? 'Pagado' : 'Pendiente'}
                </span>
                <p className="mt-1.5 text-[11px]" style={{ color: '#6e7b6c' }}>{formatCurrency(nextClass.monthly_price)}/mes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accesos rápidos */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Acceso rápido</p>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/student/schedule"
            className="rounded-xl border p-4 flex items-center gap-3 transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ background: '#ffffff', borderColor: '#bdcaba' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#e5eeff' }}>
              <svg className="h-4 w-4" style={{ color: '#006b2c' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold" style={{ color: '#0b1c30' }}>Mis Clases</span>
          </Link>
          <Link
            href="/student/bag"
            className="rounded-xl border p-4 flex items-center gap-3 transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ background: '#ffffff', borderColor: '#bdcaba' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#86f2e4' }}>
              <svg className="h-4 w-4" style={{ color: '#006a61' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold" style={{ color: '#0b1c30' }}>Tienda</span>
          </Link>
          <Link
            href="/student/materials"
            className="rounded-xl border p-4 flex items-center gap-3 transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ background: '#ffffff', borderColor: '#bdcaba' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#fef9c3' }}>
              <svg className="h-4 w-4" style={{ color: '#a16207' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold" style={{ color: '#0b1c30' }}>Material</span>
          </Link>
          <Link
            href="/student/chat"
            className="rounded-xl border p-4 flex items-center gap-3 transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ background: '#ffffff', borderColor: '#bdcaba' }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#e5eeff' }}>
              <svg className="h-4 w-4" style={{ color: '#006b2c' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold" style={{ color: '#0b1c30' }}>Chat soporte</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
