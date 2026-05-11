'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PayButton } from '@/components/pay-button'

interface Spot {
  exclusionId: string
  excludedDate: string
  scheduleId: string
  dayLabel: string
  startTime: string
  endTime: string
  courtName: string
  maxStudents: number
  level: { name: string; color: string } | null
}

function SpotCard({ spot, bagBalance }: { spot: Spot; bagBalance: number }) {
  const router = useRouter()
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [error, setError] = useState('')

  const dateLabel = new Date(spot.excludedDate + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  async function handleUseBag() {
    if (!confirm(`¿Confirmas que quieres usar 1 clase de tu bolsa para el ${dateLabel}?`)) return
    setBooking(true)
    setError('')
    const res = await fetch('/api/bookings/spot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exclusionId: spot.exclusionId, scheduleId: spot.scheduleId }),
    })
    const json = await res.json()
    if (res.ok) {
      setBooked(true)
      router.refresh()
    } else {
      setError(json.error ?? 'Error al reservar')
    }
    setBooking(false)
  }

  if (booked) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-5">
        <p className="text-green-700 font-medium">✓ Plaza reservada — {dateLabel}</p>
        <p className="text-xs text-green-600 mt-1">{spot.startTime} – {spot.endTime} · {spot.courtName}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white shadow-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-gray-900 capitalize">{dateLabel}</p>
          <p className="mt-0.5 text-sm text-gray-500">
            {spot.startTime} – {spot.endTime} · {spot.courtName}
          </p>
          {spot.level && (
            <span
              className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: spot.level.color }}
            >
              {spot.level.name}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {bagBalance > 0 ? (
            <button
              onClick={handleUseBag}
              disabled={booking}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {booking ? '...' : '🎾 Usar 1 clase'}
            </button>
          ) : (
            <PayButton
              type="single_class"
              scheduleId={spot.scheduleId}
              exclusionId={spot.exclusionId}
              label="💳 Pagar clase"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            />
          )}
          {bagBalance === 0 && (
            <p className="text-xs text-gray-400">Sin saldo en bolsa</p>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function SpotsClient({ spots, bagBalance }: { spots: Spot[]; bagBalance: number }) {
  return (
    <div className="space-y-4">
      {bagBalance > 0 && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3">
          <p className="text-sm text-orange-700">
            Tienes <span className="font-bold">{bagBalance}</span> clase{bagBalance !== 1 ? 's' : ''} en tu bolsa — úsalas para apuntarte a un hueco libre.
          </p>
        </div>
      )}
      {spots.map(spot => (
        <SpotCard key={spot.exclusionId} spot={spot} bagBalance={bagBalance} />
      ))}
    </div>
  )
}
