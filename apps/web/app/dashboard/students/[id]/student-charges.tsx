'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { useConfirm } from '@/components/ui/confirm'
import { formatCurrency } from '@/lib/utils'

export interface StudentCharge {
  id: string
  concept: string
  amountCents: number
  status: 'pending' | 'paid' | 'cancelled'
  paidMethod: string | null
  createdAt: string
}

const METHOD_LABEL: Record<string, string> = { card: 'tarjeta', cash: 'efectivo', card_terminal: 'datáfono' }

// Cobros que no son la cuota de un grupo (p. ej. la cuota de un grupo que ya
// ha dejado). El alumno lo ve en Mis clases y lo paga con tarjeta, o el club
// lo marca pagado aquí.
export function StudentCharges({ studentId, charges }: { studentId: string; charges: StudentCharge[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [adding, setAdding] = useState(false)
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const amountCents = Math.round(Number(amount.replace(',', '.')) * 100)

  async function create() {
    setBusy(true)
    const res = await fetch('/api/admin/charges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, concept: concept.trim(), amountCents }),
    }).catch(() => null)
    const json = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res?.ok) { toast.error(json?.error ?? 'No se ha podido crear el cargo'); return }
    toast.success('Cargo creado. Al alumno le llega un aviso.')
    setAdding(false); setConcept(''); setAmount('')
    router.refresh()
  }

  async function act(c: StudentCharge, action: 'cash' | 'card_terminal' | 'cancel') {
    if (action === 'cancel' && !(await confirm({
      title: 'Anular este cargo',
      description: `"${c.concept}" deja de estar pendiente y el alumno ya no lo verá.`,
      confirmLabel: 'Anular cargo',
      destructive: true,
    }))) return
    setBusy(true)
    const res = await fetch(`/api/admin/charges/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => null)
    const json = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res?.ok) { toast.error(json?.error ?? 'No se ha podido guardar'); return }
    toast.success(action === 'cancel' ? 'Cargo anulado' : 'Pago registrado')
    router.refresh()
  }

  const pending = charges.filter(c => c.status === 'pending')
  const done = charges.filter(c => c.status !== 'pending')

  return (
    <Card>
      <CardHeader
        title="Cargos sueltos"
        description="Cobros que no son la cuota de un grupo, como la cuota de un grupo que ya ha dejado."
        action={!adding && <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Añadir cargo</Button>}
      />
      <CardBody className="space-y-4">
        {adding && (
          <div className="space-y-3 rounded-control border border-line bg-surface-2 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
              <Field label="Concepto">
                <Input value={concept} onChange={e => setConcept(e.target.value)} placeholder="Ej.: Cuota de octubre" maxLength={120} />
              </Field>
              <Field label="Importe (€)">
                <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="68" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={create} loading={busy} disabled={concept.trim().length < 2 || !(amountCents > 0)} className="w-full sm:w-auto">
                Crear cargo
              </Button>
              <Button variant="secondary" onClick={() => setAdding(false)} className="w-full sm:w-auto">Cancelar</Button>
            </div>
          </div>
        )}

        {charges.length === 0 && !adding && <p className="text-body text-ink-3">Sin cargos sueltos.</p>}

        {pending.length > 0 && (
          <ul className="divide-y divide-line rounded-control border border-line">
            {pending.map(c => (
              <li key={c.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-label text-ink">{c.concept}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-ink">{formatCurrency(c.amountCents)}</span>
                    <Badge tone="warn">Pendiente</Badge>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => act(c, 'cash')} disabled={busy}>Efectivo ✓</Button>
                  <Button size="sm" variant="secondary" onClick={() => act(c, 'card_terminal')} disabled={busy}>Datáfono ✓</Button>
                  <Button size="sm" variant="danger-ghost" onClick={() => act(c, 'cancel')} disabled={busy}>Anular</Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {done.length > 0 && (
          <ul className="space-y-1 text-meta text-ink-3">
            {done.map(c => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2">
                <span>{c.concept} · {formatCurrency(c.amountCents)}</span>
                <span>{c.status === 'paid' ? `Pagado${c.paidMethod ? ` (${METHOD_LABEL[c.paidMethod] ?? c.paidMethod})` : ''}` : 'Anulado'}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
