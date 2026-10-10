import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { Users, CalendarDays, CreditCard, BookOpen, CircleCheck } from 'lucide-react'
import { formatCurrency, formatTime } from '@/lib/utils'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { DevError } from '@/components/dev-error'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { LevelTag } from '@/components/ui/badge'
import { List, ListRow, Avatar } from '@/components/ui/list'
import { EmptyState } from '@/components/ui/feedback'
import { PageHeader } from '@/components/ui/page-header'
import { formatLongDate } from '@/lib/format-date'

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
  const todayLabel = formatLongDate(now)

  // Fetch club config first to gate billing RPCs
  const { data: club } = clubId
    ? await admin.from('clubs').select('name, config').eq('id', clubId).single()
    : { data: null }

  const TZ = 'Europe/Madrid'
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const billingStartDate: string | null = (club as any)?.config?.billing_start_date ?? null
  const billingActive = !billingStartDate || todaySpain >= billingStartDate

  const [
    { count: totalStudents, error: errStudents },
    { count: totalMaterials },
    { data: classesToday, error: errRpc1 },
    pendingCountResult,
    { data: recentStudents, error: errRecent },
    unpaidListResult,
    features,
    { data: payments },
    { data: levelsRaw },
    { data: bagStats },
    { data: studentsRaw },
    { count: totalCoaches },
  ] = await Promise.all([
    filter(admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true)),
    filter(admin.from('materials').select('id', { count: 'exact', head: true }).eq('is_published', true)),
    admin.rpc('count_classes_today', { p_club_id: clubId ?? null }),
    billingActive
      ? admin.rpc('count_pending_payments', { p_club_id: clubId ?? null, p_year: now.getFullYear(), p_month: now.getMonth() + 1 })
      : Promise.resolve({ data: 0, error: null }),
    filter(admin.from('users').select('id,name,email,created_at,avatar_url').eq('role', 'student').eq('is_active', true).order('created_at', { ascending: false }).limit(5)),
    billingActive
      ? admin.rpc('get_pending_payments', { p_club_id: clubId ?? null, p_year: now.getFullYear(), p_month: now.getMonth() + 1 })
      : Promise.resolve({ data: [] as any[], error: null }),
    getClubFeatures(clubId ?? undefined),
    filter(admin.from('payments').select('amount, type').eq('status', 'succeeded')),
    filter(admin.from('levels').select('id, name, color').order('order')),
    filter(admin.from('class_bag').select('balance_60, balance_90')),
    filter(admin.from('users').select('current_level_id').eq('role', 'student').eq('is_active', true)),
    filter(admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'coach').eq('is_active', true)),
  ])

  const pendingCount = billingActive ? (((pendingCountResult as any).data as number) ?? 0) : 0
  const errRpc2 = (pendingCountResult as any).error
  const unpaidList: any[] = billingActive ? (((unpaidListResult as any).data as any[]) ?? []) : []
  const errRpc3 = (unpaidListResult as any).error

  const totalRevenue = payments?.reduce((acc: number, p: any) => acc + p.amount, 0) ?? 0
  const revenueByType = (payments ?? []).reduce((acc: Record<string, number>, p: any) => {
    acc[p.type] = (acc[p.type] ?? 0) + p.amount
    return acc
  }, {} as Record<string, number>)

  const totalBagClasses = bagStats?.reduce((acc: number, b: any) => acc + (b.balance_60 ?? 0) + (b.balance_90 ?? 0), 0) ?? 0

  const levelCountMap: Record<string, number> = {}
  for (const s of studentsRaw ?? []) {
    if (s.current_level_id) levelCountMap[s.current_level_id] = (levelCountMap[s.current_level_id] ?? 0) + 1
  }
  const levels = (levelsRaw ?? []).map((l: any) => ({ ...l, studentCount: levelCountMap[l.id] ?? 0 }))

  const stats = [
    { label: 'Alumnos activos', value: totalStudents ?? 0, icon: Users, href: '/dashboard/students?tab=student', warn: false },
    { label: 'Clases hoy', value: (classesToday as number) ?? 0, icon: CalendarDays, href: '/dashboard/schedule', warn: false },
    { label: 'Monitores', value: totalCoaches ?? 0, icon: Users, href: '/dashboard/students?tab=coach', warn: false },
    { label: 'Clases en bolsa', value: totalBagClasses, icon: BookOpen, href: null, warn: false },
    ...(features.enable_payments && billingActive ? [{ label: 'Sin pagar este mes', value: pendingCount, icon: CreditCard, href: '/dashboard/payments', warn: pendingCount > 0 }] : []),
    ...(features.enable_materials ? [{ label: 'Materias publicadas', value: totalMaterials ?? 0, icon: BookOpen, href: '/dashboard/materials', warn: false }] : []),
  ]

  return (
    <div className="space-y-6">
      <DevError errors={[errStudents?.message, errRpc1?.message, errRpc2?.message, errRecent?.message, errRpc3?.message]} />
      <RealtimeRefresh
        channelName="admin-dashboard"
        subs={clubId ? [
          { table: 'group_enrollments', filter: `club_id=eq.${clubId}` },
          { table: 'users', filter: `club_id=eq.${clubId}` },
          { table: 'payments', filter: `club_id=eq.${clubId}` },
        ] : [{ table: 'group_enrollments' }, { table: 'users' }, { table: 'payments' }]}
      />

      <PageHeader title={club?.name ?? 'Panel de control'} description={todayLabel} />

      <Card className="overflow-hidden">
        <div className="-mb-px -mr-px grid grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => {
            const inner = (
              <>
                <div className="flex items-center gap-2 text-meta text-ink-3">
                  <stat.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className={stat.href ? 'group-hover:text-ink' : undefined}>{stat.label}</span>
                </div>
                <p className={`mt-2 font-display text-title tabular-nums sm:text-display ${stat.warn ? 'text-warn-ink' : 'text-ink'}`}>
                  {stat.value}
                </p>
              </>
            )
            const cellClass = 'block border-b border-r border-line p-4 sm:p-5'
            return stat.href ? (
              <Link key={stat.label} href={stat.href} className={`group ${cellClass} transition-colors hover:bg-ink/[0.03]`}>
                {inner}
              </Link>
            ) : (
              <div key={stat.label} className={cellClass}>
                {inner}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {features.enable_payments && (
          <Card>
            <CardHeader
              title={`Sin pagar en ${currentMonthLabel}`}
              description={`${unpaidList.length} mensualidades pendientes`}
              action={<Link href="/dashboard/payments" className={buttonVariants({ variant: 'link', size: 'sm' })}>Ver todos</Link>}
            />
            {!billingActive ? (
              <p className="px-5 py-8 text-center text-body text-ink-3">
                El seguimiento de mensualidades empieza el{' '}
                <strong className="text-ink-2">{formatLongDate(billingStartDate!, { weekday: false })}</strong>.
              </p>
            ) : !unpaidList.length ? (
              <EmptyState icon={<CircleCheck />} title="Todo el mundo al día" />
            ) : (
              <List className="mt-3 border-t border-line">
                {unpaidList.slice(0, 6).map((e: any) => {
                  const dow = e.start_time ? new Date(e.start_time).getDay() : null
                  return (
                    <ListRow
                      key={e.id}
                      leading={<Avatar name={e.student_name ?? '?'} />}
                      title={e.student_name ?? '—'}
                      subtitle={dow !== null ? `${DAYS[dow]} ${formatTime(e.start_time)}` : undefined}
                      trailing={<span className="text-label tabular-nums text-warn-ink">{formatCurrency(e.monthly_price)}</span>}
                    />
                  )
                })}
              </List>
            )}
          </Card>
        )}

        <Card>
          <CardHeader
            title="Últimos alumnos"
            action={<Link href="/dashboard/students/new" className={buttonVariants({ variant: 'link', size: 'sm' })}>Nuevo alumno</Link>}
          />
          {!recentStudents?.length ? (
            <EmptyState
              title="Aún no hay alumnos"
              description="Crea el primero para empezar a apuntarlo a clases."
              action={<Link href="/dashboard/students/new" className={buttonVariants({ variant: 'secondary' })}>Crear alumno</Link>}
            />
          ) : (
            <List className="mt-3 border-t border-line">
              {recentStudents.map((s: any) => (
                <ListRow
                  key={s.id}
                  href={`/dashboard/students/${s.id}`}
                  leading={
                    s.avatar_url ? (
                      <Image src={s.avatar_url} alt={s.name} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <Avatar name={s.name ?? '?'} />
                    )
                  }
                  title={s.name}
                  subtitle={<span className="block truncate">{s.email}</span>}
                />
              ))}
            </List>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader
            title="Alumnos por nivel"
            action={<Link href="/dashboard/levels" className={buttonVariants({ variant: 'link', size: 'sm' })}>Gestionar</Link>}
          />
          <CardBody>
            {levels.length === 0 ? (
              <p className="text-body text-ink-3">No hay niveles creados.</p>
            ) : (
              <div className="space-y-3">
                {levels.map((level: any) => {
                  const max = Math.max(...levels.map((l: any) => l.studentCount), 1)
                  const pct = Math.round((level.studentCount / max) * 100)
                  return (
                    <div key={level.id}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-body">
                        <LevelTag name={level.name} color={level.color} />
                        <span className="text-label tabular-nums text-ink">{level.studentCount} alumnos</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: level.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Ingresos por tipo"
            action={<Link href="/dashboard/payments" className={buttonVariants({ variant: 'link', size: 'sm' })}>Ver pagos</Link>}
          />
          <CardBody>
            {Object.keys(revenueByType).length === 0 ? (
              <p className="text-body text-ink-3">Sin datos de pagos aún.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(revenueByType).map(([type, amount]) => {
                  const amt = amount as number
                  const pct = totalRevenue > 0 ? Math.round((amt / totalRevenue) * 100) : 0
                  return (
                    <div key={type}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-body">
                        <span className="text-ink-2">{typeLabel[type] ?? type}</span>
                        <span className="text-label tabular-nums text-ink">{formatCurrency(amt)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
                        <div className="h-full rounded-full bg-accent-ink" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-body">
                  <span className="text-label text-ink-2">Total</span>
                  <span className="font-display text-heading tabular-nums text-ink">{formatCurrency(totalRevenue)}</span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
