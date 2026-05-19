'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PayButton } from '@/components/pay-button'

interface PanelSpot {
  spotType: 'absence' | 'capacity'
  exclusionId: string | null
  excludedDate: string
  scheduleId: string
  dayLabel: string
  startTime: string
  endTime: string
  durationMin: number
  courtName: string
  coachName: string | null
  level: { name: string; color: string } | null
  enrolledCount: number | null
  maxStudents: number
}

function SpotRow({ spot, balance60, balance90 }: { spot: PanelSpot; balance60: number; balance90: number }) {
  const router = useRouter()
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [error, setError] = useState('')

  const dateLabel = new Date(spot.excludedDate + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  const durationType: '60' | '90' = spot.durationMin >= 80 ? '90' : '60'
  const hasBalance = durationType === '90' ? balance90 > 0 : (balance60 > 0 || balance90 > 0)

  async function handleUseBag() {
    if (!confirm(`¿Usar 1 clase de tu bolsa para el ${dateLabel}?`)) return
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
      <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(0,107,44,0.06)', border: '1px solid rgba(0,107,44,0.2)' }}>
        <p className="text-[12px] font-bold" style={{ color: '#006b2c' }}>✓ Reservado</p>
        <p className="text-[11px]" style={{ color: '#3e4a3d' }}>{dateLabel} · {spot.startTime}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-3 border-l-4" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #bdcaba', borderLeft: `4px solid ${spot.spotType === 'absence' ? '#f97316' : '#006a61'}` }}>
      {/* Tipo + nivel */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={spot.spotType === 'absence'
            ? { background: 'rgba(249,115,22,0.1)', color: '#f97316' }
            : { background: 'rgba(0,106,97,0.1)', color: '#006a61' }}>
          {spot.spotType === 'absence' ? 'Hueco falta' : 'Plaza libre'}
        </span>
        {spot.level && (
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: spot.level.color }}>
            {spot.level.name}
          </span>
        )}
      </div>

      {/* Fecha y hora */}
      <p className="text-[12px] font-bold capitalize" style={{ color: '#0b1c30' }}>{dateLabel}</p>
      <p className="text-[11px]" style={{ color: '#3e4a3d' }}>
        {spot.startTime} – {spot.endTime} · {spot.courtName}
        {spot.coachName && <span style={{ color: '#bdcaba' }}> · {spot.coachName}</span>}
      </p>

      {/* Acción */}
      <div className="mt-2">
        {hasBalance ? (
          <button
            onClick={handleUseBag}
            disabled={booking}
            className="w-full rounded-lg py-1.5 text-[11px] font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: '#006b2c' }}
          >
            {booking ? '...' : '🎾 Usar 1 clase'}
          </button>
        ) : (
          <PayButton
            type="single_class"
            scheduleId={spot.scheduleId}
            exclusionId={spot.exclusionId ?? undefined}
            classDate={spot.excludedDate}
            label="💳 Pagar clase"
            className="w-full rounded-lg py-1.5 text-[11px] font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90 bg-[#006a61]"
          />
        )}
      </div>
      {error && <p className="mt-1 text-[10px]" style={{ color: '#dc2626' }}>{error}</p>}
    </div>
  )
}

export function ScheduleSpotsPanel({
  spots,
  balance60,
  balance90,
}: {
  spots: PanelSpot[]
  balance60: number
  balance90: number
}) {
  return (
    <div className="rounded-2xl border p-4" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderColor: '#bdcaba' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[13px] font-extrabold" style={{ color: '#0b1c30' }}>Sesiones disponibles</h2>
          <p className="text-[10px] mt-0.5" style={{ color: '#3e4a3d' }}>De tu nivel · usa tu bolsa</p>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={spots.length > 0
            ? { background: 'rgba(249,115,22,0.1)', color: '#f97316' }
            : { background: '#eff4ff', color: '#bdcaba' }}>
          {spots.length}
        </span>
      </div>

      {/* Saldo bolsa */}
      {(balance60 > 0 || balance90 > 0) && (
        <div className="mb-3 flex gap-2">
          {balance60 > 0 && (
            <div className="flex-1 rounded-lg px-2 py-1.5 text-center" style={{ background: 'rgba(0,107,44,0.06)', border: '1px solid rgba(0,107,44,0.15)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#006b2c' }}>60 min</p>
              <p className="text-[18px] font-extrabold" style={{ color: '#006b2c' }}>{balance60}</p>
            </div>
          )}
          {balance90 > 0 && (
            <div className="flex-1 rounded-lg px-2 py-1.5 text-center" style={{ background: 'rgba(0,106,97,0.06)', border: '1px solid rgba(0,106,97,0.15)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#006a61' }}>90 min</p>
              <p className="text-[18px] font-extrabold" style={{ color: '#006a61' }}>{balance90}</p>
            </div>
          )}
        </div>
      )}

      {spots.length === 0 ? (
        <div className="py-5 text-center">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#eff4ff' }}>
            <svg className="h-4 w-4" style={{ color: '#bdcaba' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <p className="text-[11px] font-medium" style={{ color: '#3e4a3d' }}>Sin sesiones disponibles</p>
          <p className="text-[10px] mt-0.5" style={{ color: '#bdcaba' }}>Vuelve más tarde</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {spots.slice(0, 4).map(spot => (
            <SpotRow
              key={`${spot.spotType}-${spot.exclusionId ?? spot.scheduleId}-${spot.excludedDate}`}
              spot={spot}
              balance60={balance60}
              balance90={balance90}
            />
          ))}
          {spots.length > 4 && (
            <Link
              href="/student/spots"
              className="block w-full rounded-xl py-2 text-center text-[11px] font-bold transition-colors hover:bg-[#e5eeff]"
              style={{ color: '#006b2c', border: '1px solid #bdcaba' }}
            >
              Ver todas ({spots.length}) →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
