export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { canCollectFees } from '@/lib/cashier'
import { paymentConcept } from '@/lib/payment-concept'
import { PAYMENT_METHODS } from '@/lib/payment-method'
import { isVoidedPayment } from '@/lib/payment-void'
import { formatCurrency } from '@/lib/utils'
import { PrintButton } from './print-button'

export const metadata: Metadata = { title: 'Justificante de pago' }

const TZ = 'Europe/Madrid'

// Justificante de un cobro para dárselo al alumno (no es una factura). Lo abre
// el cobrador o un admin del club del pago.
export default async function TicketPage({ params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const admin = getAdminClient()

  const [{ data: me }, { data: payment }] = await Promise.all([
    admin.from('users').select('role, club_id').eq('id', user.id).single(),
    admin.from('payments').select('id, amount, type, status, created_at, metadata, club_id, user_id').eq('id', params.id).single(),
  ])
  if (!me || !canCollectFees(me.role) || !payment) notFound()
  if (me.role !== 'super_admin' && payment.club_id !== me.club_id) notFound()

  const meta = (payment.metadata ?? {}) as Record<string, any>
  const [{ data: club }, { data: student }, { data: collector }, { data: enrollment }] = await Promise.all([
    admin.from('clubs').select('name').eq('id', payment.club_id).single(),
    admin.from('users').select('name').eq('id', payment.user_id).single(),
    meta.collected_by ? admin.from('users').select('name').eq('id', meta.collected_by).single() : Promise.resolve({ data: null }),
    meta.enrollment_id ? admin.from('group_enrollments').select('schedule:schedules(start_time)').eq('id', meta.enrollment_id).single() : Promise.resolve({ data: null }),
  ])

  const concept = paymentConcept(payment)
  const created = new Date(payment.created_at)
  const date = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(created)
  const time = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(created)
  const method = PAYMENT_METHODS[(meta.method ?? 'online') as keyof typeof PAYMENT_METHODS]?.label ?? '—'
  const startTime = (enrollment as any)?.schedule?.start_time as string | undefined
  const classLabel = startTime
    ? new Intl.DateTimeFormat('es-ES', { timeZone: TZ, weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(startTime))
    : null
  const voided = isVoidedPayment(payment)

  const rows: [string, string][] = [
    ['Fecha', `${date} · ${time}`],
    ['Alumno', student?.name ?? '—'],
    ['Concepto', [concept.title, concept.detail].filter(Boolean).join(' · ')],
    ...(classLabel ? [['Clase', classLabel] as [string, string]] : []),
    ['Forma de pago', method],
    ...(collector?.name ? [['Cobrado por', collector.name] as [string, string]] : []),
  ]

  return (
    <main className="mx-auto w-full max-w-sm space-y-4 bg-surface px-4 py-6 text-ink print:max-w-none print:p-0">
      <div className="rounded-card border border-line p-5 print:border-0 print:p-0">
        <p className="text-center font-display text-title">{club?.name ?? 'Club'}</p>
        <p className="mt-1 text-center text-label text-ink-2">Justificante de pago</p>
        <p className="text-center text-meta text-ink-3">Nº {payment.id.slice(0, 8).toUpperCase()}</p>

        {voided && <p className="mt-3 rounded-control border border-danger-ink px-2 py-1 text-center text-label text-danger-ink">COBRO ANULADO</p>}

        <dl className="mt-4 space-y-2 border-t border-dashed border-line pt-4">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 text-body">
              <dt className="shrink-0 text-ink-2">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-line pt-4">
          <span className="text-label">Importe</span>
          <span className={`font-display text-title tabular-nums ${voided ? 'line-through' : ''}`}>{formatCurrency(payment.amount)}</span>
        </div>

        <p className="mt-4 text-center text-meta text-ink-3">Este justificante no es una factura.</p>
      </div>
      <div className="flex justify-center"><PrintButton /></div>
    </main>
  )
}
