'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CalendarX, CircleAlert, CircleCheck, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { formatLongDate, formatShortDay } from '@/lib/format-date'
import { PayButton } from '@/components/pay-button'
import { MonthCalendar } from '@/components/month-calendar'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { EmptyState, Notice } from '@/components/ui/feedback'
import { DateTile, List, ListRow } from '@/components/ui/list'

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
  canAdvance: boolean
  nextMonthLabel: string
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

interface CalendarEvent extends Occurrence {
  enrollmentId: string
  scheduleId: string
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

  const itemsByEnrollment = useMemo(() => Object.fromEntries(items.map(i => [i.enrollmentId, i])), [items])

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  const [todayYear, todayMonth0] = [Number(todayStr.slice(0, 4)), Number(todayStr.slice(5, 7)) - 1]
  const [view, setView] = useState({ year: todayYear, month0: todayMonth0 })

  // Todas las ocurrencias de TODAS las clases, en una sola lista — el
  // calendario no distingue de qué clase es cada una hasta que se selecciona
  // un día concreto.
  const events: CalendarEvent[] = useMemo(() => items.flatMap(item =>
    item.upcomingOccurrences.map(occ => ({ ...occ, enrollmentId: item.enrollmentId, scheduleId: item.schedule.id }))
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

  const confirm = useConfirm()

  async function handleRegistrar(ev: CalendarEvent) {
    if (!ev.canRegister) return
    const ok = await confirm({
      title: `¿No vas a ir el ${formatLongDate(ev.dateStr).toLowerCase()}?`,
      description: 'Tu plaza quedará libre para otro alumno y se te sumará 1 clase a la bolsa para recuperarla otro día.',
      confirmLabel: 'Avisar de que no voy',
    })
    if (!ok) return
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
      toast.success('Hecho: se ha sumado 1 clase a tu bolsa')
      router.refresh()
    } else {
      setError(json.error ?? 'No se ha podido avisar de la falta. Vuelve a intentarlo.')
    }
    setRegistering(null)
  }

  async function handleCancelarFalta(enrollmentId: string, exclusionId: string, dateStr: string) {
    const ok = await confirm({
      title: `¿Al final vas el ${formatLongDate(dateStr).toLowerCase()}?`,
      description: 'Recuperas tu plaza y se descuenta 1 clase de tu bolsa.',
      confirmLabel: 'Sí, voy',
    })
    if (!ok) return
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
      toast.success('Hecho: vuelves a tener tu plaza')
      router.refresh()
    } else {
      setCancelError(json.error ?? 'No se ha podido deshacer la falta. Vuelve a intentarlo.')
    }
    setCanceling(null)
  }

  const allExclusions = useMemo(
    () => items.flatMap(item => (exclusionsByEnrollment[item.enrollmentId] ?? []).map(x => ({ ...x, enrollmentId: item.enrollmentId }))),
    [items, exclusionsByEnrollment]
  )
  const upcomingExclusions = [...allExclusions]
    .filter(x => x.excluded_date >= todayStr)
    .sort((a, b) => a.excluded_date.localeCompare(b.excluded_date))

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-6 lg:sticky lg:top-0">
        <Card className="p-4 sm:p-5">
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
            legend="Días con clase"
          />
        </Card>

        {upcomingExclusions.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader title="Días que no vas" description="Tu plaza queda libre para otro alumno." />
            <List className="mt-3 border-t border-line">
              {upcomingExclusions.map(x => {
                const { weekday, day } = formatShortDay(x.excluded_date)
                return (
                  <ListRow
                    key={x.id}
                    leading={<DateTile weekday={weekday} day={day} />}
                    title={formatLongDate(x.excluded_date)}
                    subtitle={x.publish_spot ? 'Plaza publicada para otros alumnos' : 'Plaza gestionada por el club'}
                    onClick={() => {
                      setSelectedDate(x.excluded_date)
                      setView({ year: Number(x.excluded_date.slice(0, 4)), month0: Number(x.excluded_date.slice(5, 7)) - 1 })
                    }}
                  />
                )
              })}
            </List>
          </Card>
        )}
      </div>

      {selectedDate && (
        <section aria-labelledby="dia-seleccionado" className="space-y-4">
          <h2 id="dia-seleccionado" className="font-display text-title text-ink">{formatLongDate(selectedDate)}</h2>

          {error && <Notice tone="danger" icon={<CircleAlert />}>{error}</Notice>}
          {cancelError && <Notice tone="danger" icon={<CircleAlert />}>{cancelError}</Notice>}

          {selectedEvents.length === 0 ? (
            <Card>
              <EmptyState icon={<CalendarDays />} title="Este día no tienes clase" description="Elige en el calendario un día marcado con un punto." />
            </Card>
          ) : (
            selectedEvents.map(ev => {
              const item = itemsByEnrollment[ev.enrollmentId]
              if (!item) return null
              const registered = (exclusionsByEnrollment[ev.enrollmentId] ?? []).find(x => x.excluded_date === ev.dateStr)
              const busy = registering === `${ev.enrollmentId}-${ev.dateStr}`
              return (
                <Card key={`${ev.enrollmentId}-${ev.dateStr}`} className="overflow-hidden">
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-title tabular-nums text-ink">
                          {ev.overrideTime ?? item.schedule.startTime} – {item.schedule.endTime}
                        </p>
                        <p className="mt-1 text-body text-ink-2">
                          {item.schedule.courtName}
                          {item.schedule.coachName && <> · con {item.schedule.coachName}</>}
                        </p>
                      </div>
                      {item.schedule.level && <LevelTag name={item.schedule.level.name} color={item.schedule.level.color} className="pt-1.5" />}
                    </div>
                    {ev.overrideTime && (
                      <Notice tone="warn" icon={<Clock />} className="mt-3">
                        Este día la clase empieza a las {ev.overrideTime}.
                      </Notice>
                    )}
                  </div>

                  {enablePayments && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
                      <div className="flex items-center gap-2">
                        <span className="text-body text-ink-2">Cuota mensual</span>
                        <span className="text-body font-semibold tabular-nums text-ink">{formatCurrency(item.monthlyPrice)}</span>
                        {item.isPaid
                          ? <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Pagada</Badge>
                          : <Badge tone="warn"><CircleAlert className="h-3.5 w-3.5" aria-hidden />Pendiente</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!item.isPaid && (
                          <PayButton type="fixed_group_month" enrollmentId={item.enrollmentId} label={`Pagar ${formatCurrency(item.monthlyPrice)}`} cashOnly={cashOnly} />
                        )}
                        {item.canAdvance && (
                          <PayButton
                            type="fixed_group_month"
                            enrollmentId={item.enrollmentId}
                            advance
                            variant="secondary"
                            label={`Adelantar ${item.nextMonthLabel.split(' ')[0]}`}
                            cashOnly={cashOnly}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-line bg-surface-2/60 px-4 py-3 sm:px-5">
                    {registered ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="inline-flex items-center gap-2 text-body text-ink-2">
                          <CalendarX className="h-[18px] w-[18px] shrink-0 text-ink-3" aria-hidden />
                          {registered.publish_spot ? 'No vas: tu plaza está publicada' : 'No vas este día'}
                        </p>
                        {ev.dateStr >= todayStr && (
                          <Button variant="secondary" size="sm" onClick={() => handleCancelarFalta(ev.enrollmentId, registered.id, ev.dateStr)} loading={canceling === registered.id}>
                            Al final sí voy
                          </Button>
                        )}
                      </div>
                    ) : ev.canRegister ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-meta text-ink-3">Si no puedes venir, avisa y recupera la clase otro día.</p>
                        <Button variant="secondary" size="sm" onClick={() => handleRegistrar(ev)} loading={busy}>
                          No puedo ir este día
                        </Button>
                      </div>
                    ) : (
                      <p className="text-meta text-ink-3">
                        {ev.dateStr === todayStr
                          ? `Las faltas se avisan con ${cancellationHours} h de antelación: para hoy ya no es posible.`
                          : `Las faltas se avisan con al menos ${cancellationHours} h de antelación.`}
                      </p>
                    )}
                  </div>
                </Card>
              )
            })
          )}
        </section>
      )}
    </div>
  )
}
