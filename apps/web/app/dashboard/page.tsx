import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { Users, CalendarDays, CreditCard, BookOpen, Trophy, AlertTriangle, PackageX, UserX } from 'lucide-react'
import { formatCurrency, formatTime } from '@/lib/utils'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { DevError } from '@/components/dev-error'
import { AnimatedStatsGrid } from '@/components/ui/animated-stats'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

const typeLabel: Record<string, string> = {
  fixed_group_month: 'Mensualidad grupo fijo',
  single_class:      'Clase suelta',
  class_pack:        'Bono de clases',
  tournament:        'Inscripción torneo',
  intensivo_group:   'Semana intensiva',
  manual:            'Manual',
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  const admin = getAdminClient()
  const clubId = await getClubId()

  const filter = (q: any) => clubId ? q.eq('club_id', clubId) : q

  const now = new Date()
  const currentMonthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  const todayLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const [
    { count: totalStudents, error: errStudents },
    { count: totalMaterials },
    { data: classesToday, error: errRpc1 },
    { data: pendingCount, error: errRpc2 },
    { data: recentStudents, error: errRecent },
    { data: unpaidList, error: errRpc3 },
    features,
    { data: payments },
    { data: levelsRaw },
    { data: bagStats },
    { data: studentsRaw },
    { count: totalCoaches },
    { data: club },
  ] = await Promise.all([
    filter(admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true)),
    filter(admin.from('materials').select('id', { count: 'exact', head: true }).eq('is_published', true)),
    admin.rpc('count_classes_today', { p_club_id: clubId ?? null }),
    admin.rpc('count_pending_payments', { p_club_id: clubId ?? null, p_year: now.getFullYear(), p_month: now.getMonth() + 1 }),
    filter(admin.from('users').select('id,name,email,created_at,avatar_url').eq('role', 'student').eq('is_active', true).order('created_at', { ascending: false }).limit(5)),
    admin.rpc('get_pending_payments', { p_club_id: clubId ?? null, p_year: now.getFullYear(), p_month: now.getMonth() + 1 }),
    getClubFeatures(clubId ?? undefined),
    filter(admin.from('payments').select('amount, type').eq('status', 'succeeded')),
    filter(admin.from('levels').select('id, name, color').order('order')),
    filter(admin.from('class_bag').select('balance_60, balance_90')),
    filter(admin.from('users').select('current_level_id').eq('role', 'student').eq('is_active', true)),
    filter(admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'coach').eq('is_active', true)),
    clubId ? admin.from('clubs').select('name').eq('id', clubId).single() : Promise.resolve({ data: null }),
  ])

  const totalRevenue = payments?.reduce((acc: number, p: any) => acc + p.amount, 0) ?? 0
  const revenueByType = (payments ?? []).reduce((acc: Record<string, number>, p: any) => {
    acc[p.type] = (acc[p.type] ?? 0) + p.amount
    return acc
  }, {} as Record<string, number>)

  const totalBagClasses = bagStats?.reduce((acc: number, b: any) => acc + (b.balance_60 ?? 0) + (b.balance_90 ?? 0), 0) ?? 0

  // Alertas — info que normalmente requiere varios clics encontrar
  const emptyBagCount = bagStats?.filter((b: any) => (b.balance_60 ?? 0) + (b.balance_90 ?? 0) === 0).length ?? 0
  const lowBagCount = bagStats?.filter((b: any) => (b.balance_60 ?? 0) + (b.balance_90 ?? 0) === 1).length ?? 0
  const noLevelCount = studentsRaw?.filter((s: any) => !s.current_level_id).length ?? 0

  const levelCountMap: Record<string, number> = {}
  for (const s of studentsRaw ?? []) {
    if (s.current_level_id) levelCountMap[s.current_level_id] = (levelCountMap[s.current_level_id] ?? 0) + 1
  }
  const levels = (levelsRaw ?? []).map((l: any) => ({ ...l, studentCount: levelCountMap[l.id] ?? 0 }))

  const stats = [
    { label: 'Alumnos activos', value: totalStudents ?? 0, icon: Users, color: 'bg-blue-500', text: 'text-blue-500', href: '/dashboard/students?tab=student' },
    { label: 'Clases hoy', value: (classesToday as number) ?? 0, icon: CalendarDays, color: 'bg-brand-500', text: 'text-brand-500', href: '/dashboard/schedule' },
    { label: 'Monitores', value: totalCoaches ?? 0, icon: Users, color: 'bg-green-500', text: 'text-green-500', href: '/dashboard/students?tab=coach' },
    { label: 'Clases en bolsa', value: totalBagClasses, icon: BookOpen, color: 'bg-indigo-500', text: 'text-indigo-500', href: null },
    ...(features.enable_payments ? [{ label: 'Sin pagar este mes', value: (pendingCount as number) ?? 0, icon: CreditCard, color: 'bg-yellow-500', text: 'text-yellow-500', href: '/dashboard/payments' }] : []),
    ...(features.enable_materials ? [{ label: 'Materiales publicados', value: totalMaterials ?? 0, icon: BookOpen, color: 'bg-purple-500', text: 'text-purple-500', href: '/dashboard/materials' }] : []),
  ]

  const alerts = [
    {
      show: emptyBagCount > 0,
      icon: PackageX,
      label: `${emptyBagCount} ${emptyBagCount === 1 ? 'alumno' : 'alumnos'} con bolsa vacía`,
      desc: 'No pueden asistir a clase',
      href: '/dashboard/students',
      severity: 'red',
    },
    {
      show: lowBagCount > 0,
      icon: AlertTriangle,
      label: `${lowBagCount} ${lowBagCount === 1 ? 'alumno' : 'alumnos'} con solo 1 clase`,
      desc: 'Bolsa a punto de agotarse',
      href: '/dashboard/students',
      severity: 'yellow',
    },
    {
      show: noLevelCount > 0,
      icon: UserX,
      label: `${noLevelCount} ${noLevelCount === 1 ? 'alumno sin nivel' : 'alumnos sin nivel'}`,
      desc: 'Perfil incompleto',
      href: '/dashboard/students',
      severity: 'blue',
    },
  ].filter(a => a.show)

  const severityStyles: Record<string, { bg: string; icon: string; border: string }> = {
    red:    { bg: 'bg-red-50',    icon: 'text-red-500',    border: 'border-red-100' },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-500', border: 'border-yellow-100' },
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   border: 'border-blue-100' },
  }

  return (
    <div className="space-y-8">
      <DevError errors={[errStudents?.message, errRpc1?.message, errRpc2?.message, errRecent?.message, errRpc3?.message]} />
      <RealtimeRefresh
        channelName="admin-dashboard"
        subs={[{ table: 'group_enrollments' }, { table: 'users' }, { table: 'payments' }]}
      />

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">{club?.name ?? 'Panel de Control'}</h1>
        <p className="mt-1 text-sm capitalize text-gray-400">{todayLabel}</p>
      </div>

      {/* Stats — toda la info clave arriba */}
      <AnimatedStatsGrid>
        {stats.map((stat) => {
          const inner = (
            <>
              <div className={`inline-flex rounded-xl p-2.5 ${stat.color} bg-opacity-10`}>
                <stat.icon className={`h-5 w-5 ${stat.text}`} />
              </div>
              <p className="mt-4 font-display text-3xl font-bold text-gray-900">{stat.value}</p>
              <p className={`mt-1 text-sm text-gray-500 ${stat.href ? 'group-hover:text-brand-500 transition-colors' : ''}`}>{stat.label}</p>
            </>
          )
          return stat.href ? (
            <a key={stat.label} href={stat.href} className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 h-full block hover:ring-2 hover:ring-brand-200 transition-all">
              {inner}
            </a>
          ) : (
            <div key={stat.label} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 h-full">
              {inner}
            </div>
          )
        })}
      </AnimatedStatsGrid>

      {/* Alertas que necesitan atención */}
      {alerts.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Requieren atención</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert) => {
              const s = severityStyles[alert.severity]
              return (
                <a key={alert.label} href={alert.href} className={`flex items-center gap-4 rounded-xl border ${s.border} ${s.bg} px-5 py-4 hover:shadow-sm transition-all`}>
                  <alert.icon className={`h-5 w-5 shrink-0 ${s.icon}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{alert.label}</p>
                    <p className="text-xs text-gray-500">{alert.desc}</p>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* Sin pagar + Últimos alumnos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {features.enable_payments && (
          <div className="rounded-xl bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="font-semibold text-gray-900">Sin pagar — {currentMonthLabel}</h2>
                <p className="text-xs text-gray-400">{unpaidList?.length ?? 0} mensualidades pendientes</p>
              </div>
              <a href="/dashboard/payments" className="text-xs font-medium text-brand-500 hover:underline">Ver todos →</a>
            </div>
            {!unpaidList?.length ? (
              <div className="px-6 py-10 text-center">
                <p className="text-2xl">✓</p>
                <p className="mt-1 text-sm font-medium text-brand-500">Todo el mundo al día</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {unpaidList.slice(0, 6).map((e: any) => {
                  const dow = e.start_time ? new Date(e.start_time).getDay() : null
                  const initials = (e.student_name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <li key={e.id} className="flex items-center gap-4 px-6 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{e.student_name ?? '—'}</p>
                        {dow !== null && <p className="text-xs text-gray-400">{DAYS[dow]} {formatTime(e.start_time)}</p>}
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-yellow-600">{formatCurrency(e.monthly_price)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Últimos alumnos</h2>
            <a href="/dashboard/students/new" className="text-xs font-medium text-brand-500 hover:underline">+ Nuevo →</a>
          </div>
          {!recentStudents?.length ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-gray-400">Aún no hay alumnos.</p>
              <a href="/dashboard/students/new" className="mt-1 inline-block text-sm font-medium text-brand-500 hover:underline">Crear el primero</a>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentStudents.map((s: any) => {
                const initials = (s.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <li key={s.id} className="flex items-center gap-4 px-6 py-3">
                    {s.avatar_url ? (
                      <Image src={s.avatar_url} alt={s.name} width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{s.name}</p>
                      <p className="truncate text-xs text-gray-400">{s.email}</p>
                    </div>
                    <a href={`/dashboard/students/${s.id}`} className="shrink-0 text-xs font-medium text-brand-500 hover:underline">Ver →</a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Niveles + Ingresos */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Alumnos por nivel</h2>
            <a href="/dashboard/levels" className="text-xs font-medium text-brand-500 hover:underline">Gestionar →</a>
          </div>
          {levels.length === 0 ? (
            <p className="text-sm text-gray-400">No hay niveles creados.</p>
          ) : (
            <div className="space-y-3">
              {levels.map((level: any) => {
                const max = Math.max(...levels.map((l: any) => l.studentCount), 1)
                const pct = Math.round((level.studentCount / max) * 100)
                return (
                  <div key={level.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: level.color }} />
                        <span className="text-gray-700">{level.name}</span>
                      </span>
                      <span className="font-medium text-gray-900">{level.studentCount} alumnos</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: level.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Ingresos por tipo</h2>
            <a href="/dashboard/payments" className="text-xs font-medium text-brand-500 hover:underline">Ver pagos →</a>
          </div>
          {Object.keys(revenueByType).length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos de pagos aún.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(revenueByType).map(([type, amount]) => {
                const amt = amount as number
                const pct = totalRevenue > 0 ? Math.round((amt / totalRevenue) * 100) : 0
                return (
                  <div key={type}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-gray-700">{typeLabel[type] ?? type}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(amt)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              <div className="mt-3 border-t border-gray-100 pt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="font-bold text-brand-500">{formatCurrency(totalRevenue)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
