export const dynamic = 'force-dynamic'

import { getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import { parseClubFeatures } from '@/lib/get-club-features'
import { currentBillingMonth, lastDayOfMonthStr } from '@/lib/billing-cycle'
import { loadPendingFees } from '@/lib/pending-fees'
import { PAYMENT_METHODS } from '@/lib/payment-method'
import { formatCurrency } from '@/lib/utils'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Stat } from '@/components/ui/list'
import { UnpaidList } from '@/app/dashboard/payments/unpaid-list'
import { MonthNavigator } from '@/app/dashboard/payments/month-navigator'
import { DepositList } from './deposit-list'
import { StudentSearch } from './student-search'
import { TicketLink } from '@/components/ticket-link'
import { isPlaceholderEmail } from '@/lib/login-identifier'

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const TZ = 'Europe/Madrid'

// Caja del cobrador: mensualidades por cobrar, fianzas y lo que ha cobrado él
// hoy. Sin cifras del club ni cobros de otros.
export default async function CajaPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const admin = getAdminClient()
  const { data: me } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const clubId = me?.club_id as string | null
  if (!clubId) return null

  const { data: club } = await admin.from('clubs').select('config, features').eq('id', clubId).single()
  const features = parseClubFeatures(club?.features)
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const billingStartDate: string | null = (club as any)?.config?.billing_start_date ?? null

  const defaultBilling = currentBillingMonth()
  const parsed = searchParams.month ? new Date(searchParams.month + '-01') : null
  const selected = parsed && !isNaN(parsed.getTime()) ? parsed : new Date(defaultBilling.year, defaultBilling.month0, 1)
  const year = selected.getFullYear()
  const month0 = selected.getMonth()
  const monthLabel = `${MONTHS[month0]} ${year}`

  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString()
  const [pending, { data: recent }, { data: students }, { data: allStudents }] = await Promise.all([
    features.enable_payments
      ? loadPendingFees(admin, clubId, year, month0, billingStartDate, todaySpain)
      : Promise.resolve({ items: [], error: null, billingActive: false }),
    admin
      .from('payments')
      .select('id, amount, created_at, metadata, user:users(name)')
      .eq('club_id', clubId)
      .eq('status', 'succeeded')
      .eq('metadata->>collected_by', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    features.enable_deposit
      ? admin
          .from('users')
          .select('id, name, email, deposit_paid')
          .eq('club_id', clubId)
          .eq('is_active', true)
          .or('role.eq.student,also_student.eq.true')
          .order('name')
      : Promise.resolve({ data: [] as any[] }),
    admin
      .from('users')
      .select('id, name, email, phone')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .or('role.eq.student,also_student.eq.true')
      .order('name'),
  ])

  // «Hoy» en hora de Madrid.
  const today = (recent ?? []).filter((p: any) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(p.created_at)) === todaySpain)
  const sumBy = (method: string) => today.filter((p: any) => (p.metadata?.method ?? 'cash') === method).reduce((a: number, p: any) => a + p.amount, 0)

  return (
    <div className="space-y-6">
      <RealtimeRefresh
        channelName="cashier-caja"
        subs={[
          { table: 'group_enrollments', filter: `club_id=eq.${clubId}` },
          { table: 'payments', filter: `club_id=eq.${clubId}` },
        ]}
      />
      <PageHeader
        title="Caja"
        description="Cobra las mensualidades en efectivo o con datáfono y marca las fianzas."
        actions={features.enable_payments ? (
          <MonthNavigator year={year} month={month0} basePath="/caja" maxYear={defaultBilling.year} maxMonth={defaultBilling.month0} />
        ) : undefined}
      />

      <Card>
        <CardHeader title="Lo que has cobrado hoy" description="Para cuadrar la caja al cerrar." />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Efectivo" value={formatCurrency(sumBy('cash'))} />
            <Stat label="Datáfono" value={formatCurrency(sumBy('card_terminal'))} />
            <Stat label="Cobros" value={today.length} />
          </div>
          {today.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {today.map((p: any) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate text-body text-ink">{p.user?.name ?? 'Alumno'}</span>
                  <span className="text-meta tabular-nums text-ink-2">
                    {new Date(p.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TZ })}
                    {' · '}{PAYMENT_METHODS[(p.metadata?.method ?? 'cash') as keyof typeof PAYMENT_METHODS]?.label ?? 'Efectivo'}
                    {' · '}<span className="font-medium text-ink">{formatCurrency(p.amount)}</span>
                  </span>
                  <TicketLink payment={{ id: p.id, status: 'succeeded' }} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Buscar alumno" description="Sus cuotas, su fianza y lo que ha pagado." />
        <StudentSearch students={(allStudents ?? []).map((s: any) => ({ id: s.id, name: s.name, email: isPlaceholderEmail(s.email) ? null : s.email, phone: s.phone ?? null }))} />
      </Card>

      {features.enable_payments && (
        <Card className="overflow-hidden">
          <CardHeader title={`Mensualidades por cobrar de ${monthLabel}`} description="Busca al alumno y pulsa Cobrar." />
          {!pending.billingActive ? (
            <EmptyState
              icon={<CalendarClock />}
              title="El seguimiento aún no ha empezado"
              description="El club todavía no ha empezado a controlar las mensualidades."
            />
          ) : (
            <UnpaidList key={monthLabel} items={pending.items as any[]} monthLabel={monthLabel} monthEnd={lastDayOfMonthStr(year, month0)} canEditPrice={false} />
          )}
        </Card>
      )}

      {features.enable_deposit && (
        <Card className="overflow-hidden">
          <CardHeader title="Fianzas" description="Marca quién ha pagado la fianza." />
          <DepositList students={(students ?? []).map((s: any) => ({ id: s.id, name: s.name, email: s.email, paid: s.deposit_paid === true }))} />
        </Card>
      )}
    </div>
  )
}
