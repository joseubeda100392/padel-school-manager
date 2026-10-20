'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Field, Select } from '@/components/ui/field'
import { SLOT_MINUTES, classesBySlot, freeCourtsBySlot, timetableRange, type TimetableClass } from '@/lib/timetable'

export interface GridClass extends TimetableClass {
  href: string
  courtName: string
  coachId: string | null
  coachName: string
  level: { name: string; color: string } | null
  occupancy: string
  forming: boolean
  timeChanged: boolean
  alert: string | null // p. ej. "1 plaza por cubrir" o "Sustituye: Ana"
}

export interface GridColumn {
  key: string
  label: string
  dayNumber: number
  isToday: boolean
  isHoliday: boolean
}

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const byCourt = (a: GridClass, b: GridClass) => a.courtName.localeCompare(b.courtName, 'es', { numeric: true })

// Palabras iniciales que comparten todas las pistas ("R3 PISTA 1", "R3 PISTA 2"
// → "R3 "), que se quitan para que el nombre quepa en la tarjeta. Siempre
// quedan las dos últimas ("PISTA 1"), no solo el número.
function sharedCourtPrefix(names: string[]): string {
  const split = [...new Set(names)].map(n => n.split(' '))
  if (split.length < 2) return ''
  let n = 0
  while (split.every(w => w.length > n + 2 && w[n] === split[0][n])) n++
  return n ? split[0].slice(0, n).join(' ') + ' ' : ''
}

// Cuadro por horas de una semana (de 9:00 a 00:00). Cada media hora es una fila
// que crece con lo que tenga: las clases que empiezan en ella van una debajo de
// otra a todo el ancho del día (en un club con 4 clases a la vez no caben una
// al lado de otra) y debajo, las pistas que quedan sin clase en esa franja.
export function TimetableGrid({ columns, classes, courtsCount }: { columns: GridColumn[]; classes: GridClass[]; courtsCount: number }) {
  const [coachId, setCoachId] = useState('')
  const range = useMemo(() => timetableRange(classes), [classes])
  const slots = (range.endMin - range.startMin) / SLOT_MINUTES
  const coaches = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of classes) if (c.coachId) m.set(c.coachId, c.coachName)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [classes])

  const prefix = useMemo(() => sharedCourtPrefix(classes.map(c => c.courtName)), [classes])
  const days = useMemo(() => columns.map((col, dayIndex) => {
    const all = classes.filter(c => c.dayIndex === dayIndex)
    const shown = (coachId ? all.filter(c => c.coachId === coachId) : all).sort(byCourt)
    return {
      col,
      free: col.isHoliday ? [] : freeCourtsBySlot(all, courtsCount, range),
      bySlot: classesBySlot(shown, range),
    }
  }), [columns, classes, courtsCount, range, coachId])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="Monitor" className="w-full sm:w-64">
          <Select value={coachId} onChange={e => setCoachId(e.target.value)}>
            <option value="">Todos los monitores</option>
            {coaches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
        </Field>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-3">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-accent-soft" aria-hidden />Cabe una clase nueva de al menos 1 h empezando a esa hora ({courtsCount} pistas en total; si ya hay clases, pone en cuántas pistas)</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-dashed border-line-strong bg-surface-2" aria-hidden />En formación</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <div className="grid min-w-[980px]" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
          <div className="border-b border-line bg-surface-2" />
          {columns.map(col => (
            <div
              key={col.key}
              aria-current={col.isToday ? 'date' : undefined}
              className={`flex flex-col items-center border-b border-l border-line py-2 ${col.isToday ? 'bg-chrome text-white' : 'bg-surface-2'}`}
            >
              <span className={`text-meta ${col.isToday ? 'text-chrome-ink-2' : 'text-ink-2'}`}>{col.label}</span>
              <span className="font-display text-heading tabular-nums">{col.dayNumber}</span>
              {col.isHoliday && <Badge tone="warn" className="mt-1">Festivo</Badge>}
            </div>
          ))}

          {Array.from({ length: slots }, (_, i) => {
            const m = range.startMin + i * SLOT_MINUTES
            // Línea marcada al cerrar cada hora, suave entre medias horas.
            const rowLine = (m + SLOT_MINUTES) % 60 === 0 ? 'border-line' : 'border-line/40'
            return [
              <div key={`t${i}`} className={`min-h-[26px] border-b pr-2 pt-1 text-right text-meta tabular-nums ${rowLine} ${m % 60 === 0 ? 'text-ink-2' : 'text-ink-3/70'}`}>
                {hhmm(m)}
              </div>,
              ...days.map(({ col, free, bySlot }) => (
                <SlotCell key={`${col.key}-${i}`} classes={bySlot[i]} prefix={prefix} free={free[i]} courtsCount={courtsCount} isHoliday={col.isHoliday} rowLine={rowLine} />
              )),
            ]
          })}
        </div>
      </div>
      <p className="text-meta text-ink-3">"Pista libre" es una pista sin clase de la escuela durante al menos 1 hora desde esa franja. La app no conoce los alquileres de pista que se hagan fuera de ella.</p>
    </div>
  )
}

function SlotCell({ classes, prefix, free, courtsCount, isHoliday, rowLine }: {
  classes: GridClass[]
  prefix: string
  free: number | undefined
  courtsCount: number
  isHoliday: boolean
  rowLine: string
}) {
  const hasFree = free !== undefined && free > 0
  const bg = isHoliday ? 'bg-ink/[0.04]' : hasFree ? 'bg-accent-soft/50' : ''
  return (
    <div className={`flex min-h-[26px] flex-col gap-1 border-b border-l p-1 ${rowLine} ${bg}`}>
      {classes.map(c => <ClassCard key={c.id} c={c} court={c.courtName.slice(prefix.length)} />)}
      {/* Solo se escribe cuando a esa hora ya hay clases: ahí es donde
          interesa saber cuántas pistas quedan para abrir otro grupo. */}
      {hasFree && free < courtsCount && (
        <span className="text-right text-[0.6875rem] font-semibold leading-tight text-accent-ink">
          {free === 1 ? '1 pista libre' : `${free} pistas libres`}
        </span>
      )}
    </div>
  )
}

function ClassCard({ c, court }: { c: GridClass; court: string }) {
  return (
    <Link
      href={c.href}
      title={`${hhmm(c.startMin)}–${hhmm(c.endMin)} · ${c.courtName} · ${c.coachName}${c.level ? ` · ${c.level.name}` : ''} · ${c.occupancy}${c.alert ? ` · ${c.alert}` : ''}`}
      style={{ borderLeftColor: c.level?.color ?? undefined }}
      className={`block rounded-[6px] border border-l-4 px-1.5 py-1 text-left shadow-card transition-colors hover:border-line-strong ${
        c.forming ? 'border-dashed border-line-strong bg-surface-2' : 'border-line bg-surface'
      }`}
    >
      <p className="flex items-center gap-1 text-[0.6875rem] font-semibold tabular-nums text-ink">
        <span className="truncate">{hhmm(c.startMin)}–{hhmm(c.endMin)} · {court}</span>
        {c.timeChanged && <TriangleAlert className="h-3 w-3 shrink-0 text-warn-ink" aria-label="Horario cambiado ese día" />}
        {c.alert && <span className="h-2 w-2 shrink-0 rounded-full bg-danger-ink" role="img" aria-label={c.alert} />}
      </p>
      <p className="truncate text-[0.6875rem] text-ink-2">{c.coachName}{c.level ? ` · ${c.level.name}` : ''}</p>
      <p className={`truncate text-[0.6875rem] tabular-nums ${c.forming ? 'text-warn-ink' : 'text-ink-3'}`}>{c.occupancy}</p>
      {c.alert && <p className="truncate text-[0.6875rem] font-medium text-danger-ink">{c.alert}</p>}
    </Link>
  )
}
