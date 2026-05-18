'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatTime } from '@/lib/utils'

interface SpotBooking {
  id: string
  class_date: string
  source: string
  schedule: {
    start_time: string
    end_time: string
    court: { name: string } | null
    level: { name: string; color: string } | null
    coach: { name: string } | null
  } | null
}

export function SpotBookingCard({ booking, cancellationHours }: { booking: SpotBooking; cancellationHours: number }) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  const s = booking.schedule
  const startTimeOfDay = s?.start_time ? new Date(s.start_time).toTimeString().slice(0, 8) : '00:00:00'
  const classDatetime = new Date(`${booking.class_date}T${startTimeOfDay}`)
  const hoursUntil = (classDatetime.getTime() - Date.now()) / 3_600_000
  const canCancel = hoursUntil >= cancellationHours

  const dateLabel = new Date(booking.class_date + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  async function handleCancel() {
    if (!confirm(`¿Cancelar tu reserva del ${dateLabel}?`)) return
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
      setError(json.error ?? 'Error al cancelar')
      setCancelling(false)
    }
  }

  return (
    <div className="rounded-xl bg-white shadow-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900 capitalize">{dateLabel}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {s ? `${formatTime(new Date(s.start_time))} – ${formatTime(new Date(s.end_time))}` : ''} · {s?.court?.name ?? '—'}
            {s?.coach?.name && <span className="text-gray-400"> · {s.coach.name}</span>}
          </p>
          {s?.level && (
            <span
              className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: s.level.color }}
            >
              {s.level.name}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 shrink-0">
            Reservado
          </span>
          {canCancel ? (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {cancelling ? '...' : 'Cancelar'}
            </button>
          ) : (
            <span className="text-xs text-gray-400">
              Plazo cerrado ({cancellationHours}h)
            </span>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
