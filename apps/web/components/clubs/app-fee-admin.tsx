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
}

// Super admin: qué cuotas de la app debe cada club y confirmar las transferencias.
export function AppFeeAdmin({ rows }: { rows: AppFeeClubRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function setPaid(clubId: string, month: string, paid: boolean) {
    setBusy(`${clubId}:${month}`)
    setError('')
    const res = await fetch('/api/superadmin/app-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId, month, paid }),
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
      <CardHeader title="Cuota de la app" description="Lo que paga cada club por transferencia. Marca el mes cuando llegue al banco." />
      <ul className="divide-y divide-line">
        {rows.map(r => (
          <li key={r.clubId} className="flex flex-col gap-2 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body font-medium text-ink">{r.clubName}</span>
              <span className="text-meta text-ink-3">
                {formatCurrency(Math.round(r.amount * 100))}/mes · desde {monthsLabel([r.startMonth])}
              </span>
              {r.notStarted ? <Badge tone="neutral">Empieza en {monthsLabel([r.startMonth])}</Badge> : !r.pending.length && <Badge tone="success">Al día</Badge>}
            </div>
            {r.pending.map(p => (
              <div key={p.month} className="flex flex-wrap items-center gap-2">
                <span className="text-body text-ink-2">{monthsLabel([p.month])}</span>
                {p.notified ? <Badge tone="warn">Dice que ha transferido</Badge> : p.overdue ? <Badge tone="danger">Vencida</Badge> : <Badge tone="neutral">Pendiente</Badge>}
                <Button size="sm" variant="secondary" loading={busy === `${r.clubId}:${p.month}`} onClick={() => setPaid(r.clubId, p.month, true)} className="w-full sm:w-auto">
                  Marcar pagada
                </Button>
              </div>
            ))}
            {r.lastPaid && (
              <div className="flex flex-wrap items-center gap-2 text-meta text-ink-3">
                <span>Último mes pagado: {monthsLabel([r.lastPaid])}</span>
                <Button size="sm" variant="ghost" loading={busy === `${r.clubId}:${r.lastPaid}`} onClick={() => setPaid(r.clubId, r.lastPaid!, false)}>
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
