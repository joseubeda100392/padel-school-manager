'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import { Badge, LevelTag } from '@/components/ui/badge'

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
// JS getDay: 0=Dom,1=Lun... → map to our index (Mon=0)
const JS_DAY_TO_IDX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }

type RosterEntry = string | { name: string; change: { kind: 'in' | 'out'; date: string } | null }
const entryOf = (x: RosterEntry) => (typeof x === 'string' ? { name: x, change: null } : x)
const shortDate = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`

// Plazas que quedan cuando acabe el mes: los que están, más los que entran,
// menos los que salen.
function freeAtMonthEnd(s: any): number {
  const entries = (s.students as RosterEntry[]).map(entryOf)
  return s.max_students - entries.filter(x => x.change?.kind !== 'out').length
}

// showChanges: el calendario de un mes concreto, con quién entra o sale ese
// mes y las plazas que quedan libres.
export default function MasterWeeklyCalendar({ schedules, readOnly = false, showChanges = false }: { schedules: any[]; readOnly?: boolean; showChanges?: boolean }) {
  const router = useRouter()

  const byDay = useMemo(() => {
    const map: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    schedules.forEach((s) => {
      const idx = JS_DAY_TO_IDX[getDayOfWeek(s.start_time)]
      if (idx !== undefined) map[idx].push(s)
    })
    // Ordenar por hora del día, no por la marca de tiempo completa — los
    // horarios recurrentes conservan la fecha en la que se crearon dentro de
    // start_time, así que comparar el timestamp entero mezclaba el orden
    // según cuándo se dio de alta cada clase en vez de por su hora real.
    const minutesOfDay = (iso: string) => {
      const d = new Date(iso)
      return d.getUTCHours() * 60 + d.getUTCMinutes()
    }
    for (const idx of Object.keys(map)) {
      map[Number(idx)].sort((a, b) => minutesOfDay(a.start_time) - minutesOfDay(b.start_time))
    }
    return map
  }, [schedules])

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-4 xl:grid-cols-7 md:gap-3">
      {DAY_NAMES.map((dayName, idx) => {
        const classes = byDay[idx]
        return (
          <section key={idx} className="min-w-0" aria-label={dayName}>
            <h2 className="mb-2 border-b border-line pb-2 text-label text-ink-2">{dayName}</h2>

            <div className="space-y-2">
              {classes.length === 0 && (
                <p className="rounded-control border border-dashed border-line px-2 py-3 text-center text-meta text-ink-3">Sin clases</p>
              )}
              {classes.map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={readOnly ? undefined : () => router.push(`/dashboard/schedule/${s.id}?from=master`)}
                  disabled={readOnly}
                  className={`w-full rounded-control border p-3 text-left shadow-card transition-colors ${s.forming ? 'border-dashed border-line-strong bg-surface-2' : 'border-line bg-surface'} ${
                    readOnly ? 'cursor-default' : 'hover:border-line-strong'
                  }`}
                >
                  <p className="text-label tabular-nums text-ink">
                    {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  </p>
                  {s.forming && <Badge tone="warn" className="mt-1">En formación · {s.students?.length ?? 0} interesados</Badge>}
                  {showChanges && !s.forming && s.max_students > 0 && (
                    <p className={`mt-0.5 text-meta tabular-nums ${freeAtMonthEnd(s) > 0 ? 'font-medium text-accent-ink' : 'text-ink-3'}`}>
                      {freeAtMonthEnd(s) > 0
                        ? `${freeAtMonthEnd(s)} plaza${freeAtMonthEnd(s) > 1 ? 's' : ''} libre${freeAtMonthEnd(s) > 1 ? 's' : ''} a fin de mes`
                        : 'Completo'}
                    </p>
                  )}
                  <p className="truncate text-meta text-ink-2">{s.coach?.name ?? '—'}</p>
                  {(s.level?.description || s.level?.name) && (
                    <LevelTag name={s.level.description || s.level.name} color={s.level.color} className="mt-1" />
                  )}
                  {s.students?.length > 0 && (
                    <div className="mt-2 divide-y divide-line border-t border-line">
                      {(s.students as RosterEntry[]).map(entryOf).map(({ name, change }, i) => (
                        <p key={i} className="flex items-baseline justify-between gap-2 py-1 text-meta text-ink-2">
                          <span className={`min-w-0 truncate ${change?.kind === 'out' ? 'text-ink-3 line-through decoration-danger-ink/60' : ''}`}>{name}</span>
                          {change && (
                            <span className={`shrink-0 text-[0.6875rem] font-semibold tabular-nums ${change.kind === 'in' ? 'text-accent-ink' : 'text-danger-ink'}`}>
                              {change.kind === 'in' ? `Entra ${shortDate(change.date)}` : `Sale ${shortDate(change.date)}`}
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
