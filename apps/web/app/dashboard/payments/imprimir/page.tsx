export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { parseClubFeatures } from '@/lib/get-club-features'
import { currentBillingMonth } from '@/lib/billing-cycle'
import { loadMonthPayments, isPaidPayment, PAYMENT_TYPE_LABELS } from '@/lib/payments-month'
import { PAYMENT_METHODS, paymentMethodKey, type PaymentMethodKey } from '@/lib/payment-method'
import { formatCurrency, formatTime, getDayOfWeek } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PrintButton } from './print-button'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const METHOD_ORDER: PaymentMethodKey[] = ['cash', 'card_terminal', 'online', 'unknown']
const FILTERS: { key: '' | PaymentMethodKey; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'cash', label: 'Efectivo' },
  { key: 'card_terminal', label: 'Datáfono' },
  { key: 'online', label: 'Tarjeta online' },
]
const TZ = 'Europe/Madrid'

// Listado de cobros del mes para imprimir o guardar en PDF (caja del club):
// solo lo pagado, por fecha, con un resumen por método al final.
export default async function PrintPaymentsPage({ searchParams }: { searchParams: { month?: string; method?: string } }) {
  const admin = getAdminClient()
  const clubId = await getClubId()
  const { data: club } = clubId
    ? await admin.from('clubs').select('name, features').eq('id', clubId).single()
    : { data: null }
  if (!parseClubFeatures((club as any)?.features).enable_payments) redirect('/dashboard')

  const fallback = currentBillingMonth()
  const m = /^(\d{4})-(\d{2})$/.exec(searchParams.month ?? '')
  const year = m ? Number(m[1]) : fallback.year
  const month0 = m ? Number(m[2]) - 1 : fallback.month0
  const monthParam = `${year}-${String(month0 + 1).padStart(2, '0')}`
  const method = (FILTERS.find(f => f.key === searchParams.method)?.key ?? '') as '' | PaymentMethodKey

  const { payments, error } = await loadMonthPayments(admin, clubId, year, month0)
  const paid = payments
    .filter(isPaidPayment)
    .filter(p => !method || paymentMethodKey(p) === method)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))

  // Concepto de cada cuota: el grupo (día y hora) y el mes que cubre.
  // Las cobradas en el club guardan la inscripción y no el grupo.
  const enrollmentIds = [...new Set(paid.filter(p => !p.metadata?.schedule_id).map(p => p.metadata?.enrollment_id).filter(Boolean))] as string[]
  const { data: enrollments } = enrollmentIds.length
    ? await admin.from('group_enrollments').select('id, schedule_id').in('id', enrollmentIds)
    : { data: [] as { id: string; schedule_id: string }[] }
  const scheduleOfEnrollment = new Map((enrollments ?? []).map(e => [e.id, e.schedule_id]))
  const groupOf = (p: any): string | undefined => p.metadata?.schedule_id ?? scheduleOfEnrollment.get(p.metadata?.enrollment_id)
  const scheduleIds = [...new Set(paid.map(groupOf).filter(Boolean))] as string[]
  const { data: schedules } = scheduleIds.length
    ? await admin.from('schedules').select('id, start_time').in('id', scheduleIds)
    : { data: [] as { id: string; start_time: string }[] }
  const scheduleLabel = new Map((schedules ?? []).map(s => [s.id, `${DAYS[getDayOfWeek(s.start_time)]} ${formatTime(s.start_time)}`]))

  function concept(p: any): string {
    const base = PAYMENT_TYPE_LABELS[p.type] ?? 'Cobro'
    if (p.type !== 'fixed_group_month') return base
    const paidUntil: string | undefined = p.metadata?.paid_until
    const monthName = paidUntil ? MONTHS[Number(paidUntil.slice(5, 7)) - 1] : null
    const head = monthName ? `Cuota de ${monthName}` : base
    const items = p.metadata?.items as unknown[] | undefined
    if (items && items.length > 1) return `${head} · ${items.length} grupos`
    const scheduleId = groupOf(p)
    const group = scheduleId ? scheduleLabel.get(scheduleId) : null
    return group ? `${head} · ${group}` : head
  }

  const totals = new Map<PaymentMethodKey, number>()
  for (const p of paid) {
    const k = paymentMethodKey(p)
    totals.set(k, (totals.get(k) ?? 0) + p.amount)
  }
  const grandTotal = paid.reduce((acc, p) => acc + p.amount, 0)
  const printedAt = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date())
  const dateFmt = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, day: '2-digit', month: '2-digit' })
  const methodTitle = method ? ` · ${PAYMENT_METHODS[method].label}` : ''

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 print:max-w-none print:space-y-4">
      <style>{'@page { size: A4; margin: 14mm; }'}</style>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/dashboard/payments?month=${monthParam}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a Pagos
        </Link>
        <div className="ml-auto flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por método">
          {FILTERS.map(f => (
            <Link
              key={f.key}
              href={`/dashboard/payments/imprimir?month=${monthParam}${f.key ? `&method=${f.key}` : ''}`}
              aria-current={method === f.key ? 'true' : undefined}
              className={cn('rounded-full border px-3 py-1.5 text-meta font-medium', method === f.key ? 'border-ink bg-ink text-white' : 'border-line text-ink-2 hover:bg-surface-2')}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <PrintButton />
      </div>

      <article className="rounded-card border border-line bg-white p-5 text-black sm:p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-black pb-3">
          <div>
            <p className="text-sm font-medium">{(club as any)?.name ?? 'Club'}</p>
            <h1 className="font-display text-2xl font-bold">Cobros de {MONTHS[month0]} {year}{methodTitle}</h1>
          </div>
          <p className="text-xs">Impreso el {printedAt}</p>
        </header>

        {error ? (
          <p className="mt-4 text-sm">No se han podido cargar los cobros. Vuelve a intentarlo.</p>
        ) : paid.length === 0 ? (
          <p className="mt-4 text-sm">No hay cobros {method ? `en ${PAYMENT_METHODS[method].label.toLowerCase()} ` : ''}este mes.</p>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1.5 pr-3 font-semibold">Fecha</th>
                  <th className="py-1.5 pr-3 font-semibold">Alumno</th>
                  <th className="py-1.5 pr-3 font-semibold">Concepto</th>
                  <th className="py-1.5 pr-3 font-semibold">Método</th>
                  <th className="py-1.5 text-right font-semibold">Importe</th>
                </tr>
              </thead>
              <tbody>
                {paid.map(p => (
                  <tr key={p.id} className="border-b border-gray-300 break-inside-avoid">
                    <td className="py-1.5 pr-3 tabular-nums">{dateFmt.format(new Date(p.created_at))}</td>
                    <td className="py-1.5 pr-3">{p.user?.name ?? '—'}</td>
                    <td className="py-1.5 pr-3">{concept(p)}</td>
                    <td className="py-1.5 pr-3">{PAYMENT_METHODS[paymentMethodKey(p)].label}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {paid.length > 0 && (
          <section className="ml-auto mt-6 w-full max-w-xs break-inside-avoid">
            <h2 className="border-b border-black pb-1 text-sm font-semibold">Resumen de {MONTHS[month0]}</h2>
            <table className="w-full text-sm">
              <tbody>
                {METHOD_ORDER.filter(k => totals.has(k)).map(k => (
                  <tr key={k}>
                    <td className="py-1">{k === 'unknown' ? 'Sin método' : PAYMENT_METHODS[k].label}</td>
                    <td className="py-1 text-right tabular-nums">{formatCurrency(totals.get(k)!)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-black font-bold">
                  <td className="py-1.5">Total ({paid.length} {paid.length === 1 ? 'cobro' : 'cobros'})</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}
      </article>
    </div>
  )
}
