'use client'

import { useEffect, useState } from 'react'
import { CircleCheck, CreditCard, TriangleAlert } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { useConfirm } from '@/components/ui/confirm'
import { formatCurrency } from '@/lib/utils'

interface AutoPayState {
  available: boolean
  mandate: { id: string; status: string; day_of_month: number; next_charge_at: string | null } | null
  preview: {
    amount: number
    currentMonthName: string
    onlyNextMonth: boolean
    day: number
    items: { label: string; month: string; amount: number }[]
  }
}

const formatDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function StudentAutoPay() {
  const confirm = useConfirm()
  const [state, setState] = useState<AutoPayState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/student/payment-mandate')
      if (res.ok) setState(await res.json())
    } catch {
      // Sin conexión: el recuadro simplemente no aparece.
    }
  }
  useEffect(() => { load() }, [])

  async function activate() {
    if (!state) return
    const { preview } = state
    const ok = await confirm({
      title: 'Activar pago automático',
      description: preview.onlyNextMonth
        ? `Estás al día, así que ahora se te cobrará la siguiente cuota de cada grupo (${preview.items.map(i => i.month).join(', ')}): ${formatCurrency(preview.amount)}. Después se cobrará solo cada día ${preview.day} de mes.`
        : `Ahora se te cobrará lo que debes: ${formatCurrency(preview.amount)}. Después se cobrará solo cada día ${preview.day} de mes.`,
      confirmLabel: 'Ir a meter la tarjeta',
      cancelLabel: 'Ahora no',
    })
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/student/payment-mandate', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No se pudo activar el pago automático')
        setBusy(false)
        return
      }
      window.location.href = `/pay/mandate/${json.mandateId}`
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  async function cancel() {
    const ok = await confirm({
      title: '¿Cancelar el pago automático?',
      description: 'Se dejará de cobrar con tu tarjeta y tendrás que pagar tus cuotas a mano cada mes.',
      confirmLabel: 'Cancelar pago automático',
      cancelLabel: 'Mantenerlo',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    const res = await fetch('/api/student/payment-mandate', { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) setError('No se pudo cancelar. Inténtalo de nuevo.')
    await load()
    setBusy(false)
  }

  if (!state?.available) return null
  const { mandate, preview } = state
  if (!mandate && !preview.items.length) return null

  return (
    <Card>
      <CardHeader
        title="Pago automático con tarjeta"
        description="Guarda tu tarjeta y tus cuotas se cobrarán solas cada mes. La tarjeta la metes en la página segura del banco (Redsys); el club no la ve."
      />
      <CardBody className="space-y-4">
        {mandate?.status === 'active' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex flex-wrap items-center gap-2 text-body text-ink">
              <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Activado</Badge>
              {mandate.next_charge_at ? `Próximo cobro: ${formatDate(mandate.next_charge_at)}` : `Se cobra cada día ${mandate.day_of_month}`}
            </p>
            <Button variant="danger-ghost" size="sm" onClick={cancel} disabled={busy}>
              Cancelar pago automático
            </Button>
          </div>
        )}

        {mandate?.status === 'paused' && (
          <>
            <Notice tone="warn" icon={<TriangleAlert />}>
              El último cobro con tu tarjeta no se pudo hacer y el pago automático está pausado. Puedes volver a activarlo con otra tarjeta o pagar a mano.
            </Notice>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={activate} disabled={busy || !preview.items.length}>Volver a activar</Button>
              <Button variant="secondary" onClick={cancel} disabled={busy}>Cancelar</Button>
            </div>
          </>
        )}

        {mandate?.status === 'pending_auth' && (
          <>
            <Notice tone="warn" icon={<CreditCard />}>Falta meter la tarjeta para terminar de activarlo.</Notice>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a href={`/pay/mandate/${mandate.id}`} className={buttonVariants({ className: 'w-full sm:w-auto' })}>Meter la tarjeta</a>
              <Button variant="secondary" onClick={cancel} disabled={busy}>Cancelar</Button>
            </div>
          </>
        )}

        {!mandate && (
          <>
            <div className="rounded-control bg-surface-2 p-3.5 text-body text-ink">
              {preview.onlyNextMonth ? (
                <p>Estás al día con {preview.currentMonthName}. Al activarlo se te cobrará ahora la <strong>siguiente cuota</strong> de cada grupo:</p>
              ) : (
                <p>Al activarlo se te cobrará ahora lo que debes:</p>
              )}
              <ul className="mt-2 space-y-1 text-meta text-ink-2">
                {preview.items.map((i, idx) => (
                  <li key={idx} className="flex justify-between gap-3">
                    <span>{capitalize(i.label)} · {i.month}</span>
                    <span className="tabular-nums">{formatCurrency(i.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-line pt-2 text-label">
                <span>Total ahora</span>
                <span className="tabular-nums">{formatCurrency(preview.amount)}</span>
              </p>
              <p className="mt-2 text-meta text-ink-3">
                Después se cobrará solo cada día {preview.day} de mes la cuota de tus grupos. Lo que ya hayas pagado no se vuelve a cobrar.
              </p>
            </div>
            <Button onClick={activate} loading={busy} className="w-full sm:w-auto">
              Activar pago automático
            </Button>
          </>
        )}

        {error && <Notice tone="danger" icon={<TriangleAlert />}>{error}</Notice>}
      </CardBody>
    </Card>
  )
}
