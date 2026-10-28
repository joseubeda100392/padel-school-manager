'use client'

import { useState } from 'react'
import { Banknote, CreditCard } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field, Input, Select } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { billingMonthStr, feeMonthOptions } from '@/lib/fee-months'
import { formatCurrency } from '@/lib/utils'
import type { InClubMethod } from '@/lib/payment-method'

export interface CollectFeeEnrollment {
  id: string
  paid_until: string | null
  start_date?: string | null
  monthly_price: number
}

const toEuros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')
const toCents = (text: string) => {
  const n = Number(text.trim().replace(',', '.'))
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100)
}

// Cobro en el club de la cuota de un grupo: qué meses (siempre en orden, el
// primero es el más antiguo que debe), cuánto y cómo. Se usa desde Pagos y
// desde la clase, para que cobrar sea igual en los dos sitios.
export function CollectFeeSheet({
  enrollment,
  studentName,
  classLabel,
  discountCents = 0,
  onClose,
  onPaid,
}: {
  enrollment: CollectFeeEnrollment | null
  studentName: string
  classLabel?: string | null
  discountCents?: number
  onClose: () => void
  onPaid: (paidUntil: string) => void
}) {
  const options = enrollment ? feeMonthOptions(enrollment.paid_until, enrollment.start_date ?? null, billingMonthStr()) : []
  const [months, setMonths] = useState(1)
  const [method, setMethod] = useState<InClubMethod>('cash')
  const [amountText, setAmountText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const option = options[months - 1] ?? options[0]
  const defaultCents = enrollment ? Math.max(0, enrollment.monthly_price * months - discountCents) : 0
  const amountCents = amountText === null ? defaultCents : toCents(amountText)
  const changed = amountText !== null && amountCents !== defaultCents

  function close() {
    setMonths(1)
    setMethod('cash')
    setAmountText(null)
    setError('')
    onClose()
  }

  async function submit() {
    if (!enrollment || amountCents === null) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/group-enrollments/${enrollment.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          months,
          expectedPaidUntil: enrollment.paid_until,
          ...(changed ? { amountCents } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No se pudo registrar el cobro')
        return
      }
      onPaid(json.paidUntil)
      close()
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet
      open={!!enrollment}
      onClose={close}
      title={`Cobrar cuota de ${studentName}`}
      description={classLabel ?? undefined}
      footer={
        <>
          <Button variant="secondary" size="lg" className="sm:h-11" onClick={close} disabled={loading}>
            Cancelar
          </Button>
          <Button size="lg" className="sm:h-11" onClick={submit} loading={loading} disabled={amountCents === null || !option}>
            {amountCents === null ? 'Registrar cobro' : `Registrar cobro · ${formatCurrency(amountCents)}`}
          </Button>
        </>
      }
    >
      {option && (
        <div className="space-y-4">
          <Field label="¿Qué cuota paga?" hint="Las cuotas se pagan en orden: primero la más antigua que debe.">
            <Select value={months} onChange={e => { setMonths(Number(e.target.value)); setAmountText(null) }}>
              {options.map(o => (
                <option key={o.months} value={o.months}>
                  {o.label}{o.advance ? ' (adelantada)' : ''}
                </option>
              ))}
            </Select>
          </Field>

          {option.advance && (
            <Notice tone="warn">
              {months === 1
                ? `No debe nada: esto adelanta la cuota de ${option.label}.`
                : 'El último mes se cobra por adelantado.'}
            </Notice>
          )}

          <Field
            label="Importe (€)"
            hint={changed
              ? `Su cuota es ${formatCurrency(defaultCents)}. El cambio vale solo para este cobro.`
              : `Su cuota${months > 1 ? ` de ${months} meses` : ''}${discountCents > 0 ? ', con el descuento de clases no dadas' : ''}. Puedes cambiarlo solo para este cobro.`}
            error={amountCents === null ? 'Escribe un importe válido' : undefined}
          >
            <Input
              type="text"
              inputMode="decimal"
              value={amountText ?? toEuros(defaultCents)}
              onFocus={e => e.target.select()}
              onChange={e => setAmountText(e.target.value)}
              className="tabular-nums sm:w-40"
            />
          </Field>

          <div>
            <p className="mb-1.5 text-label text-ink">Cómo paga</p>
            <div role="radiogroup" aria-label="Cómo paga" className="flex flex-wrap gap-2">
              <Button variant={method === 'cash' ? 'primary' : 'secondary'} size="sm" role="radio" aria-checked={method === 'cash'} onClick={() => setMethod('cash')}>
                <Banknote className="h-4 w-4" aria-hidden />
                Efectivo
              </Button>
              <Button variant={method === 'card_terminal' ? 'primary' : 'secondary'} size="sm" role="radio" aria-checked={method === 'card_terminal'} onClick={() => setMethod('card_terminal')}>
                <CreditCard className="h-4 w-4" aria-hidden />
                Datáfono
              </Button>
            </div>
          </div>

          <p className="text-meta text-ink-2">
            Se apunta como pagada la cuota de <strong className="text-ink">{option.label}</strong>
            {option.advance && <> <Badge tone="neutral">Adelantada</Badge></>}
            {' '}y queda en su historial de pagos.
          </p>

          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      )}
    </Sheet>
  )
}
