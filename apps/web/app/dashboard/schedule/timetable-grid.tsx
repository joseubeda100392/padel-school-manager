'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Field, Select } from '@/components/ui/field'
import { SLOT_MINUTES, freeCourtsBySlot, placeDay, timetableRange, type TimetableClass } from '@/lib/timetable'

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

const SLOT_H = 44 // px por media hora
const FREE_GUTTER = 46 // px a la derecha de cada día para el número de pistas libres
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// Cuadro por horas de una semana (de 9:00 a 00:00): cada clase en su franja,
// las que coinciden una al lado de otra y, en cada media hora, las pistas que
// quedan sin clase para ver dónde cabe un grupo nuevo.
export function TimetableGrid({ columns, classes, courtsCount }: { columns: GridColumn[]; classes: GridClass[]; courtsCount: number }) {
  const [coachId, setCoachId] = useState('')
  const range = useMemo(() => timetableRange(classes), [classes])
  const slots = (range.endMin - range.startMin) / SLOT_MINUTES
  const coaches = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of classes) if (c.coachId) m.set(c.coachId, c.coachName)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [classes])

  const days = useMemo(() => columns.map((col, dayIndex) => {
    const all = classes.filter(c => c.dayIndex === dayIndex)
    return {
      col,
      free: col.isHoliday ? [] : freeCourtsBySlot(all, courtsCount, range),
      placed: placeDay(coachId ? all.filter(c => c.coachId === coachId) : all),
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
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-accent-soft" aria-hidden />Hay pistas libres ({courtsCount} en total; si ya hay clases a esa hora, pone cuántas quedan)</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-dashed border-line-strong bg-surface-2" aria-hidden />En formación</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <div className="grid min-w-[980px]" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
          <div className="border-b border-line" />
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

          <div>
            {Array.from({ length: slots }, (_, i) => {
              const m = range.startMin + i * SLOT_MINUTES
              return (
                <div key={i} style={{ height: SLOT_H }} className="border-b border-line/60 pr-2 text-right text-meta tabular-nums text-ink-3">
                  {m % 60 === 0 ? hhmm(m) : ''}
                </div>
              )
            })}
          </div>

          {days.map(({ col, free, placed }) => (
            <div key={col.key} className={`relative border-l border-line ${col.isHoliday ? 'bg-ink/[0.04]' : ''}`} style={{ height: slots * SLOT_H }}>
              {free.map((n, i) => (
                <div key={i} style={{ top: i * SLOT_H, height: SLOT_H }} className={`absolute inset-x-0 border-b border-line/60 ${n > 0 ? 'bg-accent-soft/50' : ''}`}>
                  {/* Solo se escribe cuando a esa hora ya hay clases: ahí es donde
                      interesa saber cuántas pistas quedan para abrir otro grupo. */}
                  {n > 0 && n < courtsCount && (
                    <span className="absolute right-0.5 top-0.5 w-[42px] text-center text-[0.6875rem] font-semibold leading-tight text-accent-ink">{n}<br />{n === 1 ? 'libre' : 'libres'}</span>
                  )}
                </div>
              ))}
              {col.isHoliday && Array.from({ length: slots }, (_, i) => (
                <div key={i} style={{ top: i * SLOT_H, height: SLOT_H }} className="absolute inset-x-0 border-b border-line/60" />
              ))}

              {placed.map(({ item: c, lane, lanes }) => (
                <Link
                  key={c.id}
                  href={c.href}
                  title={`${hhmm(c.startMin)}–${hhmm(c.endMin)} · ${c.courtName} · ${c.coachName}${c.level ? ` · ${c.level.name}` : ''} · ${c.occupancy}${c.alert ? ` · ${c.alert}` : ''}`}
                  style={{
                    top: ((c.startMin - range.startMin) / SLOT_MINUTES) * SLOT_H + 1,
                    height: ((c.endMin - c.startMin) / SLOT_MINUTES) * SLOT_H - 2,
                    // Se deja libre un margen a la derecha para el "N libres".
                    left: `calc((100% - ${FREE_GUTTER}px) * ${lane / lanes} + 2px)`,
                    width: `calc((100% - ${FREE_GUTTER}px) / ${lanes} - 4px)`,
                    borderLeftColor: c.level?.color ?? undefined,
                  }}
                  className={`absolute z-[1] overflow-hidden rounded-[6px] border border-l-4 px-1.5 py-1 text-left shadow-card transition-colors hover:border-line-strong ${
                    c.forming ? 'border-dashed border-line-strong bg-surface-2' : 'border-line bg-surface'
                  }`}
                >
                  <p className="flex items-center gap-1 truncate text-[0.6875rem] font-semibold tabular-nums text-ink">
                    {hhmm(c.startMin)}–{hhmm(c.endMin)}
                    {c.timeChanged && <TriangleAlert className="h-3 w-3 shrink-0 text-warn-ink" aria-label="Horario cambiado ese día" />}
                    {c.alert && <span className="h-2 w-2 shrink-0 rounded-full bg-danger-ink" role="img" aria-label={c.alert} />}
                  </p>
                  <p className="truncate text-[0.6875rem] text-ink-2">{c.courtName}</p>
                  <p className="truncate text-[0.6875rem] text-ink-3">{c.coachName}</p>
                  <p className={`truncate text-[0.6875rem] tabular-nums ${c.forming ? 'text-warn-ink' : 'text-ink-3'}`}>{c.occupancy}</p>
                  {c.alert && <p className="truncate text-[0.6875rem] font-medium text-danger-ink">{c.alert}</p>}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-meta text-ink-3">"Libre" es sin clase de la escuela a esa hora: la app no conoce los alquileres de pista que se hagan fuera de ella.</p>
    </div>
  )
}
