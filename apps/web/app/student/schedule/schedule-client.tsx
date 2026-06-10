'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { PayButton } from '@/components/pay-button'

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
    level: { name: string; color: string } | null
  }
  exclusions: { id: string; excluded_date: string; publish_spot: boolean }[]
}

export function StudentScheduleClient({ item, cancellationHours, enablePayments = true }: { item: ScheduleItem; cancellationHours: number; enablePayments?: boolean }) {
  const router = useRouter()
  const [exclusions, setExclusions] = useState(item.exclusions)
  const [showPicker, setShowPicker] = useState(false)
  const [registering, setRegistering] = useState<string | null>(null)
  const [error, setError] = useState('')

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
    <div className="rounded-xl bg-white shadow-sm">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-gray-900">
              {item.schedule.dayLabel} · {item.schedule.startTime} – {item.schedule.endTime}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">{item.schedule.courtName}</p>
            {item.schedule.level && (
              <span
                className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: item.schedule.level.color }}
              >
                {item.schedule.level.name}
              </span>
            )}
          </div>
          {enablePayments && (
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(item.monthlyPrice)}<span className="text-sm font-normal text-gray-400">/mes</span>
              </p>
              <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${item.isPaid ? 'bg-brand-100 text-brand-600' : 'bg-red-100 text-red-600'}`}>
                {item.isPaid ? '✓ Pagado' : 'Pendiente de pago'}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {enablePayments && !item.isPaid && (
            <PayButton
              type="fixed_group_month"
              enrollmentId={item.enrollmentId}
              label="💳 Pagar cuota"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            />
          )}

          <button
            onClick={() => { setShowPicker(v => !v); setError('') }}
            disabled={!hasAnyAvailable}
            title={!hasAnyAvailable ? `Sin fechas disponibles (mínimo ${cancellationHours}h de antelación)` : ''}
            className="rounded-lg border border-orange-200 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            📋 Registrar falta
          </button>
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        {showPicker && (
          <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-3">
            <p className="mb-3 text-xs font-semibold text-orange-700">Selecciona la fecha de la falta:</p>
            <div className="space-y-2">
              {item.upcomingOccurrences.map(occ => {
                const isRegistered = registeredDates.has(occ.dateStr)
                return (
                  <div key={occ.dateStr} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
                    <span className={`capitalize ${!occ.canRegister && !isRegistered ? 'text-gray-400' : 'text-gray-700'}`}>
                      {occ.label}
                    </span>
                    {isRegistered ? (
                      <span className="text-xs font-medium text-brand-500">✓ Registrada</span>
                    ) : occ.canRegister ? (
                      <button
                        onClick={() => handleRegistrar(occ)}
                        disabled={registering === occ.dateStr}
                        className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        {registering === occ.dateStr ? '...' : 'Registrar'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Muy pronto</span>
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
          <p className="mb-2 text-xs font-medium text-gray-500">Faltas registradas (próximas)</p>
          <div className="flex flex-wrap gap-2">
            {exclusions.map(x => (
              <span key={x.id} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                {new Date(x.excluded_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                {x.publish_spot && <span className="text-brand-500">● Plaza libre</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
