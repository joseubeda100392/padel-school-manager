'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatClock, formatLongDate, formatShortDay } from '@/lib/format-date'
import { Card } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { DateTile } from '@/components/ui/list'
import { PayButton } from '@/components/pay-button'

interface SpotBooking {
  id: string
  class_date: string
  source: string
  isPrivate?: boolean
  schedule: {
    start_time: string
    end_time: string
    court: { name: string } | null
    level: { name: string; color: string } | null
    coach: { name: string } | null
  } | null
}

interface PendingPayment {
  priceCents: number
  enablePayments: boolean
  cashOnly: boolean
  // Saldo de bono de particular que vale para ESTA reserva concreta (misma
  // duración + mismo tipo de monitor + mismo tipo de alumno). 0 si no aplica
  // (huecos normales de externo no tienen bono propio).
  bagBalance: number
}

export function SpotBookingCard({ booking, cancellationHours, pendingPayment = null }: { booking: SpotBooking; cancellationHours: number; pendingPayment?: PendingPayment | null }) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const [payingWithBag, setPayingWithBag] = useState(false)
  const [error, setError] = useState('')
  const confirm = useConfirm()

  async function handlePayWithBag() {
    if (!(await confirm({ title: '¿Pagar con tu bono?', description: 'Se usará 1 clase de tu bono de clases particulares.', confirmLabel: 'Usar 1 clase del bono' }))) return
    setPayingWithBag(true)
    setError('')
    const res = await fetch('/api/bookings/pay-private-with-bag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: booking.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      router.refresh()
    } else {
      setError(json.error ?? 'No se ha podido pagar con el bono. Vuelve a intentarlo.')
      setPayingWithBag(false)
    }
  }

  const s = booking.schedule
  const startTimeOfDay = s?.start_time ? new Date(s.start_time).toTimeString().slice(0, 8) : '00:00:00'
  const classDatetime = new Date(`${booking.class_date}T${startTimeOfDay}`)
  const hoursUntil = (classDatetime.getTime() - Date.now()) / 3_600_000
  const canCancel = hoursUntil >= cancellationHours

  const dateLabel = new Date(booking.class_date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  async function handleCancel() {
    if (!(await confirm({ title: `¿Cancelar la clase del ${dateLabel}?`, description: booking.source === 'bag' ? 'Se te devolverá la clase a la bolsa.' : undefined, confirmLabel: 'Cancelar reserva', cancelLabel: 'Mantener', destructive: true }))) return
    setCancelling(true)
    setError('')
    const res = await fetch('/api/bookings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: booking.id, refundBag: true }),
    })
    const json = await res.json()
    if (res.ok) {
      router.refresh()
    } else {
      setError(json.error ?? 'No se ha podido cancelar. Vuelve a intentarlo.')
      setCancelling(false)
    }
  }

  const { weekday, day } = formatShortDay(booking.class_date)

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3 p-4">
        <DateTile weekday={weekday} day={day} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold text-ink">{formatLongDate(booking.class_date)}</p>
          <p className="mt-0.5 text-meta tabular-nums text-ink-2">
            {s ? `${formatClock(s.start_time)} – ${formatClock(s.end_time)}` : ''}
            {s?.court?.name && <> · {s.court.name}</>}
            {s?.coach?.name && <> · con {s.coach.name}</>}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {pendingPayment
              ? <Badge tone="warn"><CircleAlert className="h-3.5 w-3.5" aria-hidden />Pendiente de pago</Badge>
              : <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Reservada</Badge>}
            {booking.isPrivate && <Badge tone="outline">Clase particular</Badge>}
            {s?.level && <LevelTag name={s.level.name} color={s.level.color} />}
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
        {pendingPayment ? (
          <>
            <Button variant="ghost" size="sm" onClick={handleCancel} loading={cancelling} className="mr-auto">
              No la quiero
            </Button>
            {pendingPayment.bagBalance > 0 && (
              <Button variant="secondary" size="sm" onClick={handlePayWithBag} loading={payingWithBag}>
                Usar bono ({pendingPayment.bagBalance})
              </Button>
            )}
            {pendingPayment.enablePayments ? (
              <PayButton
                type="single_class"
                bookingId={booking.id}
                label={`Pagar ${formatCurrency(pendingPayment.priceCents)}`}
                className={buttonVariants({ size: 'sm' })}
                cashOnly={pendingPayment.cashOnly}
              />
            ) : (
              <span className="text-meta text-ink-3">Págala en el club</span>
            )}
          </>
        ) : canCancel ? (
          <Button variant="danger-ghost" size="sm" onClick={handleCancel} loading={cancelling}>
            Cancelar reserva
          </Button>
        ) : (
          <span className="text-meta text-ink-3">Ya no se puede cancelar (plazo de {cancellationHours} h)</span>
        )}
      </div>
      {error && <p role="alert" className="px-4 pb-3 text-meta font-medium text-danger-ink">{error}</p>}
    </Card>
  )
}
