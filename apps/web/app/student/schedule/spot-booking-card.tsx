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
    <div className="rounded-xl p-3.5 border-l-4" style={{background:'rgba(255,255,255,0.7)',border:'1px solid #bdcaba',borderLeft:'4px solid #006a61'}}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold capitalize" style={{color:'#0b1c30'}}>{dateLabel}</p>
          <p className="text-[11px] mt-0.5" style={{color:'#3e4a3d'}}>
            {s ? `${formatTime(new Date(s.start_time))} – ${formatTime(new Date(s.end_time))}` : ''} · {s?.court?.name ?? '—'}
            {s?.coach?.name && <span style={{color:'#bdcaba'}}> · {s.coach.name}</span>}
          </p>
          {s?.level && (
            <span
              className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: s.level.color }}
            >
              {s.level.name}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{background:'rgba(0,106,97,0.1)',color:'#006a61'}}>
            Reservado
          </span>
          {canCancel ? (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-lg px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50 transition-colors hover:opacity-80"
              style={{border:'1px solid rgba(220,38,38,0.3)',color:'#dc2626',background:'rgba(220,38,38,0.05)'}}
            >
              {cancelling ? '...' : 'Cancelar'}
            </button>
          ) : (
            <span className="text-[10px]" style={{color:'#bdcaba'}}>
              Plazo cerrado ({cancellationHours}h)
            </span>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-[11px]" style={{color:'#dc2626'}}>{error}</p>}
    </div>
  )
}
