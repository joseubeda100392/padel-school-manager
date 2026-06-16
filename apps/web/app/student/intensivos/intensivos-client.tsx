'use client'

import { PayButton } from '@/components/pay-button'

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

export function IntensivosClient({ packs, enablePayments = true }: { packs: IntensivoPack[]; enablePayments?: boolean }) {
  return (
    <div className="space-y-4">
      {packs.map(pack => {
        const weekLabel = new Date(pack.firstDate + 'T12:00:00').toLocaleDateString('es-ES', {
          day: 'numeric', month: 'long',
        })

        return (
          <div
            key={pack.groupId}
            className={`rounded-xl bg-white shadow-sm p-5 border-l-4 ${pack.isEnrolled ? 'border-green-400' : 'border-purple-400'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {pack.isEnrolled ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">✓ Inscrito</span>
                  ) : (
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">Intensivo</span>
                  )}
                  <span className="text-xs text-gray-400">{pack.days.length} clases · {pack.startTime}–{pack.endTime}</span>
                </div>

                <p className="text-lg font-bold text-gray-900">Semana del {weekLabel}</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  {pack.courtName}
                  {pack.coachName && <span className="text-gray-400"> · {pack.coachName}</span>}
                </p>

                <ul className="mt-3 space-y-1">
                  {pack.days.map((day, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-24 font-medium">{day}</span>
                      <span className="text-gray-400">
                        {new Date(pack.classDates[i] + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                      </span>
                      {pack.isEnrolled && <span className="text-xs text-green-600">✓</span>}
                    </li>
                  ))}
                </ul>

                {pack.level && (
                  <span
                    className="mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: pack.level.color }}
                  >
                    {pack.level.name}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {pack.isEnrolled ? (
                  <div className="rounded-xl bg-green-50 border border-green-100 px-5 py-3 text-center">
                    <p className="text-sm font-semibold text-green-700">Reservado</p>
                    <p className="text-xs text-green-500 mt-0.5">{pack.days.length} clases</p>
                  </div>
                ) : pack.isFull ? (
                  <span className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500">Completo</span>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900">{(pack.totalPriceCents / 100).toFixed(2)} €</p>
                    <p className="text-xs text-gray-400">semana completa</p>
                    {enablePayments ? (
                      <PayButton
                        type="intensivo_group"
                        intensivoGroupId={pack.groupId}
                        classDates={pack.classDates}
                        label="Reservar semana"
                        className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      />
                    ) : (
                      <p className="text-xs text-gray-400">Contacta con tu club para inscribirte</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
