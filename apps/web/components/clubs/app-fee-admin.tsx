'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { monthsLabel } from '@/lib/payment-concept'

export interface AppFeeClubRow {
  clubId: string
  clubName: string
  amount: number
  startMonth: string
  pending: { month: string; overdue: boolean; notified: boolean }[]
  lastPaid: string | null
  notStarted: boolean
  lockWhenOverdue: boolean
  locked: boolean
}

// Super admin: qué cuotas de la app debe cada club y confirmar las transferencias.
export function AppFeeAdmin({ rows }: { rows: AppFeeClubRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function save(key: string, payload: Record<string, unknown>) {
    setBusy(key)
    setError('')
    const res = await fetch('/api/superadmin/app-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null)
    if (!res?.ok) {
      const body = await res?.json().catch(() => null)
      setError(body?.error ?? 'No se pudo guardar')
    }
    setBusy(null)
    router.refresh()
  }

  if (!rows.length) return null

  return (
    <Card>
      <CardHeader title="Cuota de la app" description="Lo que paga cada club por transferencia o Bizum. Marca el mes cuando te llegue." />
      <ul className="divide-y divide-line">
        {rows.map(r => (
          <li key={r.clubId} className="flex flex-col gap-2 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body font-medium text-ink">{r.clubName}</span>
              <span className="text-meta text-ink-3">
                {formatCurrency(Math.round(r.amount * 100))}/mes · desde {monthsLabel([r.startMonth])}
              </span>
              {r.notStarted ? <Badge tone="neutral">Empieza en {monthsLabel([r.startMonth])}</Badge> : !r.pending.length && <Badge tone="success">Al día</Badge>}
              {r.locked && <Badge tone="danger">Panel bloqueado</Badge>}
            </div>
            <label className="flex items-start gap-2 text-meta text-ink-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                checked={r.lockWhenOverdue}
                disabled={busy === `${r.clubId}:lock`}
                onChange={e => save(`${r.clubId}:lock`, { clubId: r.clubId, lockWhenOverdue: e.target.checked })}
              />
              <span>Bloquear su panel si pasan más de 10 días del vencimiento sin pagar (desmárcalo solo para hacer una excepción)</span>
            </label>
            {r.pending.map(p => (
              <div key={p.month} className="flex flex-wrap items-center gap-2">
                <span className="text-body text-ink-2">{monthsLabel([p.month])}</span>
                {p.notified ? <Badge tone="warn">Dice que ha pagado</Badge> : p.overdue ? <Badge tone="danger">Vencida</Badge> : <Badge tone="neutral">Pendiente</Badge>}
                <Button size="sm" variant="secondary" loading={busy === `${r.clubId}:${p.month}`} onClick={() => save(`${r.clubId}:${p.month}`, { clubId: r.clubId, month: p.month, paid: true })} className="w-full sm:w-auto">
                  Marcar pagada
                </Button>
              </div>
            ))}
            {r.lastPaid && (
              <div className="flex flex-wrap items-center gap-2 text-meta text-ink-3">
                <span>Último mes pagado: {monthsLabel([r.lastPaid])}</span>
                <Button size="sm" variant="ghost" loading={busy === `${r.clubId}:${r.lastPaid}`} onClick={() => save(`${r.clubId}:${r.lastPaid}`, { clubId: r.clubId, month: r.lastPaid, paid: false })}>
                  Deshacer
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="px-4 pb-3 text-meta text-danger-ink sm:px-5">{error}</p>}
    </Card>
  )
}
