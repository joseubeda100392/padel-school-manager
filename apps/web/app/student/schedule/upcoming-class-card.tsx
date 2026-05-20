'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { PayButton } from '@/components/pay-button'
import { ClassDetailModal } from './class-detail-modal'

export interface UpcomingEvent {
  dateStr: string
  label: string
  canRegister: boolean
  enrollmentId: string
  scheduleId: string
  startTime: string
  endTime: string
  courtName: string
  levelId: string | null
  level: { name: string; color: string } | null
  isExcluded: boolean
  exclusionId: string | null
  isPaid: boolean
  monthlyPrice: number
}

export function UpcomingClassCard({
  event,
  cancellationHours,
}: {
  event: UpcomingEvent
  cancellationHours: number
}) {
  const router = useRouter()
  const [excluded, setExcluded] = useState(event.isExcluded)
  const [registering, setRegistering] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [error, setError] = useState('')

  const dateObj = new Date(event.dateStr + 'T12:00:00')
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  const isToday = event.dateStr === todaySpain
  const dayNum = dateObj.getDate()
  const monthStr = dateObj.toLocaleDateString('es-ES', { month: 'short' })
  const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short' })

  async function handleRegistrar() {
    if (!confirm(`¿Confirmas que vas a faltar a la clase del ${event.label}?`)) return
    setRegistering(true)
    setError('')
    const res = await fetch('/api/schedule-exclusions/student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId: event.scheduleId, date: event.dateStr }),
    })
    const json = await res.json()
    if (res.ok) {
      setExcluded(true)
      router.refresh()
    } else {
      setError(json.error ?? 'Error')
    }
    setRegistering(false)
  }

  const borderColor = excluded ? '#f97316' : '#006b2c'
  const bg = excluded ? 'rgba(249,115,22,0.03)' : 'rgba(255,255,255,0.85)'

  return (
    <>
      <ClassDetailModal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        scheduleId={event.scheduleId}
        levelId={event.levelId}
        dayLabel={event.label}
        startTime={event.startTime}
        endTime={event.endTime}
        courtName={event.courtName}
        level={event.level}
      />
      <div
        className="flex items-start gap-3 sm:gap-4 rounded-2xl p-4 transition-shadow hover:shadow-sm"
        style={{
          background: bg,
          backdropFilter: 'blur(8px)',
          border: `1px solid ${excluded ? 'rgba(249,115,22,0.25)' : '#bdcaba'}`,
          borderLeft: `4px solid ${borderColor}`,
        }}
      >
        {/* Date badge */}
        <div
          className="flex shrink-0 flex-col items-center justify-center rounded-xl w-12 h-[52px]"
          style={{ background: isToday ? '#006b2c' : '#eff4ff' }}
        >
          <span className="text-[9px] font-bold uppercase capitalize" style={{ color: isToday ? 'rgba(255,255,255,0.75)' : '#3e4a3d' }}>
            {dayName}
          </span>
          <span className="text-[20px] font-extrabold leading-none" style={{ color: isToday ? 'white' : '#0b1c30' }}>
            {dayNum}
          </span>
          <span className="text-[9px]" style={{ color: isToday ? 'rgba(255,255,255,0.75)' : '#3e4a3d' }}>
            {monthStr}
          </span>
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <p className="text-[14px] font-extrabold" style={{ color: '#0b1c30' }}>
              {event.startTime} – {event.endTime}
            </p>
            {excluded && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                Falta registrada
              </span>
            )}
            {!event.isPaid && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
                Cuota pendiente
              </span>
            )}
          </div>
          <p className="text-[12px]" style={{ color: '#3e4a3d' }}>
            {event.courtName}
          </p>
          {event.level && (
            <span
              className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: event.level.color }}
            >
              {event.level.name}
            </span>
          )}
          {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={() => setShowDetail(true)}
            className="rounded-xl px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition-colors hover:bg-[#006b2c]/10"
            style={{ border: '1px solid #006b2c', color: '#006b2c' }}
          >
            Ver detalle
          </button>
          {!excluded && event.canRegister && (
            <button
              onClick={handleRegistrar}
              disabled={registering}
              className="rounded-xl px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors hover:bg-orange-50 disabled:opacity-40"
              style={{ border: '1px solid #f97316', color: '#f97316' }}
            >
              {registering ? '...' : 'Registrar falta'}
            </button>
          )}
          {!event.isPaid && (
            <PayButton
              type="fixed_group_month"
              enrollmentId={event.enrollmentId}
              label={`Pagar ${formatCurrency(event.monthlyPrice)}`}
              className="rounded-xl px-3 py-1.5 text-[11px] font-bold text-white whitespace-nowrap disabled:opacity-50 transition-opacity hover:opacity-80 bg-[#006b2c]"
            />
          )}
        </div>
      </div>
    </>
  )
}
