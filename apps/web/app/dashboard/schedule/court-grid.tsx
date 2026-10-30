'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SLOT_MINUTES } from '@/lib/timetable'
import { courtBlocks, courtColumns, courtGridRange } from '@/lib/court-grid'
import { hhmm, type GridClass, type GridColumn } from './timetable-grid'

const HEADER_ROWS = 2
// Estrecho para que una semana de 9-10 pistas quepa en un portátil sin
// desplazarse; el texto de las tarjetas pasa de línea. Los días sin clases
// (festivo, antes de empezar) solo ocupan lo justo para su cabecera.
const COLUMN_MIN_PX = 84
const EMPTY_COLUMN_PX = 64
const TIME_COLUMN_PX = 48

// Cuadrante de una semana: una columna por día y pista (solo las pistas con
// clases ese día) y cada grupo ocupando sus medias horas, con nivel, alumnos y
// monitor, como el Excel con el que muchos clubs organizan la escuela.
export function CourtGrid({ columns, classes, schoolDays }: { columns: GridColumn[]; classes: GridClass[]; schoolDays: number[] }) {
  const range = useMemo(() => courtGridRange(classes), [classes])
  const slots = (range.endMin - range.startMin) / SLOT_MINUTES
  const cols = useMemo(
    () => courtColumns(columns.map((c, dayIndex) => ({ dayIndex, isHoliday: c.isHoliday })), classes, new Set(schoolDays)),
    [columns, classes, schoolDays],
  )
  const blocks = useMemo(() => cols.map(col => col.courtName === null
    ? []
    : courtBlocks(classes.filter(c => c.dayIndex === col.dayIndex && (c.courtId ?? c.courtName) === (col.courtId ?? col.courtName)), range),
  ), [cols, classes, range])

  if (!cols.length) {
    return <p className="rounded-card border border-dashed border-line px-4 py-8 text-center text-meta text-ink-3">No hay clases esta semana.</p>
  }

  const gridRow = (slot: number) => slot + HEADER_ROWS + 1
  const colWidths = cols.map(c => (c.courtName === null ? `${EMPTY_COLUMN_PX}px` : `minmax(${COLUMN_MIN_PX}px, 1fr)`))
  const minWidth = TIME_COLUMN_PX + cols.reduce((sum, c) => sum + (c.courtName === null ? EMPTY_COLUMN_PX : COLUMN_MIN_PX), 0)
  const colLine = (i: number) => (cols[i].firstOfDay ? 'border-l-2 border-l-line-strong' : 'border-l border-l-line')

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${TIME_COLUMN_PX}px ${colWidths.join(' ')}`,
          gridTemplateRows: `auto auto repeat(${slots}, minmax(30px, auto))`,
          minWidth,
        }}
      >
        <div className="sticky left-0 z-20 border-b border-line bg-surface-2" style={{ gridColumn: 1, gridRow: '1 / 3' }} />

        {cols.map((col, i) => {
          if (!col.firstOfDay) return null
          const day = columns[col.dayIndex]
          return (
            <div
              key={`d${col.key}`}
              aria-current={day.isToday ? 'date' : undefined}
              style={{ gridColumn: `${i + 2} / span ${col.daySpan}`, gridRow: 1 }}
              className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-l-2 border-l-line-strong px-1 py-1.5 ${day.isToday ? 'bg-chrome text-white' : 'bg-surface-2 text-ink'}`}
            >
              <span className={`text-label ${day.isToday ? 'text-chrome-ink-2' : 'text-ink-2'}`}>{day.label}</span>
              <span className="font-display text-heading tabular-nums">{day.dayNumber}</span>
              {day.isHoliday && <Badge tone="warn">Festivo</Badge>}
            </div>
          )
        })}

        {cols.map((col, i) => (
          <div
            key={`c${col.key}`}
            style={{ gridColumn: i + 2, gridRow: 2 }}
            className={`truncate border-b border-line bg-surface-2 px-1 pb-1.5 text-center text-meta font-semibold text-ink-2 ${colLine(i)}`}
          >
            {col.courtName ?? (columns[col.dayIndex].isHoliday ? '' : 'Sin clases')}
          </div>
        ))}

        {Array.from({ length: slots }, (_, s) => {
          const m = range.startMin + s * SLOT_MINUTES
          // Línea marcada al cerrar cada hora, suave entre medias horas.
          const rowLine = (m + SLOT_MINUTES) % 60 === 0 ? 'border-b-line' : 'border-b-line/40'
          return [
            <div
              key={`t${s}`}
              style={{ gridColumn: 1, gridRow: gridRow(s) }}
              className={`sticky left-0 z-10 border-b bg-surface pr-1.5 pt-1 text-right text-meta tabular-nums ${rowLine} ${m % 60 === 0 ? 'text-ink-2' : 'text-ink-3/70'}`}
            >
              {hhmm(m)}
            </div>,
            ...cols.map((col, i) => (
              <div
                key={`b${col.key}-${s}`}
                style={{ gridColumn: i + 2, gridRow: gridRow(s) }}
                className={`border-b ${rowLine} ${colLine(i)} ${columns[col.dayIndex].isHoliday ? 'bg-ink/[0.04]' : ''}`}
              />
            )),
          ]
        })}

        {blocks.flatMap((colBlocks, i) => colBlocks.map(b => (
          <div
            key={`k${cols[i].key}-${b.firstSlot}`}
            style={{ gridColumn: i + 2, gridRow: `${gridRow(b.firstSlot)} / ${gridRow(b.lastSlot)}` }}
            className="relative z-[1] flex min-w-0 flex-col gap-1 p-0.5"
          >
            {b.classes.map(c => <CourtCard key={c.id} c={c} />)}
          </div>
        )))}
      </div>
    </div>
  )
}

function CourtCard({ c }: { c: GridClass }) {
  const people = c.forming ? c.occupancy : c.students.length ? c.students.join(', ') : 'Sin alumnos'
  return (
    <Link
      href={c.href}
      title={`${c.code ? `${c.code} · ` : ''}${hhmm(c.startMin)}–${hhmm(c.endMin)} · ${c.courtName} · ${c.coachName}${c.level ? ` · ${c.level.name}` : ''} · ${c.occupancy}${c.alert ? ` · ${c.alert}` : ''}`}
      style={{ borderLeftColor: c.level?.color ?? undefined }}
      className={`flex min-w-0 flex-1 flex-col gap-0.5 break-words rounded-[6px] border border-l-[3px] px-1 py-1 text-left shadow-card transition-colors hover:border-line-strong ${
        c.forming ? 'border-dashed border-line-strong bg-surface-2' : 'border-line bg-surface'
      }`}
    >
      <p className="flex flex-wrap items-center gap-x-1 text-[0.6875rem] font-semibold leading-snug tabular-nums text-ink">
        {c.code && <span className="rounded-[4px] bg-ink px-1 text-white">{c.code}</span>}
        <span>{hhmm(c.startMin)}–{hhmm(c.endMin)}{c.level ? ` · ${c.level.name}` : ''}</span>
        {c.timeChanged && <TriangleAlert className="h-3 w-3 shrink-0 text-warn-ink" aria-label="Horario cambiado ese día" />}
        {c.alert && <span className="h-2 w-2 shrink-0 rounded-full bg-danger-ink" role="img" aria-label={c.alert} />}
      </p>
      <p className={`text-[0.6875rem] leading-snug ${c.forming ? 'text-warn-ink' : 'text-ink-2'}`}>{people}</p>
      <p className="text-[0.6875rem] leading-snug text-ink-3">{c.coachName}{c.forming ? '' : ` · ${c.occupancy}`}</p>
      {c.alert && <p className="text-[0.6875rem] font-medium text-danger-ink">{c.alert}</p>}
    </Link>
  )
}
