export const dynamic = 'force-dynamic'

import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import PaymentsTable from './payments-table'
import { UnpaidList } from './unpaid-list'
import { MonthNavigator } from './month-navigator'
import { DevError } from '@/components/dev-error'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { currentBillingMonth, lastDayOfMonthStr } from '@/lib/billing-cycle'
import { CalendarClock, CircleAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, SectionTitle } from '@/components/ui/card'
import { EmptyState, Notice } from '@/components/ui/feedback'
import { Stat } from '@/components/ui/list'

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default async function PaymentsPage({ searchParams }: { searchParams: { month?: string } }) {
  const admin = getAdminClient()
  const clubId = await getClubId()

  const features = await getClubFeatures(clubId ?? undefined)
  if (!features.enable_payments) redirect('/dashboard')

  const TZ = 'Europe/Madrid'
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const { data: clubConfigRow } = clubId
    ? await admin.from('clubs').select('config').eq('id', clubId).single()
    : { data: null }
  const billingStartDate: string | null = (clubConfigRow as any)?.config?.billing_start_date ?? null
  const billingActive = !billingStartDate || todaySpain >= billingStartDate

  // Por defecto (sin ?month=) no abrir en el mes de calendario real, sino en
  // el mes que ya toca facturar — a menos de 5 días de fin de mes, el mes de
  // calendario actual deja de ser relevante para cobros (ver
  // currentBillingMonth en lib/billing-cycle.ts).
  const defaultBilling = currentBillingMonth()
  const parsedDate = searchParams.month ? new Date(searchParams.month + '-01') : null
  const selectedDate = parsedDate && !isNaN(parsedDate.getTime())
    ? parsedDate
    : new Date(defaultBilling.year, defaultBilling.month0, 1)
  const selectedYear = selectedDate.getFullYear()
  const selectedMonth = selectedDate.getMonth()
  const monthLabel = `${MONTHS[selectedMonth]} ${selectedYear}`

  const startOfMonth = new Date(selectedYear, selectedMonth, 1).toISOString()
  const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).toISOString()
  // Cuota mensual: se contabiliza en el mes que CUBRE (metadata.paid_until),
  // no en el mes en que se pagó — con adelantos, o un pago normal hecho en
  // los últimos días de mes que ya salta al siguiente, pagar en junio la
  // cuota de julio no debe inflar junio ni vaciar julio en el panel. Pagos
  // antiguos sin ese campo (antes de este cambio) caen al criterio de
  // siempre (created_at) como respaldo.
  const targetPaidUntil = lastDayOfMonthStr(selectedYear, selectedMonth)

  function withClub<T extends { eq: (col: string, val: string) => T }>(query: T): T {
    return clubId ? query.eq('club_id', clubId) : query
  }

  const cuotaByCoverageQuery = withClub(
    admin.from('payments').select('*, user:users(name, email)', { count: 'exact' })
      .eq('type', 'fixed_group_month')
      .eq('metadata->>paid_until', targetPaidUntil)
  )
  const cuotaLegacyQuery = withClub(
    admin.from('payments').select('*, user:users(name, email)', { count: 'exact' })
      .eq('type', 'fixed_group_month')
      .is('metadata->paid_until', null)
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth)
  )
  const otherTypesQuery = withClub(
    admin.from('payments').select('*, user:users(name, email)', { count: 'exact' })
      .neq('type', 'fixed_group_month')
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth)
  )

  const [cuotaByCoverageRes, cuotaLegacyRes, otherTypesRes, unpaidResult] = await Promise.all([
    cuotaByCoverageQuery,
    cuotaLegacyQuery,
    otherTypesQuery,
    billingActive
      ? admin.rpc('get_pending_payments', {
          p_club_id: clubId ?? null,
          p_year: selectedYear,
          p_month: selectedMonth + 1,
        })
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  const errPayments = cuotaByCoverageRes.error ?? cuotaLegacyRes.error ?? otherTypesRes.error
  const allPayments = [
    ...(cuotaByCoverageRes.data ?? []),
    ...(cuotaLegacyRes.data ?? []),
    ...(otherTypesRes.data ?? []),
  ]
  const totalCount = (cuotaByCoverageRes.count ?? 0) + (cuotaLegacyRes.count ?? 0) + (otherTypesRes.count ?? 0)
  const payments = [...allPayments].sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 200)

  const errUnpaid = (unpaidResult as any).error ?? null
  const total = allPayments.reduce((acc, p: any) => p.status === 'succeeded' ? acc + p.amount : acc, 0)
  const transactionCount = totalCount
  const listIsTruncated = transactionCount > payments.length

  const rawUnpaid: any[] = billingActive ? ((unpaidResult.data as any[]) ?? []) : []
  const pendingAmount = rawUnpaid.reduce((acc, u: any) => acc + (u.monthly_price ?? 0), 0)
  const generatedAmount = total + pendingAmount
  const billingStart = billingStartDate ? new Date(billingStartDate + 'T00:00:00') : null
  const unpaid = billingStart
    ? rawUnpaid.map((item) => {
        const monthsSinceBilling =
          (selectedYear - billingStart.getFullYear()) * 12 +
          (selectedMonth - billingStart.getMonth()) + 1
        return { ...item, months_overdue: Math.min(item.months_overdue, monthsSinceBilling) }
      })
    : rawUnpaid

  return (
    <div className="space-y-6">
      <DevError errors={[errPayments?.message, errUnpaid?.message]} />
      <RealtimeRefresh
        channelName="admin-payments"
        subs={clubId ? [
          { table: 'payments', filter: `club_id=eq.${clubId}` },
          { table: 'group_enrollments', filter: `club_id=eq.${clubId}` },
        ] : [
          { table: 'payments' },
          { table: 'group_enrollments' },
        ]}
      />
      <PageHeader
        title="Pagos"
        description={`${transactionCount} transacciones en ${monthLabel}`}
        actions={<MonthNavigator year={selectedYear} month={selectedMonth} basePath="/dashboard/payments" maxYear={defaultBilling.year} maxMonth={defaultBilling.month0} />}
      />

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-line">
            <div className="lg:pr-5">
              <Stat label={`Total cobrado en ${monthLabel}`} value={formatCurrency(total)} className="[&_p:nth-child(2)]:text-accent-ink" />
            </div>
            <div className="lg:px-5">
              <Stat
                label="Pendiente de cobro"
                value={formatCurrency(pendingAmount)}
                hint={`${unpaid.length} alumno${unpaid.length !== 1 ? 's' : ''}`}
                className={unpaid.length > 0 ? '[&_p:nth-child(2)]:text-warn-ink' : ''}
              />
            </div>
            <div className="lg:px-5">
              <Stat label={`Total generado en ${monthLabel}`} value={formatCurrency(generatedAmount)} hint="Cobrado + pendiente" />
            </div>
            <div className="lg:pl-5">
              <Stat label="Transacciones" value={transactionCount} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={`Mensualidades pendientes de ${monthLabel}`}
          description={`${unpaid.length} alumnos sin regularizar`}
        />
        {!billingActive ? (
          <EmptyState
            icon={<CalendarClock />}
            title="El seguimiento aún no ha empezado"
            description={`El seguimiento de mensualidades empieza el ${new Date(billingStartDate! + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
          />
        ) : (
          <UnpaidList key={monthLabel} items={unpaid as any[]} monthLabel={monthLabel} />
        )}
      </Card>

      <section className="space-y-4">
        <SectionTitle>Transacciones de {monthLabel}</SectionTitle>
        {listIsTruncated && (
          <Notice tone="warn" icon={<CircleAlert />}>
            Mostrando las {payments?.length ?? 0} más recientes de {transactionCount}. Los totales de arriba sí cuentan todas.
          </Notice>
        )}
        <PaymentsTable payments={payments ?? []} />
      </section>
    </div>
  )
}
