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

function SpotCard({ spot, balance60, balance90 }: { spot: PanelSpot; balance60: number; balance90: number }) {
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
    if (!confirm('¿Usar 1 clase de tu bolsa para el ' + dateLabel + '?')) return
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
    if (res.ok) { setBooked(true); router.refresh() }
    else setError(json.error ?? 'Error')
    setBooking(false)
  }

  const accentColor = spot.spotType === 'absence' ? '#f97316' : '#006a61'

  if (booked) {
    return (
      <div
        className="flex shrink-0 flex-col justify-center items-center rounded-2xl p-4 w-[160px] text-center"
        style={{ background: 'rgba(0,107,44,0.06)', border: '1px solid rgba(0,107,44,0.2)' }}
      >
        <p className="text-[13px] font-bold" style={{ color: '#006b2c' }}>Reservado</p>
        <p className="text-[11px] mt-1 capitalize" style={{ color: '#3e4a3d' }}>{dateLabel}</p>
      </div>
    )
  }

  return (
    <div
      className="flex shrink-0 flex-col rounded-2xl p-3.5 w-[168px]"
      style={{
        background: 'rgba(255,255,255,0.7)',
        border: '1px solid ' + accentColor + '33',
        borderTop: '3px solid ' + accentColor,
      }}
    >
      <div className="flex flex-wrap gap-1 mb-2">
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={spot.spotType === 'absence'
            ? { background: 'rgba(249,115,22,0.1)', color: '#f97316' }
            : { background: 'rgba(0,106,97,0.1)', color: '#006a61' }}
        >
          {spot.spotType === 'absence' ? 'Hueco falta' : 'Plaza libre'}
        </span>
        {spot.level && (
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: spot.level.color }}>
            {spot.level.name}
          </span>
        )}
      </div>

      <p className="text-[12px] font-extrabold capitalize leading-tight" style={{ color: '#0b1c30' }}>{dateLabel}</p>
      <p className="text-[11px] mt-0.5" style={{ color: '#3e4a3d' }}>{spot.startTime} – {spot.endTime}</p>
      <p className="text-[10px] mt-0.5 truncate" style={{ color: '#bdcaba' }}>
        {spot.courtName}{spot.coachName ? ' · ' + spot.coachName : ''}
      </p>

      <div className="mt-auto pt-2.5">
        {hasBalance ? (
          <button
            onClick={handleUseBag}
            disabled={booking}
            className="w-full rounded-xl py-1.5 text-[11px] font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: '#006b2c' }}
          >
            {booking ? '...' : 'Usar 1 clase'}
          </button>
        ) : (
          <PayButton
            type="single_class"
            scheduleId={spot.scheduleId}
            exclusionId={spot.exclusionId ?? undefined}
            classDate={spot.excludedDate}
            label="Pagar clase"
            className="w-full rounded-xl py-1.5 text-[11px] font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90 bg-[#006a61]"
          />
        )}
        {error && <p className="mt-1 text-[10px]" style={{ color: '#dc2626' }}>{error}</p>}
      </div>
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
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(249,115,22,0.1)' }}>
            <svg className="h-4 w-4" style={{ color: '#f97316' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-[13px] font-extrabold" style={{ color: '#0b1c30' }}>Sesiones disponibles</h2>
            <p className="text-[10px]" style={{ color: '#3e4a3d' }}>De tu nivel · usa tu bolsa</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {balance60 > 0 && (
            <div className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: 'rgba(0,107,44,0.08)', border: '1px solid rgba(0,107,44,0.15)' }}>
              <span className="text-[10px] font-bold" style={{ color: '#006b2c' }}>{balance60}</span>
              <span className="text-[9px]" style={{ color: '#006b2c' }}>x60'</span>
            </div>
          )}
          {balance90 > 0 && (
            <div className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: 'rgba(0,106,97,0.08)', border: '1px solid rgba(0,106,97,0.15)' }}>
              <span className="text-[10px] font-bold" style={{ color: '#006a61' }}>{balance90}</span>
              <span className="text-[9px]" style={{ color: '#006a61' }}>x90'</span>
            </div>
          )}
          {spots.length > 0 && (
            <Link href="/student/spots" className="text-[11px] font-bold transition-opacity hover:opacity-70" style={{ color: '#006b2c' }}>
              Ver todas
            </Link>
          )}
        </div>
      </div>

      {spots.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-[12px]" style={{ color: '#bdcaba' }}>Sin sesiones disponibles ahora mismo</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {spots.map(spot => (
            <SpotCard
              key={spot.spotType + '-' + (spot.exclusionId ?? spot.scheduleId) + '-' + spot.excludedDate}
              spot={spot}
              balance60={balance60}
              balance90={balance90}
            />
          ))}
        </div>
      )}
    </div>
  )
}
