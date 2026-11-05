'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Banknote, Phone, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { CollectFeeSheet } from '@/components/collect-fee-sheet'
import { VoidPaymentButton } from '@/components/void-payment-button'
import { canVoidPayment, isVoidedPayment } from '@/lib/payment-void'
import { paymentConcept } from '@/lib/payment-concept'
import { PAYMENT_METHODS } from '@/lib/payment-method'
import { formatCurrency, formatTime, getDayOfWeek } from '@/lib/utils'
import { formatLongDate } from '@/lib/format-date'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface Enrollment {
  id: string
  monthly_price: number
  paid_until: string | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  level: string | null
}

interface Payment {
  id: string
  amount: number
  type: string
  status: string
  created_at: string
  metadata: Record<string, any>
  collectedBy: string | null
}

const classLabel = (e: Enrollment) =>
  e.start_time ? `${DAYS[getDayOfWeek(e.start_time)]} ${formatTime(e.start_time)}${e.end_time ? `–${formatTime(e.end_time)}` : ''}` : 'Clase'

export function StudentFees({ meId, student, showDeposit, monthEnd, enrollments, payments }: {
  meId: string
  student: { id: string; name: string; phone: string | null; email: string | null; depositPaid: boolean }
  showDeposit: boolean
  monthEnd: string
  enrollments: Enrollment[]
  payments: Payment[]
}) {
  const router = useRouter()
  const [collecting, setCollecting] = useState<Enrollment | null>(null)
  const [depositPaid, setDepositPaid] = useState(student.depositPaid)
  const [savingDeposit, setSavingDeposit] = useState(false)

  async function toggleDeposit() {
    setSavingDeposit(true)
    const res = await fetch('/api/caja/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: student.id, paid: !depositPaid }),
    }).catch(() => null)
    setSavingDeposit(false)
    const json = await res?.json().catch(() => ({}))
    if (!res?.ok) { toast.error(json?.error ?? 'No se pudo guardar la fianza'); return }
    setDepositPaid(!depositPaid)
    toast.success(!depositPaid ? 'Fianza pagada' : 'Fianza quitada')
  }

  return (
    <>
      <CollectFeeSheet
        enrollment={collecting}
        studentName={student.name}
        classLabel={collecting ? `Clase ${classLabel(collecting)}` : null}
        onClose={() => setCollecting(null)}
        onPaid={() => { toast.success('Cobro registrado'); router.refresh() }}
      />

      {(student.phone || student.email) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-ink-2">
          {student.phone && (
            <a href={`tel:${student.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 font-medium text-ink underline-offset-2 hover:underline">
              <Phone className="h-4 w-4" aria-hidden />
              {student.phone}
            </a>
          )}
          {student.email && <span className="truncate">{student.email}</span>}
        </p>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Cuotas" description="Sus grupos y hasta cuándo ha pagado." />
        {enrollments.length === 0 ? (
          <CardBody><p className="text-body text-ink-2">No está en ningún grupo.</p></CardBody>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {enrollments.map((e) => {
              const owes = !e.paid_until || e.paid_until < monthEnd
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-[0.9375rem] font-medium text-ink">{classLabel(e)}{e.level ? ` · ${e.level}` : ''}</p>
                    <p className="text-meta text-ink-3">
                      {formatCurrency(e.monthly_price)}/mes · {e.paid_until ? `pagado hasta el ${formatLongDate(e.paid_until, { weekday: false }).toLowerCase()}` : 'nunca ha pagado'}
                      {e.end_date ? ` · deja el grupo el ${formatLongDate(e.end_date, { weekday: false }).toLowerCase()}` : ''}
                    </p>
                  </div>
                  <Badge tone={owes ? 'warn' : 'success'}>{owes ? 'Debe' : 'Al día'}</Badge>
                  <Button variant="secondary" size="sm" onClick={() => setCollecting(e)}>
                    <Banknote className="h-4 w-4" aria-hidden />
                    Cobrar
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {showDeposit && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-label text-ink">Fianza</p>
              <Badge tone={depositPaid ? 'success' : 'warn'} className="mt-1">{depositPaid ? 'Fianza pagada' : 'Sin fianza'}</Badge>
            </div>
            <Button variant={depositPaid ? 'ghost' : 'secondary'} size="sm" loading={savingDeposit} onClick={toggleDeposit}>
              {depositPaid ? 'Quitar' : 'Marcar pagada'}
            </Button>
          </CardBody>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Pagos" description="Lo que ha pagado en el club, del más reciente al más antiguo." />
        {payments.length === 0 ? (
          <CardBody><p className="text-body text-ink-2">Todavía no tiene pagos.</p></CardBody>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {payments.map((p) => {
              const concept = paymentConcept(p)
              const voided = isVoidedPayment(p)
              const method = PAYMENT_METHODS[(p.metadata.method ?? 'online') as keyof typeof PAYMENT_METHODS]?.label ?? '—'
              const canUndo = !voided && p.type === 'fixed_group_month' && p.metadata.collected_by === meId && canVoidPayment(p)
              return (
                <li key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 ${voided ? 'opacity-60' : ''}`}>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-[0.9375rem] font-medium text-ink">
                      {concept.title}{concept.detail ? ` · ${concept.detail}` : ''}
                    </p>
                    <p className="text-meta text-ink-3">
                      {formatLongDate(p.created_at, { weekday: false })} {formatTime(p.created_at)} · {method}
                      {p.collectedBy ? ` · cobró ${p.collectedBy}` : ''}
                    </p>
                  </div>
                  <span className={`text-label tabular-nums ${voided ? 'text-ink-3 line-through' : 'text-ink'}`}>{formatCurrency(p.amount)}</span>
                  {voided && <Badge tone="neutral">Anulado</Badge>}
                  <Link href={`/ticket/${p.id}`} target="_blank" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    <Receipt className="h-4 w-4" aria-hidden />
                    Ticket
                  </Link>
                  {canUndo && (
                    <VoidPaymentButton paymentId={p.id} type={p.type} concept={concept.title} amount={p.amount} studentName={student.name} />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
