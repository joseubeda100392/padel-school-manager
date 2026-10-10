'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PayButton } from '@/components/pay-button'
import { MonthCalendar } from '@/components/month-calendar'
import { CircleCheck, Package, Zap } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatLongDate } from '@/lib/format-date'
import { Card } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'
import { EmptyState, Notice } from '@/components/ui/feedback'

interface Spot {
  spotType: 'absence' | 'capacity'
  exclusionId: string | null
  excludedDate: string
  scheduleId: string
  scheduleType?: 'regular' | 'intensivo'
  schedulePriceCents?: number | null
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

function SpotCard({ spot, balance60, balance90, enablePayments = true, enable60min = true, enable90min = true, cashOnly = false, payPerClassPrice60, payPerClassPrice90, wholeClassPrice60, wholeClassPrice90 }: { spot: Spot; balance60: number; balance90: number; enablePayments?: boolean; enable60min?: boolean; enable90min?: boolean; cashOnly?: boolean; payPerClassPrice60: number; payPerClassPrice90: number; wholeClassPrice60: number; wholeClassPrice90: number }) {
  const router = useRouter()
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [error, setError] = useState('')
  const confirm = useConfirm()

  const dateLabel = new Date(spot.excludedDate + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const freePlaces = spot.enrolledCount !== null ? spot.maxStudents - spot.enrolledCount : 1
  const durationType: '60' | '90' = spot.durationMin >= 80 ? '90' : '60'
  const isIntensivo = spot.scheduleType === 'intensivo'
  const hasBalance = !isIntensivo && (durationType === '90'
    ? balance90 > 0
    : balance60 > 0 || balance90 > 0)

  // Mismo criterio de prioridad que /api/payments/create-order: un precio
  // propio del horario (schedulePriceCents, ej. intensivos) manda sobre la
  // tarifa general del club — así el precio mostrado aquí siempre coincide
  // con el que de verdad se cobra al pulsar el botón.
  const singleClassPriceCents = spot.schedulePriceCents && spot.schedulePriceCents > 0
    ? spot.schedulePriceCents
    : (durationType === '90' ? payPerClassPrice90 : payPerClassPrice60)
  const wholeClassPriceCents = spot.schedulePriceCents && spot.schedulePriceCents > 0
    ? spot.schedulePriceCents
    : (durationType === '90' ? wholeClassPrice90 : wholeClassPrice60)

  async function handleUseBag() {
    if (!(await confirm({ title: '¿Usar 1 clase de tu bolsa?', description: `Te apuntas el ${dateLabel} de ${spot.startTime} a ${spot.endTime} en ${spot.courtName}.`, confirmLabel: 'Apuntarme' }))) return
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
      setError(json.error ?? 'No se ha podido reservar. Vuelve a intentarlo.')
    }
    setBooking(false)
  }

  if (booked) {
    return (
      <Card className="border-accent/40 bg-accent-soft/60 p-4 sm:p-5">
        <p className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-accent-ink">
          <CircleCheck className="h-5 w-5" aria-hidden />
          Te has apuntado
        </p>
        <p className="mt-1 text-body tabular-nums text-ink-2">
          {formatLongDate(spot.excludedDate)} · {spot.startTime} – {spot.endTime} · {spot.courtName}
        </p>
      </Card>
    )
  }

  const bagMismatch = !hasBalance && enable90min && durationType === '90' && balance60 > 0

  return (
    <Card className="overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-title tabular-nums text-ink">{spot.startTime} – {spot.endTime}</p>
            <p className="mt-1 text-body text-ink-2">
              {spot.courtName}
              {spot.coachName && <> · con {spot.coachName}</>}
            </p>
          </div>
          {spot.level && <LevelTag name={spot.level.name} color={spot.level.color} className="pt-1.5" />}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="success">
            {freePlaces} {freePlaces === 1 ? 'plaza libre' : 'plazas libres'}
            {spot.enrolledCount !== null && <span className="font-normal"> · {spot.enrolledCount}/{spot.maxStudents}</span>}
          </Badge>
          <span className="text-meta text-ink-3">
            {spot.spotType === 'absence' ? 'Un alumno del grupo no viene ese día' : 'El grupo tiene sitio'}
          </span>
          {isIntensivo && <Badge tone="outline">Intensivo</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-4 py-3 sm:px-5">
        {hasBalance ? (
          <Button onClick={handleUseBag} loading={booking} block className="sm:w-auto">
            Apuntarme con 1 clase de la bolsa
          </Button>
        ) : enablePayments ? (
          <>
            {(bagMismatch || (!isIntensivo && balance60 === 0 && balance90 === 0)) && (
              <p className="mr-auto text-meta text-ink-3">
                {bagMismatch ? 'Tus clases de bolsa son de 1 h y esta dura 1 h 30.' : 'No tienes clases en la bolsa.'}
              </p>
            )}
            {!isIntensivo && spot.spotType === 'capacity' && spot.maxStudents > 1 && spot.enrolledCount === 0 && (
              // Solo clase suelta de verdad: sin alumnos de grupo fijo ya inscritos.
              <PayButton
                type="single_class"
                scheduleId={spot.scheduleId}
                exclusionId={spot.exclusionId ?? undefined}
                classDate={spot.excludedDate}
                wholeClass
                variant="secondary"
                label={`Pista entera · ${formatCurrency(wholeClassPriceCents)}`}
                cashOnly={cashOnly}
              />
            )}
            <PayButton
              type="single_class"
              scheduleId={spot.scheduleId}
              exclusionId={spot.exclusionId ?? undefined}
              classDate={spot.excludedDate}
              label={`Pagar mi plaza · ${formatCurrency(singleClassPriceCents)}`}
              cashOnly={cashOnly}
            />
          </>
        ) : (
          <p className="text-meta text-ink-3">
            {bagMismatch ? 'Tus clases de bolsa son de 1 h y esta dura 1 h 30.' : 'Necesitas una clase en la bolsa para apuntarte.'}
          </p>
        )}
      </div>
      {error && <p role="alert" className="px-4 pb-3 text-meta font-medium text-danger-ink sm:px-5">{error}</p>}
    </Card>
  )
}

export function SpotsClient({
  spots,
  balance60,
  balance90,
  enablePayments = true,
  enable60min = true,
  enable90min = true,
  cashOnly = false,
  payPerClassPrice60,
  payPerClassPrice90,
  wholeClassPrice60,
  wholeClassPrice90,
  year,
  month0,
  todayStr,
  maxYear,
  maxMonth0,
}: {
  spots: Spot[]
  balance60: number
  balance90: number
  enablePayments?: boolean
  enable60min?: boolean
  enable90min?: boolean
  cashOnly?: boolean
  payPerClassPrice60: number
  payPerClassPrice90: number
  wholeClassPrice60: number
  wholeClassPrice90: number
  year: number
  month0: number
  todayStr: string
  maxYear: number
  maxMonth0: number
}) {
  const visibleBalance = (enable60min ? balance60 : 0) + (enable90min ? balance90 : 0)

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of spots) counts[s.excludedDate] = (counts[s.excludedDate] ?? 0) + 1
    return counts
  }, [spots])

  const defaultDate = useMemo(() => {
    const isCurrentMonth = year === Number(todayStr.slice(0, 4)) && month0 === Number(todayStr.slice(5, 7)) - 1
    if (isCurrentMonth && eventCounts[todayStr]) return todayStr
    const firstWithEvents = spots.map(s => s.excludedDate).sort()[0]
    return firstWithEvents ?? (isCurrentMonth ? todayStr : `${year}-${String(month0 + 1).padStart(2, '0')}-01`)
  }, [spots, eventCounts, year, month0, todayStr])

  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const daySpots = spots.filter(s => s.excludedDate === selectedDate)
  const bagParts = [
    enable60min && balance60 > 0 && `${balance60} ${balance60 === 1 ? 'clase' : 'clases'} de 1 h`,
    enable90min && balance90 > 0 && `${balance90} ${balance90 === 1 ? 'clase' : 'clases'} de 1 h 30`,
  ].filter(Boolean)

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-4 lg:sticky lg:top-0">
        {visibleBalance > 0 && (
          <Notice tone="success" icon={<Package />}>
            Tienes {bagParts.join(' y ')} en la bolsa. {visibleBalance === 1 ? 'Úsala' : 'Úsalas'} para apuntarte a un hueco.
          </Notice>
        )}
        <Card className="p-4 sm:p-5">
          <MonthCalendar
            year={year}
            month0={month0}
            basePath="/student/spots"
            eventCounts={eventCounts}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            todayStr={todayStr}
            maxYear={maxYear}
            maxMonth0={maxMonth0}
            eventLabel={['hueco', 'huecos']}
            legend="Días con huecos libres de tu nivel"
          />
        </Card>
      </div>

      <section aria-labelledby="huecos-dia" className="space-y-4">
        <h2 id="huecos-dia" className="font-display text-title text-ink">{formatLongDate(selectedDate)}</h2>
        {daySpots.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Zap />}
              title="Este día no hay huecos"
              description={spots.length > 0 ? 'Elige en el calendario un día marcado con un punto.' : 'Ahora mismo no hay plazas libres de tu nivel este mes.'}
            />
          </Card>
        ) : (
          daySpots.map(spot => (
            <SpotCard
              key={`${spot.spotType}-${spot.exclusionId ?? spot.scheduleId}-${spot.excludedDate}`}
              spot={spot}
              balance60={balance60}
              balance90={balance90}
              enablePayments={enablePayments}
              enable60min={enable60min}
              enable90min={enable90min}
              cashOnly={cashOnly}
              payPerClassPrice60={payPerClassPrice60}
              payPerClassPrice90={payPerClassPrice90}
              wholeClassPrice60={wholeClassPrice60}
              wholeClassPrice90={wholeClassPrice90}
            />
          ))
        )}
      </section>
    </div>
  )
}
