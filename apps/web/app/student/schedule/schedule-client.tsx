'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { PayButton } from '@/components/pay-button'

interface ScheduleItem {
  enrollmentId: string
  monthlyPrice: number
  paidUntil: string | null
  isPaid: boolean
  canRegisterFalta: boolean
  nextDate: string
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

export function StudentScheduleClient({ item, cancellationHours }: { item: ScheduleItem; cancellationHours: number }) {
  const router = useRouter()
  const [exclusions, setExclusions] = useState(item.exclusions)
  const [registering, setRegistering] = useState(false)
  const [faltaError, setFaltaError] = useState('')

  const nextDate = new Date(item.nextDate)
  const nextDateStr = nextDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const alreadyRegistered = exclusions.some(x => x.excluded_date === nextDate.toISOString().split('T')[0])

  async function handleRegistrarFalta() {
    if (!item.canRegisterFalta) return
    if (!confirm(`¿Confirmas que vas a faltar a la clase del ${nextDateStr}? Se te sumará +1 clase disponible.`)) return
    setRegistering(true)
    setFaltaError('')
    const res = await fetch('/api/schedule-exclusions/student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId: item.schedule.id }),
    })
    const json = await res.json()
    if (res.ok) {
      setExclusions(prev => [...prev, { id: json.data.id, excluded_date: json.excludedDate, publish_spot: true }])
      router.refresh()
    } else {
      setFaltaError(json.error ?? 'Error al registrar la falta')
    }
    setRegistering(false)
  }

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
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">{formatCurrency(item.monthlyPrice)}<span className="text-sm font-normal text-gray-400">/mes</span></p>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${item.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {item.isPaid ? '✓ Pagado' : 'Pendiente de pago'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!item.isPaid && (
            <PayButton
              type="fixed_group_month"
              enrollmentId={item.enrollmentId}
              label="💳 Pagar cuota"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            />
          )}

          {alreadyRegistered ? (
            <span className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-400">
              ✓ Falta registrada
            </span>
          ) : (
            <button
              onClick={handleRegistrarFalta}
              disabled={!item.canRegisterFalta || registering}
              title={!item.canRegisterFalta ? `Debes avisar con al menos ${cancellationHours}h de antelación` : ''}
              className="rounded-lg border border-orange-200 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {registering ? '...' : '📋 Registrar falta'}
            </button>
          )}
        </div>

        {!item.canRegisterFalta && !alreadyRegistered && (
          <p className="mt-2 text-xs text-gray-400">
            Necesitas avisar con al menos {cancellationHours}h de antelación para registrar la falta.
          </p>
        )}
        {faltaError && <p className="mt-2 text-xs text-red-600">{faltaError}</p>}
      </div>

      {exclusions.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3">
          <p className="mb-2 text-xs font-medium text-gray-500">Faltas registradas (próximas)</p>
          <div className="flex flex-wrap gap-2">
            {exclusions.map(x => (
              <span key={x.id} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                {new Date(x.excluded_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                {x.publish_spot && <span className="text-green-500">● Plaza libre</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
