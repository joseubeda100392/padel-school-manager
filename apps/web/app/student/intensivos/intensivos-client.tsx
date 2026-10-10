'use client'

import { Check, CircleCheck, Users } from 'lucide-react'
import { PayButton } from '@/components/pay-button'
import { formatLongDate } from '@/lib/format-date'
import { Card } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'

interface IntensivoPack {
  groupId: string
  scheduleIds: string[]
  classDates: string[]
  days: string[]
  startTime: string
  endTime: string
  courtName: string
  coachName: string | null
  maxStudents: number
  level: { name: string; color: string } | null
  totalPriceCents: number
  firstDate: string
  isEnrolled: boolean
  isFull: boolean
}

export function IntensivosClient({ packs, enablePayments = true, cashOnly = false }: { packs: IntensivoPack[]; enablePayments?: boolean; cashOnly?: boolean }) {
  return (
    <div className="space-y-4">
      {packs.map(pack => {
        const weekLabel = formatLongDate(pack.firstDate, { weekday: false })

        return (
          <Card key={pack.groupId} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {pack.isEnrolled ? (
                    <Badge tone="success">
                      <CircleCheck className="h-3.5 w-3.5" aria-hidden />
                      Inscrito
                    </Badge>
                  ) : (
                    <Badge tone="outline">Intensivo</Badge>
                  )}
                  <span className="text-meta tabular-nums text-ink-3">{pack.days.length} clases · {pack.startTime}–{pack.endTime}</span>
                </div>

                <p className="text-heading text-ink">Semana del {weekLabel.toLowerCase()}</p>
                <p className="mt-0.5 text-body text-ink-2">
                  {pack.courtName}
                  {pack.coachName && <span className="text-ink-3"> · {pack.coachName}</span>}
                </p>

                <ul className="mt-3 space-y-1">
                  {pack.days.map((day, i) => (
                    <li key={i} className="flex items-center gap-2 text-body text-ink-2">
                      <span className="w-24 font-medium">{day}</span>
                      <span className="text-ink-3">{formatLongDate(pack.classDates[i], { weekday: false })}</span>
                      {pack.isEnrolled && <Check className="h-4 w-4 text-accent-ink" aria-label="Reservada" />}
                    </li>
                  ))}
                </ul>

                {pack.level && <LevelTag name={pack.level.name} color={pack.level.color} className="mt-3" />}
              </div>

              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
                {pack.isEnrolled ? (
                  <div className="rounded-control border border-accent/30 bg-accent-soft px-5 py-3 text-center">
                    <p className="text-label text-accent-ink">Reservado</p>
                    <p className="mt-0.5 text-meta text-accent-ink">{pack.days.length} clases</p>
                  </div>
                ) : pack.isFull ? (
                  <Badge tone="neutral">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    Completo
                  </Badge>
                ) : (
                  <>
                    <p className="font-display text-title tabular-nums text-ink">{(pack.totalPriceCents / 100).toFixed(2)} €</p>
                    <p className="text-meta text-ink-3">Semana completa</p>
                    {enablePayments ? (
                      <PayButton
                        type="intensivo_group"
                        intensivoGroupId={pack.groupId}
                        classDates={pack.classDates}
                        label="Reservar semana"
                        className={buttonVariants({ variant: 'primary', className: 'w-full sm:w-auto' })}
                        cashOnly={cashOnly}
                      />
                    ) : (
                      <p className="text-meta text-ink-3">Contacta con tu club para inscribirte</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
