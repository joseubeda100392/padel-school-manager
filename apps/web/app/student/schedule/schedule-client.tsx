'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { PayButton } from '@/components/pay-button'
import { MonthCalendar } from '@/components/month-calendar'

interface Occurrence {
  dateStr: string
  label: string
  canRegister: boolean
  overrideTime: string | null
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
    coachName: string | null
    level: { name: string; color: string } | null
  }
  exclusions: { id: string; excluded_date: string; publish_spot: boolean }[]
}

export function StudentScheduleClient({ item, cancellationHours, enablePayments = true, cashOnly = false }: { item: ScheduleItem; cancellationHours: number; enablePayments?: boolean; cashOnly?: boolean }) {
  const router = useRouter()
  const [exclusions, setExclusions] = useState(item.exclusions)
  const [registering, setRegistering] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [canceling, setCanceling] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState('')

  const todayStr = new Date().toISOString().split('T')[0]
  const [todayYear, todayMonth0] = [Number(todayStr.slice(0, 4)), Number(todayStr.slice(5, 7)) - 1]
  const [view, setView] = useState({ year: todayYear, month0: todayMonth0 })
  const [selectedDate, setSelectedDate] = useState<string | null>(
    item.upcomingOccurrences.find(o => o.dateStr >= todayStr)?.dateStr ?? null
  )

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
      router.refresh()
    } else {
      setError(json.error ?? 'Error al registrar la falta')
    }
    setRegistering(null)
  }

  async function handleCancelarFalta(exclusionId: string) {
    if (!confirm('¿Cancelar esta falta? Se descontará 1 clase de tu bolsa.')) return
    setCanceling(exclusionId)
    setCancelError('')
    const res = await fetch('/api/schedule-exclusions/student', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exclusionId }),
    })
    const json = await res.json()
    if (res.ok) {
      setExclusions(prev => prev.filter(x => x.id !== exclusionId))
      router.refresh()
    } else {
      setCancelError(json.error ?? 'Error al cancelar la falta')
    }
    setCanceling(null)
  }

  const registeredByDate = useMemo(() => {
    const map: Record<string, { id: string; publish_spot: boolean }> = {}
    for (const x of exclusions) map[x.excluded_date] = { id: x.id, publish_spot: x.publish_spot }
    return map
  }, [exclusions])

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const occ of item.upcomingOccurrences) counts[occ.dateStr] = 1
    return counts
  }, [item.upcomingOccurrences])

  const lastOccurrence = item.upcomingOccurrences[item.upcomingOccurrences.length - 1]
  const maxYear = lastOccurrence ? Number(lastOccurrence.dateStr.slice(0, 4)) : todayYear
  const maxMonth0 = lastOccurrence ? Number(lastOccurrence.dateStr.slice(5, 7)) - 1 : todayMonth0

  const selectedOccurrence = selectedDate ? item.upcomingOccurrences.find(o => o.dateStr === selectedDate) : undefined
  const selectedRegistered = selectedDate ? registeredByDate[selectedDate] : undefined
  const selectedLabel = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-gray-900">
              {item.schedule.dayLabel} · {item.schedule.startTime} – {item.schedule.endTime}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              {item.schedule.courtName}{item.schedule.coachName ? ` · Monitor: ${item.schedule.coachName}` : ''}
            </p>
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

        {enablePayments && !item.isPaid && (
          <div className="mt-4">
            <PayButton
              type="fixed_group_month"
              enrollmentId={item.enrollmentId}
              label="💳 Pagar cuota"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              cashOnly={cashOnly}
            />
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-gray-500">Marca los días que vas a faltar:</p>
          <MonthCalendar
            year={view.year}
            month0={view.month0}
            onNavigate={(year, month0) => setView({ year, month0 })}
            eventCounts={eventCounts}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            todayStr={todayStr}
            maxYear={maxYear}
            maxMonth0={maxMonth0}
            minYear={todayYear}
            minMonth0={todayMonth0}
          />

          {selectedDate && (
            <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="mb-2 text-sm font-medium capitalize text-gray-700">
                {selectedLabel}
                {selectedOccurrence?.overrideTime && (
                  <span className="ml-1.5 text-xs font-normal text-amber-600">⚠️ excepcionalmente a las {selectedOccurrence.overrideTime}</span>
                )}
              </p>
              {selectedRegistered ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-500">✓ Falta registrada{selectedRegistered.publish_spot ? ' · plaza libre publicada' : ''}</span>
                  {selectedDate >= todayStr && (
                    <button
                      onClick={() => handleCancelarFalta(selectedRegistered.id)}
                      disabled={canceling === selectedRegistered.id}
                      className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 hover:bg-white disabled:opacity-40"
                    >
                      {canceling === selectedRegistered.id ? '...' : 'Cancelar falta'}
                    </button>
                  )}
                </div>
              ) : selectedOccurrence ? (
                selectedOccurrence.canRegister ? (
                  <button
                    onClick={() => handleRegistrar(selectedOccurrence)}
                    disabled={registering === selectedOccurrence.dateStr}
                    className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {registering === selectedOccurrence.dateStr ? '...' : '📋 Registrar falta este día'}
                  </button>
                ) : (
                  <p className="text-xs text-gray-400">Muy pronto — mínimo {cancellationHours}h de antelación</p>
                )
              ) : (
                <p className="text-xs text-gray-400">Ese día no tienes esta clase</p>
              )}
              {cancelError && <p className="mt-2 text-xs text-red-600">{cancelError}</p>}
            </div>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      {exclusions.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3">
          <p className="mb-2 text-xs font-medium text-gray-500">Faltas registradas (próximas)</p>
          <div className="flex flex-wrap gap-2">
            {[...exclusions].sort((a, b) => a.excluded_date.localeCompare(b.excluded_date)).map(x => (
              <button
                key={x.id}
                onClick={() => {
                  setSelectedDate(x.excluded_date)
                  setView({ year: Number(x.excluded_date.slice(0, 4)), month0: Number(x.excluded_date.slice(5, 7)) - 1 })
                }}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                {new Date(x.excluded_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                {x.publish_spot && <span className="text-brand-500">● Plaza libre</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
