import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { Users, CalendarDays, CreditCard, BookOpen } from 'lucide-react'
import { formatCurrency, formatTime } from '@/lib/utils'
import { RealtimeRefresh } from '@/components/realtime-refresh'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default async function DashboardPage() {
  const supabase = createClient()
  const clubId = await getClubId()

  const filter = (q: any) => clubId ? q.eq('club_id', clubId) : q

  const now = new Date()
  const currentMonthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  const [
    { count: totalStudents },
    { count: totalMaterials },
    { data: classesToday },
    { data: pendingCount },
    { data: recentStudents },
    { data: unpaidList },
  ] = await Promise.all([
    filter(supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true)),
    filter(supabase.from('materials').select('id', { count: 'exact', head: true }).eq('is_published', true)),
    supabase.rpc('count_classes_today', { p_club_id: clubId ?? null }),
    supabase.rpc('count_pending_payments', { p_club_id: clubId ?? null }),
    filter(supabase.from('users').select('id,name,email,created_at,avatar_url').eq('role', 'student').eq('is_active', true).order('created_at', { ascending: false }).limit(5)),
    supabase.rpc('get_pending_payments', { p_club_id: clubId ?? null }),
  ])

  const stats = [
    { label: 'Alumnos activos', value: totalStudents ?? 0, icon: Users, color: 'bg-blue-500', border: 'border-l-blue-500' },
    { label: 'Clases hoy', value: (classesToday as number) ?? 0, icon: CalendarDays, color: 'bg-green-500', border: 'border-l-green-500' },
    { label: 'Sin pagar este mes', value: (pendingCount as number) ?? 0, icon: CreditCard, color: 'bg-yellow-500', border: 'border-l-yellow-500' },
    { label: 'Materiales publicados', value: totalMaterials ?? 0, icon: BookOpen, color: 'bg-purple-500', border: 'border-l-purple-500' },
  ]

  return (
    <div className="space-y-8">
      <RealtimeRefresh
        channelName="admin-dashboard"
        subs={[
          { table: 'group_enrollments' },
          { table: 'users' },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
        <p className="text-sm text-gray-500">Resumen de la actividad de tu escuela de pádel</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-xl border-l-4 ${stat.border} bg-white p-5 shadow-sm`}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <div className={`rounded-lg p-2 ${stat.color} bg-opacity-10`}>
                <stat.icon className={`h-4 w-4 ${stat.color.replace('bg-', 'text-')}`} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sin pagar este mes */}
        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="font-semibold text-gray-900">Sin pagar — {currentMonthLabel}</h2>
              <p className="text-xs text-gray-400">{unpaidList?.length ?? 0} mensualidades pendientes</p>
            </div>
            <a href="/dashboard/payments" className="text-xs font-medium text-green-600 hover:underline">
              Ver pagos →
            </a>
          </div>
          {!unpaidList?.length ? (
            <div className="px-6 py-10 text-center">
              <p className="text-2xl">✓</p>
              <p className="mt-1 text-sm font-medium text-green-600">Todo el mundo al día</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {unpaidList.map((e: any) => {
                const dow = e.start_time ? new Date(e.start_time).getDay() : null
                const time = e.start_time
                  ? formatTime(e.start_time)
                  : null
                const initials = (e.student_name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <li key={e.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{e.student_name ?? '—'}</p>
                      {dow !== null && (
                        <p className="text-xs text-gray-400">{DAYS[dow]} {time}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-yellow-600">
                      {formatCurrency(e.monthly_price)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Últimos alumnos */}
        <div className="rounded-xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Últimos alumnos registrados</h2>
          </div>
          {!recentStudents?.length ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-gray-400">Aún no hay alumnos.</p>
              <a href="/dashboard/students/new" className="mt-1 inline-block text-sm font-medium text-green-600 hover:underline">
                Crear el primero
              </a>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentStudents.map((s: any) => {
                const initials = (s.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <li key={s.id} className="flex items-center gap-4 px-6 py-3">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt={s.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{s.name}</p>
                      <p className="truncate text-xs text-gray-400">{s.email}</p>
                    </div>
                    <a href={`/dashboard/students/${s.id}`} className="shrink-0 text-xs font-medium text-green-600 hover:underline">
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
