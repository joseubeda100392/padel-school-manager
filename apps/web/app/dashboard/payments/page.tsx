export const dynamic = 'force-dynamic'

import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { parseClubFeatures } from '@/lib/get-club-features'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import PaymentsTable from './payments-table'
import { UnpaidList } from './unpaid-list'
import { MonthNavigator } from './month-navigator'
import { DevError } from '@/components/dev-error'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { currentBillingMonth, lastDayOfMonthStr } from '@/lib/billing-cycle'
import { loadMonthPayments } from '@/lib/payments-month'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { CalendarClock, CircleAlert, Printer } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader, SectionTitle } from '@/components/ui/card'
import { EmptyState, Notice } from '@/components/ui/feedback'
import { Stat } from '@/components/ui/list'

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default async function PaymentsPage({ searchParams }: { searchParams: { month?: string } }) {
  const admin = getAdminClient()
  const clubId = await getClubId()

  const { data: clubConfigRow } = clubId
    ? await admin.from('clubs').select('config, features').eq('id', clubId).single()
    : { data: null }
  const features = parseClubFeatures((clubConfigRow as any)?.features)
  if (!features.enable_payments) redirect('/dashboard')

  const TZ = 'Europe/Madrid'
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
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

  const [monthPayments, unpaidResult] = await Promise.all([
    loadMonthPayments(admin, clubId, selectedYear, selectedMonth),
    billingActive
      ? admin.rpc('get_pending_payments', {
          p_club_id: clubId ?? null,
          p_year: selectedYear,
          p_month: selectedMonth + 1,
        })
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  const { data: pendingCharges } = clubId
    ? await admin
        .from('student_charges')
        .select('id, concept, amount_cents, created_at, student:users!student_charges_student_id_fkey(id, name)')
        .eq('club_id', clubId)
        .eq('status', 'pending')
        .order('created_at')
    : { data: [] as any[] }

  const errPayments = monthPayments.error
  const allPayments = monthPayments.payments
  const totalCount = monthPayments.count
  const payments = [...allPayments].sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 200)

  const errUnpaid = (unpaidResult as any).error ?? null
  const total = allPayments.reduce((acc, p: any) => p.status === 'succeeded' ? acc + p.amount : acc, 0)
  const transactionCount = totalCount
  const listIsTruncated = transactionCount > payments.length

  const rawUnpaid: any[] = billingActive ? ((unpaidResult.data as any[]) ?? []) : []
  const pendingAmount = rawUnpaid.reduce((acc, u: any) => acc + (u.monthly_price ?? 0), 0)
  const generatedAmount = total + pendingAmount
  const billingStart = billingStartDate ? new Date(billingStartDate + 'T00:00:00') : null
  // Para cobrar desde aquí hace falta saber desde cuándo paga (primer mes sin paid_until).
  const { data: unpaidStarts } = rawUnpaid.length
    ? await admin.from('group_enrollments').select('id, start_date').in('id', rawUnpaid.map((u: any) => u.id))
    : { data: [] as { id: string; start_date: string | null }[] }
  const startById = new Map((unpaidStarts ?? []).map((e) => [e.id, e.start_date]))
  const unpaid = (billingStart
    ? rawUnpaid.map((item) => {
        const monthsSinceBilling =
          (selectedYear - billingStart.getFullYear()) * 12 +
          (selectedMonth - billingStart.getMonth()) + 1
        return { ...item, months_overdue: Math.min(item.months_overdue, monthsSinceBilling) }
      })
    : rawUnpaid
  ).map((item) => ({ ...item, start_date: startById.get(item.id) ?? null }))

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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MonthNavigator year={selectedYear} month={selectedMonth} basePath="/dashboard/payments" maxYear={defaultBilling.year} maxMonth={defaultBilling.month0} />
            <Link
              href={`/dashboard/payments/imprimir?month=${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`}
              className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}
            >
              <Printer className="h-4 w-4" aria-hidden />
              Listado para imprimir
            </Link>
          </div>
        }
      />

      <Card>
        <CardBody>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4 lg:divide-x lg:divide-line">
            <div className="lg:pr-5">
              <Stat label="Cobrado" value={formatCurrency(total)} className="[&_p:nth-child(2)]:text-accent-ink" />
            </div>
            <div className="lg:px-5">
              <Stat
                label="Pendiente"
                value={formatCurrency(pendingAmount)}
                hint={`${unpaid.length} alumno${unpaid.length !== 1 ? 's' : ''}`}
                className={unpaid.length > 0 ? '[&_p:nth-child(2)]:text-warn-ink' : ''}
              />
            </div>
            <div className="lg:px-5">
              <Stat label="Total del mes" value={formatCurrency(generatedAmount)} hint="Cobrado + pendiente" />
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
          <UnpaidList key={monthLabel} items={unpaid as any[]} monthLabel={monthLabel} monthEnd={lastDayOfMonthStr(selectedYear, selectedMonth)} />
        )}
      </Card>

      {(pendingCharges ?? []).length > 0 && (
        <Card>
          <CardHeader title="Cargos sueltos pendientes" description="Cobros que no son cuota de grupo. Se marcan pagados desde la ficha del alumno." />
          <CardBody>
            <ul className="divide-y divide-line">
              {(pendingCharges ?? []).map((c: any) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/dashboard/students/${c.student?.id}`} className="text-label text-ink hover:underline">{c.student?.name ?? 'Alumno'}</Link>
                  <span className="text-body text-ink-2">{c.concept} · <span className="tabular-nums text-warn-ink">{formatCurrency(c.amount_cents)}</span></span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

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
