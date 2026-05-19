import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { Users, CalendarDays, CreditCard, BookOpen } from 'lucide-react'
import { formatCurrency, formatTime } from '@/lib/utils'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { DevError } from '@/components/dev-error'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default async function DashboardPage() {
  const supabase = createClient()
  const admin = getAdminClient()
  const clubId = await getClubId()

  const filter = (q: any) => clubId ? q.eq('club_id', clubId) : q

  const now = new Date()
  const currentMonthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  const [
    { count: totalStudents, error: errStudents },
    { count: totalMaterials },
    { data: classesToday, error: errRpc1 },
    { data: pendingCount, error: errRpc2 },
    { data: recentStudents, error: errRecent },
    { data: unpaidList, error: errRpc3 },
  ] = await Promise.all([
    filter(admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true)),
    filter(admin.from('materials').select('id', { count: 'exact', head: true }).eq('is_published', true)),
    admin.rpc('count_classes_today', { p_club_id: clubId ?? null }),
    admin.rpc('count_pending_payments', { p_club_id: clubId ?? null }),
    filter(admin.from('users').select('id,name,email,created_at,avatar_url').eq('role', 'student').eq('is_active', true).order('created_at', { ascending: false }).limit(5)),
    admin.rpc('get_pending_payments', { p_club_id: clubId ?? null, p_year: now.getFullYear(), p_month: now.getMonth() + 1 }),
  ])

  const stats = [
    {
      label: 'Alumnos activos',
      value: totalStudents ?? 0,
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderTop: 'border-t-blue-500',
      trend: null,
    },
    {
      label: 'Clases hoy',
      value: (classesToday as number) ?? 0,
      icon: CalendarDays,
      iconBg: 'bg-[#006b2c]/10',
      iconColor: 'text-[#006b2c]',
      borderTop: 'border-t-[#006b2c]',
      trend: null,
    },
    {
      label: 'Sin pagar este mes',
      value: (pendingCount as number) ?? 0,
      icon: CreditCard,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderTop: 'border-t-amber-500',
      trend: null,
    },
    {
      label: 'Materiales publicados',
      value: totalMaterials ?? 0,
      icon: BookOpen,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      borderTop: 'border-t-purple-500',
      trend: null,
    },
  ]

  return (
    <div className="space-y-8">
      <DevError errors={[errStudents?.message, errRpc1?.message, errRpc2?.message, errRecent?.message, errRpc3?.message]} />
      <RealtimeRefresh
        channelName="admin-dashboard"
        subs={[
          { table: 'group_enrollments' },
          { table: 'users' },
        ]}
      />

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Panel de Control</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Resumen de la actividad — <span className="font-semibold text-gray-600">{currentMonthLabel}</span></p>
        </div>
        <a
          href="/dashboard/schedule/new"
          className="hidden md:flex items-center gap-2 bg-[#006b2c] hover:bg-[#005320] text-white text-[13px] font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-[#006b2c]/20 transition-all active:scale-95"
        >
          <CalendarDays className="h-4 w-4" />
          Nueva clase
        </a>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm border-t-4 ${stat.borderTop} hover:-translate-y-1 hover:shadow-md transition-all duration-200`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-gray-400">{stat.label}</p>
                <p className="mt-2 text-4xl font-extrabold text-gray-900 tracking-tight">{stat.value}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconBg}`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sin pagar este mes */}
        <div className="rounded-2xl border border-gray-200/60 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Sin pagar — {currentMonthLabel}</h2>
              <p className="text-[12px] text-gray-400 mt-0.5">{unpaidList?.length ?? 0} mensualidades pendientes</p>
            </div>
            <a
              href="/dashboard/payments"
              className="text-[12px] font-bold text-[#006b2c] hover:underline"
            >
              Ver todos →
            </a>
          </div>
          {!unpaidList?.length ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#006b2c]/10">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-[13px] font-semibold text-[#006b2c]">Todo el mundo al día</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {unpaidList.map((e: any) => {
                const dow = e.start_time ? new Date(e.start_time).getDay() : null
                const time = e.start_time ? formatTime(e.start_time) : null
                const initials = (e.student_name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <li key={e.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[11px] font-extrabold text-amber-700">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-gray-900">{e.student_name ?? '—'}</p>
                      {dow !== null && (
                        <p className="text-[11px] text-gray-400">{DAYS[dow]} {time}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1 text-[12px] font-bold text-red-600">
                      {formatCurrency(e.monthly_price)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Últimos alumnos */}
        <div className="rounded-2xl border border-gray-200/60 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Últimos alumnos registrados</h2>
              <p className="text-[12px] text-gray-400 mt-0.5">{recentStudents?.length ?? 0} más recientes</p>
            </div>
            <a href="/dashboard/students" className="text-[12px] font-bold text-[#006b2c] hover:underline">
              Ver todos →
            </a>
          </div>
          {!recentStudents?.length ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] text-gray-400">Aún no hay alumnos.</p>
              <a href="/dashboard/students/new" className="mt-1 inline-block text-[13px] font-bold text-[#006b2c] hover:underline">
                Crear el primero
              </a>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentStudents.map((s: any) => {
                const initials = (s.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                const colors = ['bg-blue-50 text-blue-700', 'bg-purple-50 text-purple-700', 'bg-[#006b2c]/10 text-[#006b2c]', 'bg-amber-50 text-amber-700']
                const colorIdx = s.name ? s.name.charCodeAt(0) % colors.length : 0
                return (
                  <li key={s.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/50 transition-colors">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt={s.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold ${colors[colorIdx]}`}>
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-gray-900">{s.name}</p>
                      <p className="truncate text-[11px] text-gray-400">{s.email}</p>
                    </div>
                    <a href={`/dashboard/students/${s.id}`} className="shrink-0 text-[12px] font-bold text-[#006b2c] hover:underline">
                      Ver →
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
