'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, List } from '@/components/ui/list'
import { useConfirm } from '@/components/ui/confirm'
import { formatLongDate } from '@/lib/format-date'

type SpotBooking = {
  id: string
  source: string
  class_date: string
  student: { name: string; email: string } | null
}

const sourceLabel: Record<string, string> = { bag: 'Crédito bolsa', pay_per_class: 'Pago único', admin: 'Admin' }

export function SpotBookingsList({ bookings }: { bookings: SpotBooking[] }) {
  const confirm = useConfirm()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(bookingId: string) {
    if (!(await confirm({
      title: '¿Cancelar esta reserva puntual?',
      description: 'Se devolverá el crédito al alumno.',
      confirmLabel: 'Cancelar reserva',
      destructive: true,
    }))) return
    setDeleting(bookingId)
    try {
      const res = await fetch('/api/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, refundBag: true }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? 'No se pudo cancelar la reserva')
        setDeleting(null)
        return
      }
      window.location.reload()
    } catch {
      toast.error('Error de conexión. Comprueba tu internet e inténtalo de nuevo.')
      setDeleting(null)
    }
  }

  if (bookings.length === 0) return null

  return (
    <List className="mt-3 border-t border-line">
      {bookings.map((b) => (
        <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
          <Avatar name={b.student?.name ?? '?'} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9375rem] font-medium text-ink">{b.student?.name}</p>
            <p className="truncate text-meta text-ink-3">{b.student?.email}</p>
          </div>
          <div className="text-right">
            <p className="text-label text-ink-2">{formatLongDate(b.class_date)}</p>
            <Badge tone="neutral" className="mt-0.5">{sourceLabel[b.source] ?? b.source}</Badge>
          </div>
          <Button
            variant="danger-ghost"
            size="icon"
            onClick={() => handleDelete(b.id)}
            loading={deleting === b.id}
            aria-label={`Cancelar reserva de ${b.student?.name ?? 'alumno'}`}
          >
            {deleting !== b.id && <X className="h-4 w-4" aria-hidden />}
          </Button>
        </li>
      ))}
    </List>
  )
}
