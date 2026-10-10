'use client'

import { useState, useEffect } from 'react'
import { Check, CircleCheck, CircleOff, Clock, Copy, Link2, Pause } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { useConfirm } from '@/components/ui/confirm'

interface Mandate {
  id: string
  amount_cents: number
  day_of_month: number
  status: string
  last_charged_at: string | null
  next_charge_at: string | null
}

const statusLabel: Record<string, string> = {
  pending_auth: 'Pendiente de autorización',
  active: 'Activa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

export function StudentMandate({ studentId }: { studentId: string }) {
  const confirm = useConfirm()
  const [mandate, setMandate] = useState<Mandate | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [payLink, setPayLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  async function loadMandate() {
    const res = await fetch(`/api/admin/payment-mandates?userId=${studentId}`)
    const json = await res.json()
    const active = (json.mandates ?? []).find((m: Mandate) => m.status !== 'cancelled')
    setMandate(active ?? null)
    setLoading(false)
  }

  useEffect(() => { loadMandate() }, [studentId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/admin/payment-mandates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: studentId, amountCents: Math.round(parseFloat(amount) * 100), dayOfMonth: parseInt(day) }),
    })
    const json = await res.json()
    if (!res.ok) { setSubmitting(false); return }

    // Construir URL de pago para enviar al alumno
    const payUrl = `${window.location.origin}/pay/mandate/${json.mandateId}`
    setPayLink(payUrl)
    setShowForm(false)
    setSubmitting(false)
    loadMandate()
  }

  async function handlePause() {
    if (!mandate) return
    await fetch(`/api/admin/payment-mandates/${mandate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: mandate.status === 'paused' ? 'active' : 'paused' }),
    })
    loadMandate()
  }

  async function handleCancel() {
    if (!mandate) return
    const ok = await confirm({
      title: '¿Cancelar la domiciliación?',
      description: 'Se dejarán de cobrar las cuotas automáticamente y el alumno tendrá que pagar a mano cada mes.',
      confirmLabel: 'Cancelar domiciliación',
      cancelLabel: 'Mantenerla',
      destructive: true,
    })
    if (!ok) return
    await fetch(`/api/admin/payment-mandates/${mandate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    setMandate(null)
    loadMandate()
  }

  if (loading) return null

  return (
    <Card>
      <CardHeader
        title="Domiciliación mensual"
        description="Cobro recurrente por Redsys"
        action={
          !mandate ? (
            <Button size="sm" onClick={() => setShowForm(v => !v)} aria-expanded={showForm}>
              Activar domiciliación
            </Button>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        {payLink && (
          <Notice tone="success" icon={<Link2 />}>
            <p className="mb-2 text-label">Enlace de pago generado. Envíaselo al alumno.</p>
            <div className="flex items-center gap-2">
              <label htmlFor="mandate-pay-link" className="sr-only">Enlace de pago</label>
              <Input id="mandate-pay-link" readOnly value={payLink} className="flex-1 truncate text-meta" />
              <Button
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(payLink)
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 2000)
                }}
              >
                {linkCopied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {linkCopied ? 'Copiado' : 'Copiar enlace'}
              </Button>
            </div>
            <p className="mt-2 text-meta">El enlace caduca cuando el alumno completa el pago o se regenera.</p>
          </Notice>
        )}

        {mandate && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <MandateStatus status={mandate.status} />
              <span className="text-label tabular-nums text-ink">
                {(mandate.amount_cents / 100).toFixed(2)} € / mes · día {mandate.day_of_month}
              </span>
            </div>
            {mandate.last_charged_at && (
              <p className="text-meta tabular-nums text-ink-3">
                Último cobro: {new Date(mandate.last_charged_at).toLocaleDateString('es-ES')}
              </p>
            )}
            {mandate.next_charge_at && mandate.status === 'active' && (
              <p className="text-meta tabular-nums text-ink-3">
                Próximo cobro: {new Date(mandate.next_charge_at + 'T12:00:00Z').toLocaleDateString('es-ES')}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {mandate.status !== 'pending_auth' && (
                <Button variant="secondary" size="sm" onClick={handlePause}>
                  {mandate.status === 'paused' ? 'Reactivar cobros' : 'Pausar cobros'}
                </Button>
              )}
              <Button variant="danger-ghost" size="sm" onClick={handleCancel}>
                Cancelar domiciliación
              </Button>
            </div>
          </div>
        )}

        {showForm && !mandate && (
          <form onSubmit={handleCreate} className="space-y-4 border-t border-line pt-4">
            <Field label="Importe mensual (€)">
              <Input
                type="text"
                inputMode="decimal"
                onFocus={e => e.target.select()}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                placeholder="60.00"
                className="tabular-nums"
              />
            </Field>
            <Field label="Día de cobro">
              <Select value={day} onChange={e => setDay(e.target.value)}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Día {d}</option>
                ))}
              </Select>
            </Field>
            <p className="text-meta text-ink-3">
              Se generará un enlace de pago para enviar al alumno. Al pagarlo, la tarjeta queda vinculada y los cobros son automáticos.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => setShowForm(false)} className="sm:flex-1">
                Cancelar
              </Button>
              <Button type="submit" loading={submitting} className="sm:flex-1">
                {submitting ? 'Generando enlace' : 'Generar enlace de pago'}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  )
}

function MandateStatus({ status }: { status: string }) {
  const label = statusLabel[status] ?? status
  if (status === 'active') return <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />{label}</Badge>
  if (status === 'pending_auth') return <Badge tone="warn"><Clock className="h-3.5 w-3.5" aria-hidden />{label}</Badge>
  if (status === 'paused') return <Badge tone="warn"><Pause className="h-3.5 w-3.5" aria-hidden />{label}</Badge>
  return <Badge tone="neutral"><CircleOff className="h-3.5 w-3.5" aria-hidden />{label}</Badge>
}
