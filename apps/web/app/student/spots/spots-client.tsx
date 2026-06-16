'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PayButton } from '@/components/pay-button'

interface Spot {
  spotType: 'absence' | 'capacity'
  exclusionId: string | null
  excludedDate: string
  scheduleId: string
  scheduleType?: 'regular' | 'intensivo'
  schedulePriceCents?: number | null
  dayLabel: string
  startTime: string
  endTime: string
  durationMin: number
  courtName: string
  coachName: string | null
  maxStudents: number
  level: { name: string; color: string } | null
  enrolledCount: number | null
}

function SpotCard({ spot, balance60, balance90, enablePayments = true, enable60min = true, enable90min = true }: { spot: Spot; balance60: number; balance90: number; enablePayments?: boolean; enable60min?: boolean; enable90min?: boolean }) {
  const router = useRouter()
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [error, setError] = useState('')

  const dateLabel = new Date(spot.excludedDate + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const freePlaces = spot.enrolledCount !== null ? spot.maxStudents - spot.enrolledCount : 1
  const durationType: '60' | '90' = spot.durationMin >= 80 ? '90' : '60'
  const isIntensivo = spot.scheduleType === 'intensivo'
  const hasBalance = !isIntensivo && (durationType === '90'
    ? balance90 > 0
    : balance60 > 0 || balance90 > 0)

  async function handleUseBag() {
    if (!confirm(`¿Confirmas que quieres usar 1 clase de tu bolsa para el ${dateLabel}?`)) return
    setBooking(true)
    setError('')

    const endpoint = spot.spotType === 'absence' ? '/api/bookings/spot' : '/api/bookings/capacity-spot'
    const body = spot.spotType === 'absence'
      ? { exclusionId: spot.exclusionId, scheduleId: spot.scheduleId }
      : { scheduleId: spot.scheduleId, date: spot.excludedDate }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
      <div className="rounded-xl bg-brand-50 border border-brand-200 p-5">
        <p className="text-brand-600 font-medium">✓ Plaza reservada — {dateLabel}</p>
        <p className="text-xs text-brand-500 mt-1">{spot.startTime} – {spot.endTime} · {spot.courtName}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white shadow-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {spot.spotType === 'capacity' ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Plaza libre</span>
            ) : (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Hueco por falta</span>
            )}
            {isIntensivo && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Intensivo</span>
            )}
            {spot.enrolledCount !== null && (
              <span className="text-xs text-gray-400">{spot.enrolledCount}/{spot.maxStudents} alumnos · {freePlaces} plaza{freePlaces !== 1 ? 's' : ''} libre{freePlaces !== 1 ? 's' : ''}</span>
            )}
          </div>
          <p className="text-lg font-bold text-gray-900 capitalize">{dateLabel}</p>
          <p className="mt-0.5 text-sm text-gray-500">
            {spot.startTime} – {spot.endTime} · {spot.courtName}
            {spot.coachName && <span className="text-gray-400"> · {spot.coachName}</span>}
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
          {hasBalance ? (
            <button
              onClick={handleUseBag}
              disabled={booking}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {booking ? '...' : '🎾 Usar 1 clase'}
            </button>
          ) : enablePayments ? (
            <PayButton
              type="single_class"
              scheduleId={spot.scheduleId}
              exclusionId={spot.exclusionId ?? undefined}
              classDate={spot.excludedDate}
              label="💳 Pagar clase"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            />
          ) : null}
          {!hasBalance && enable90min && durationType === '90' && balance60 > 0 && (
            <p className="text-xs text-orange-600">Tu bono es de 60min — no válido para 1h 30min</p>
          )}
          {!isIntensivo && !hasBalance && balance60 === 0 && balance90 === 0 && (
            <p className="text-xs text-gray-400">Sin saldo en bolsa</p>
          )}
          {isIntensivo && spot.schedulePriceCents && spot.schedulePriceCents > 0 && (
            <p className="text-xs text-gray-400">{(spot.schedulePriceCents / 100).toFixed(2)} € / clase</p>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

interface IntensivoPack {
  groupId: string
  scheduleIds: string[]
  classDates: string[]
  days: string[]
  startTime: string
  endTime: string
  durationMin: number
  courtName: string
  coachName: string | null
  maxStudents: number
  level: { name: string; color: string } | null
  totalPriceCents: number
  firstDate: string
}

function IntensivoPackCard({ pack, enablePayments }: { pack: IntensivoPack; enablePayments: boolean }) {
  const firstDateLabel = new Date(pack.firstDate + 'T12:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long',
  })

  return (
    <div className="rounded-xl bg-white shadow-sm p-5 border-l-4 border-purple-400">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Intensivo</span>
            <span className="text-xs text-gray-400">{pack.days.length} clases</span>
          </div>
          <p className="text-lg font-bold text-gray-900">Semana del {firstDateLabel}</p>
          <p className="mt-0.5 text-sm text-gray-500">
            {pack.startTime} – {pack.endTime} · {pack.courtName}
            {pack.coachName && <span className="text-gray-400"> · {pack.coachName}</span>}
          </p>
          <ul className="mt-2 space-y-0.5">
            {pack.days.map((day, i) => (
              <li key={i} className="text-xs text-gray-500">
                {day} —{' '}
                {new Date(pack.classDates[i] + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
              </li>
            ))}
          </ul>
          {pack.level && (
            <span
              className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: pack.level.color }}
            >
              {pack.level.name}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-lg font-bold text-gray-900">{(pack.totalPriceCents / 100).toFixed(2)} €</p>
          <p className="text-xs text-gray-400">pago único · {pack.days.length} clases</p>
          {enablePayments && (
            <PayButton
              type="intensivo_group"
              intensivoGroupId={pack.groupId}
              classDates={pack.classDates}
              label="💳 Pagar intensivo"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function SpotsClient({ spots, intensivoPacks = [], balance60, balance90, enablePayments = true, enable60min = true, enable90min = true }: { spots: Spot[]; intensivoPacks?: IntensivoPack[]; balance60: number; balance90: number; enablePayments?: boolean; enable60min?: boolean; enable90min?: boolean }) {
  const visibleBalance = (enable60min ? balance60 : 0) + (enable90min ? balance90 : 0)
  return (
    <div className="space-y-4">
      {visibleBalance > 0 && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3">
          <p className="text-sm text-orange-700">
            Tu bolsa:{' '}
            {enable60min && balance60 > 0 && <span><span className="font-bold">{balance60}</span> de 1h</span>}
            {enable60min && balance60 > 0 && enable90min && balance90 > 0 && ' · '}
            {enable90min && balance90 > 0 && <span><span className="font-bold">{balance90}</span> de 1h 30min</span>}
            {' — úsalas para apuntarte a un hueco libre.'}
          </p>
        </div>
      )}
      {intensivoPacks.map(pack => (
        <IntensivoPackCard key={pack.groupId} pack={pack} enablePayments={enablePayments} />
      ))}
      {spots.map(spot => (
        <SpotCard
          key={`${spot.spotType}-${spot.exclusionId ?? spot.scheduleId}-${spot.excludedDate}`}
          spot={spot}
          balance60={balance60}
          balance90={balance90}
          enablePayments={enablePayments}
          enable60min={enable60min}
          enable90min={enable90min}
        />
      ))}
    </div>
  )
}
