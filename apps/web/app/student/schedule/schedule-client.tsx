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

// Solo la info de la clase (horario, cuota, pago) — sin calendario, ese va
// aparte y es uno solo para todas las clases del alumno.
function ClassSummaryCard({ item, enablePayments, cashOnly }: { item: ScheduleItem; enablePayments: boolean; cashOnly: boolean }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
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
    </div>
  )
}

interface CalendarEvent extends Occurrence {
  enrollmentId: string
  scheduleId: string
  dayLabel: string
  startTime: string
  endTime: string
  courtName: string
  coachName: string | null
  level: { name: string; color: string } | null
}

export function StudentScheduleClient({ items, cancellationHours, enablePayments = true, cashOnly = false }: { items: ScheduleItem[]; cancellationHours: number; enablePayments?: boolean; cashOnly?: boolean }) {
  const router = useRouter()
  const [exclusionsByEnrollment, setExclusionsByEnrollment] = useState<Record<string, ScheduleItem['exclusions']>>(
    () => Object.fromEntries(items.map(i => [i.enrollmentId, i.exclusions]))
  )
  const [registering, setRegistering] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [canceling, setCanceling] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState('')

  const todayStr = new Date().toISOString().split('T')[0]
  const [todayYear, todayMonth0] = [Number(todayStr.slice(0, 4)), Number(todayStr.slice(5, 7)) - 1]
  const [view, setView] = useState({ year: todayYear, month0: todayMonth0 })

  // Todas las ocurrencias de TODAS las clases, en una sola lista — el
  // calendario no distingue de qué clase es cada una hasta que se selecciona
  // un día concreto.
  const events: CalendarEvent[] = useMemo(() => items.flatMap(item =>
    item.upcomingOccurrences.map(occ => ({
      ...occ,
      enrollmentId: item.enrollmentId,
      scheduleId: item.schedule.id,
      dayLabel: item.schedule.dayLabel,
      startTime: item.schedule.startTime,
      endTime: item.schedule.endTime,
      courtName: item.schedule.courtName,
      coachName: item.schedule.coachName,
      level: item.schedule.level,
    }))
  ), [items])

  const [selectedDate, setSelectedDate] = useState<string | null>(
    events.find(e => e.dateStr >= todayStr)?.dateStr ?? null
  )

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of events) counts[e.dateStr] = (counts[e.dateStr] ?? 0) + 1
    return counts
  }, [events])

  const lastEvent = [...events].sort((a, b) => a.dateStr.localeCompare(b.dateStr)).pop()
  const maxYear = lastEvent ? Number(lastEvent.dateStr.slice(0, 4)) : todayYear
  const maxMonth0 = lastEvent ? Number(lastEvent.dateStr.slice(5, 7)) - 1 : todayMonth0

  const selectedEvents = selectedDate ? events.filter(e => e.dateStr === selectedDate) : []
  const selectedLabel = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  async function handleRegistrar(ev: CalendarEvent) {
    if (!ev.canRegister) return
    if (!confirm(`¿Confirmas que vas a faltar a la clase del ${ev.label}? Se te sumará +1 clase disponible.`)) return
    setRegistering(`${ev.enrollmentId}-${ev.dateStr}`)
    setError('')
    const res = await fetch('/api/schedule-exclusions/student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId: ev.scheduleId, date: ev.dateStr }),
    })
    const json = await res.json()
    if (res.ok) {
      setExclusionsByEnrollment(prev => ({
        ...prev,
        [ev.enrollmentId]: [...(prev[ev.enrollmentId] ?? []), { id: json.data.id, excluded_date: ev.dateStr, publish_spot: true }],
      }))
      router.refresh()
    } else {
      setError(json.error ?? 'Error al registrar la falta')
    }
    setRegistering(null)
  }

  async function handleCancelarFalta(enrollmentId: string, exclusionId: string) {
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
      setExclusionsByEnrollment(prev => ({
        ...prev,
        [enrollmentId]: (prev[enrollmentId] ?? []).filter(x => x.id !== exclusionId),
      }))
      router.refresh()
    } else {
      setCancelError(json.error ?? 'Error al cancelar la falta')
    }
    setCanceling(null)
  }

  const allExclusions = useMemo(
    () => items.flatMap(item => (exclusionsByEnrollment[item.enrollmentId] ?? []).map(x => ({ ...x, enrollmentId: item.enrollmentId }))),
    [items, exclusionsByEnrollment]
  )

  return (
    <div className="space-y-4">
      {items.map(item => (
        <ClassSummaryCard key={item.enrollmentId} item={item} enablePayments={enablePayments} cashOnly={cashOnly} />
      ))}

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-gray-700">Marca los días que vas a faltar</p>

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
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium capitalize text-gray-700">{selectedLabel}</p>
            {selectedEvents.length === 0 ? (
              <p className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-400">Ese día no tienes ninguna clase.</p>
            ) : (
              selectedEvents.map(ev => {
                const registered = (exclusionsByEnrollment[ev.enrollmentId] ?? []).find(x => x.excluded_date === ev.dateStr)
                return (
                  <div key={`${ev.enrollmentId}-${ev.dateStr}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{ev.startTime} – {ev.endTime} · {ev.courtName}</p>
                        {ev.level && (
                          <span
                            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: ev.level.color }}
                          >
                            {ev.level.name}
                          </span>
                        )}
                        {ev.overrideTime && (
                          <span className="ml-1.5 text-xs font-normal text-amber-600">⚠️ excepcionalmente a las {ev.overrideTime}</span>
                        )}
                      </div>
                      {registered ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-medium text-brand-500">✓ Registrada</span>
                          {ev.dateStr >= todayStr && (
                            <button
                              onClick={() => handleCancelarFalta(ev.enrollmentId, registered.id)}
                              disabled={canceling === registered.id}
                              className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 hover:bg-white disabled:opacity-40"
                            >
                              {canceling === registered.id ? '...' : 'Cancelar falta'}
                            </button>
                          )}
                        </div>
                      ) : ev.canRegister ? (
                        <button
                          onClick={() => handleRegistrar(ev)}
                          disabled={registering === `${ev.enrollmentId}-${ev.dateStr}`}
                          className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          {registering === `${ev.enrollmentId}-${ev.dateStr}` ? '...' : '📋 Registrar falta'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Muy pronto — mín. {cancellationHours}h</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            {cancelError && <p className="text-xs text-red-600">{cancelError}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
      </div>

      {allExclusions.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-medium text-gray-500">Faltas registradas (próximas)</p>
          <div className="flex flex-wrap gap-2">
            {[...allExclusions].sort((a, b) => a.excluded_date.localeCompare(b.excluded_date)).map(x => (
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
