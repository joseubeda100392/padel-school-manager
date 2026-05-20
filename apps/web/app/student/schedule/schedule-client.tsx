'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { PayButton } from '@/components/pay-button'
import { ClassDetailModal } from './class-detail-modal'

interface Occurrence {
  dateStr: string
  label: string
  canRegister: boolean
}

interface ScheduleItem {
  enrollmentId: string
  monthlyPrice: number
  paidUntil: string | null
  isPaid: boolean
  upcomingOccurrences: Occurrence[]
  schedule: {
    id: string
    dayLabel: string
    startTime: string
    endTime: string
    courtName: string
    levelId: string | null
    level: { name: string; color: string } | null
  }
  exclusions: { id: string; excluded_date: string; publish_spot: boolean }[]
}

export function StudentScheduleClient({ item, cancellationHours }: { item: ScheduleItem; cancellationHours: number }) {
  const router = useRouter()
  const [exclusions, setExclusions] = useState(item.exclusions)
  const [showPicker, setShowPicker] = useState(false)
  const [registering, setRegistering] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showDetail, setShowDetail] = useState(false)

  async function handleRegistrar(occ: Occurrence) {
    if (!occ.canRegister) return
    if (!confirm(`¿Confirmas que vas a faltar a la clase del ${occ.label}? Se te sumará +1 clase disponible.`)) return
    setRegistering(occ.dateStr)
    setError('')
    const res = await fetch('/api/schedule-exclusions/student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId: item.schedule.id, date: occ.dateStr }),
    })
    const json = await res.json()
    if (res.ok) {
      setExclusions(prev => [...prev, { id: json.data.id, excluded_date: occ.dateStr, publish_spot: true }])
      setShowPicker(false)
      router.refresh()
    } else {
      setError(json.error ?? 'Error al registrar la falta')
    }
    setRegistering(null)
  }

  const registeredDates = new Set(exclusions.map(x => x.excluded_date))
  const hasAnyAvailable = item.upcomingOccurrences.some(o => o.canRegister && !registeredDates.has(o.dateStr))

  return (
    <>
    <ClassDetailModal
      open={showDetail}
      onClose={() => setShowDetail(false)}
      scheduleId={item.schedule.id}
      levelId={item.schedule.levelId}
      dayLabel={item.schedule.dayLabel}
      startTime={item.schedule.startTime}
      endTime={item.schedule.endTime}
      courtName={item.schedule.courtName}
      level={item.schedule.level}
    />
    <div className="rounded-2xl overflow-hidden transition-shadow hover:shadow-md" style={{background:'rgba(255,255,255,0.85)',backdropFilter:'blur(8px)',border:'1px solid #bdcaba',borderLeft:'4px solid #006b2c'}}>
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-extrabold" style={{color:'#0b1c30'}}>
              {item.schedule.dayLabel} · {item.schedule.startTime} – {item.schedule.endTime}
            </p>
            <p className="mt-0.5 text-[12px]" style={{color:'#3e4a3d'}}>{item.schedule.courtName}</p>
            {item.schedule.level && (
              <span
                className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: item.schedule.level.color }}
              >
                {item.schedule.level.name}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-[15px] font-extrabold text-gray-900">
              {formatCurrency(item.monthlyPrice)}<span className="text-[12px] font-normal text-gray-400">/mes</span>
            </p>
            <span className={`mt-1 inline-block rounded-xl px-2.5 py-1 text-[11px] font-bold ${item.isPaid ? 'bg-[#006b2c]/10 text-[#006b2c]' : 'bg-red-50 text-red-600'}`}>
              {item.isPaid ? '✓ Pagado' : 'Pendiente'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setShowDetail(true)}
            className="rounded-xl border px-4 py-2 text-[12px] font-bold transition-colors hover:bg-[#006b2c]/5"
            style={{ borderColor: '#006b2c', color: '#006b2c' }}
          >
            Ver detalle
          </button>
          {!item.isPaid && (
            <PayButton
              type="fixed_group_month"
              enrollmentId={item.enrollmentId}
              label="Pagar cuota"
              className="rounded-xl bg-[#006b2c] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#005523] disabled:opacity-50 transition-colors"
            />
          )}

          <button
            onClick={() => { setShowPicker(v => !v); setError('') }}
            disabled={!hasAnyAvailable}
            title={!hasAnyAvailable ? `Sin fechas disponibles (mínimo ${cancellationHours}h de antelación)` : ''}
            className="rounded-xl border border-orange-200 px-4 py-2 text-[12px] font-bold text-orange-600 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            Registrar falta
          </button>
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        {showPicker && (
          <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
            <p className="mb-3 text-[12px] font-bold text-orange-700">Selecciona la fecha de la falta:</p>
            <div className="space-y-2">
              {item.upcomingOccurrences.map(occ => {
                const isRegistered = registeredDates.has(occ.dateStr)
                return (
                  <div key={occ.dateStr} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 border border-orange-100">
                    <span className={`text-[13px] capitalize ${!occ.canRegister && !isRegistered ? 'text-gray-300' : 'text-gray-700 font-medium'}`}>
                      {occ.label}
                    </span>
                    {isRegistered ? (
                      <span className="text-[11px] font-bold text-[#006b2c]">✓ Registrada</span>
                    ) : occ.canRegister ? (
                      <button
                        onClick={() => handleRegistrar(occ)}
                        disabled={registering === occ.dateStr}
                        className="rounded-xl bg-orange-500 px-3 py-1 text-[11px] font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                      >
                        {registering === occ.dateStr ? '...' : 'Registrar'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-300">Muy pronto</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {exclusions.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Faltas registradas</p>
          <div className="flex flex-wrap gap-2">
            {exclusions.map(x => (
              <span key={x.id} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] text-gray-600">
                {new Date(x.excluded_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                {x.publish_spot && <span className="ml-1 text-[#006b2c] font-bold">● Libre</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  )
}
