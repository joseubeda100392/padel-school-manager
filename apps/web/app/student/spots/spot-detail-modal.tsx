'use client'

import { useEffect } from 'react'
import { PayButton } from '@/components/pay-button'

interface Spot {
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
  maxStudents: number
  level: { name: string; color: string } | null
  enrolledCount: number | null
}

interface SpotDetailModalProps {
  spot: Spot | null
  open: boolean
  onClose: () => void
  balance60: number
  balance90: number
  booking: boolean
  booked: boolean
  error: string
  onUseBag: () => void
}

export function SpotDetailModal({
  spot, open, onClose,
  balance60, balance90,
  booking, booked, error, onUseBag,
}: SpotDetailModalProps) {

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !spot) return null

  const dateLabel = new Date(spot.excludedDate + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const freePlaces = spot.enrolledCount !== null ? spot.maxStudents - spot.enrolledCount : 1
  const durationType: '60' | '90' = spot.durationMin >= 80 ? '90' : '60'
  const hasBalance = durationType === '90' ? balance90 > 0 : (balance60 > 0 || balance90 > 0)
  const totalBalance = balance60 + balance90

  const spotColor = spot.spotType === 'capacity' ? '#2563eb' : '#d97706'
  const spotBg = spot.spotType === 'capacity' ? '#eff6ff' : '#fffbeb'
  const spotLabel = spot.spotType === 'capacity' ? 'Plaza libre' : 'Hueco por falta'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(11,28,48,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-md overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '90vh',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header pill / drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full" style={{ background: 'var(--color-outline)' }} />
        </div>

        {/* Colored header */}
        <div className="px-5 pt-4 pb-5" style={{ background: 'linear-gradient(135deg, #005a25, #006b2c)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {/* Type badge */}
              <span
                className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold mb-2"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                {spotLabel}
              </span>
              <h2 className="text-[22px] font-bold text-white leading-tight capitalize font-heading">
                {dateLabel}
              </h2>
              <p className="text-[14px] mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {spot.startTime} – {spot.endTime} · {spot.durationMin} min
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
              style={{ background: 'rgba(255,255,255,0.2)' }}
              aria-label="Cerrar"
            >
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 py-5 space-y-4" style={{ maxHeight: 'calc(90vh - 180px)' }}>

          {/* Detail rows */}
          <div className="rounded-2xl border divide-y overflow-hidden" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>

            {/* Court */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                <svg className="h-4 w-4" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-placeholder)' }}>Pista</p>
                <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{spot.courtName}</p>
              </div>
            </div>

            {/* Coach */}
            {spot.coachName && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                  <svg className="h-4 w-4" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-placeholder)' }}>Entrenador</p>
                  <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{spot.coachName}</p>
                </div>
              </div>
            )}

            {/* Level */}
            {spot.level && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                  <svg className="h-4 w-4" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-placeholder)' }}>Nivel</p>
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-[12px] font-bold text-white mt-0.5"
                    style={{ backgroundColor: spot.level.color }}
                  >
                    {spot.level.name}
                  </span>
                </div>
              </div>
            )}

            {/* Occupancy */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                <svg className="h-4 w-4" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-placeholder)' }}>Plazas</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[15px] font-semibold" style={{ color: 'var(--color-on-surface)' }}>
                    {spot.enrolledCount !== null
                      ? `${spot.enrolledCount} de ${spot.maxStudents} ocupadas`
                      : `1 de ${spot.maxStudents} ocupadas`}
                  </p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: spotBg, color: spotColor }}
                  >
                    {freePlaces} libre{freePlaces !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Occupancy bar */}
                <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--color-outline-variant)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round(((spot.enrolledCount ?? 0) / spot.maxStudents) * 100)}%`,
                      background: 'var(--color-primary)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Balance info */}
          {totalBalance > 0 && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--color-primary-light)', border: '1px solid rgba(0,107,44,0.15)' }}>
              <svg className="h-5 w-5 shrink-0" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--color-primary)' }}>
                Tu bolsa:{' '}
                {balance60 > 0 && <><strong>{balance60}</strong> × 60 min</>}
                {balance60 > 0 && balance90 > 0 && ' · '}
                {balance90 > 0 && <><strong>{balance90}</strong> × 90 min</>}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-[13px] font-medium" style={{ background: 'var(--color-error-surface)', color: 'var(--color-error)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Action footer — sticky */}
        <div
          className="px-5 pb-6 pt-4 space-y-2.5"
          style={{ borderTop: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)' }}
        >
          {booked ? (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3.5" style={{ background: 'var(--color-primary-light)' }}>
              <svg className="h-5 w-5 shrink-0" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[14px] font-bold" style={{ color: 'var(--color-primary)' }}>¡Plaza reservada con éxito!</p>
            </div>
          ) : hasBalance ? (
            <button
              onClick={onUseBag}
              disabled={booking}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--color-primary)', minHeight: 48 }}
            >
              {booking ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Reservando...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  Usar 1 clase de mi bolsa
                </>
              )}
            </button>
          ) : (
            <PayButton
              type="single_class"
              scheduleId={spot.scheduleId}
              exclusionId={spot.exclusionId ?? undefined}
              classDate={spot.excludedDate}
              label="Pagar esta clase"
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white"
            />
          )}

          {/* Mismatch warning */}
          {!hasBalance && durationType === '90' && balance60 > 0 && (
            <p className="text-center text-[12px]" style={{ color: 'var(--color-warning)' }}>
              Tu bono es de 60 min — no es válido para clases de 90 min
            </p>
          )}

          <button
            onClick={onClose}
            className="w-full rounded-xl py-3 text-[14px] font-semibold transition-colors hover:bg-gray-100"
            style={{ color: 'var(--color-on-surface-variant)', minHeight: 44 }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
