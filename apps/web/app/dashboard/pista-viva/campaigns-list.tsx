'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CircleCheck, CircleX, Clock, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { formatShortDay, formatClock } from '@/lib/format-date'

const statusTone: Record<string, 'neutral' | 'success' | 'danger'> = {
  draft: 'neutral',
  sent: 'neutral',
  converted: 'success',
  closed: 'danger',
}

const statusIcon: Record<string, React.ReactNode> = {
  draft: <FileText className="h-3.5 w-3.5" aria-hidden />,
  sent: <Clock className="h-3.5 w-3.5" aria-hidden />,
  converted: <CircleCheck className="h-3.5 w-3.5" aria-hidden />,
  closed: <CircleX className="h-3.5 w-3.5" aria-hidden />,
}

const statusLabel: Record<string, string> = {
  draft:     'Borrador',
  sent:      'Enviada',
  converted: 'Convertida',
  closed:    'Cerrada',
}

export default function CampaignsList({ campaigns: initial }: { campaigns: any[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [campaigns, setCampaigns] = useState(initial)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function deleteCampaign(id: string) {
    if (!(await confirm({ title: 'Borrar esta campaña', confirmLabel: 'Borrar campaña', destructive: true }))) return
    setDeleting(id)
    const res = await fetch(`/api/admin/pista-viva/campaigns?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      router.refresh()
    }
    setDeleting(null)
  }

  if (!campaigns.length) {
    return (
      <tr>
        <td colSpan={7} className="px-6 py-12 text-center text-body text-ink-2">
          No hay campañas aún. Pulsa &quot;Buscar pistas libres&quot; para empezar.
        </td>
      </tr>
    )
  }

  return (
    <>
      {campaigns.map((c) => {
        const day = formatShortDay(c.slot_datetime)
        return (
          <tr key={c.id}>
            <td className="px-4 py-3 text-body font-medium text-ink sm:px-5">{c.court_name}</td>
            <td className="px-4 py-3 text-body tabular-nums text-ink-2">
              {day.weekday} {day.day} · {formatClock(c.slot_datetime)}
            </td>
            <td className="px-4 py-3 text-body text-ink-2">{c.levels?.name ?? '—'}</td>
            <td className="px-4 py-3 text-body tabular-nums text-ink-2">{c.players_joined}/{c.players_needed}</td>
            <td className="px-4 py-3 text-body tabular-nums text-ink-2">{c.click_count}</td>
            <td className="px-4 py-3">
              <Badge tone={statusTone[c.status] ?? 'neutral'}>
                {statusIcon[c.status]}
                {statusLabel[c.status] ?? c.status}
              </Badge>
            </td>
            <td className="px-4 py-3 sm:pr-5">
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/pista-viva/${c.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                  Ver
                </Link>
                <Button variant="danger-ghost" size="sm" onClick={() => deleteCampaign(c.id)} loading={deleting === c.id}>
                  Borrar
                </Button>
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}
