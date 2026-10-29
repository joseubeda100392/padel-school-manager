// Cuadrante (Clases → Cuadrante): como el Excel de un club, una columna por
// día y pista, y cada grupo ocupando las medias horas que dura.

import { SLOT_MINUTES } from '@/lib/timetable'

export interface CourtGridClass {
  id: string
  dayIndex: number // 0 = lunes … 6 = domingo
  courtId: string | null
  courtName: string
  startMin: number
  endMin: number
}

export interface CourtColumn {
  key: string
  dayIndex: number
  courtId: string | null
  courtName: string | null // null: día de escuela sin clases (festivo o aún sin empezar)
  firstOfDay: boolean
  daySpan: number
}

export interface CourtBlock<T> {
  firstSlot: number
  lastSlot: number // sin incluir
  classes: T[]
}

const DEFAULT_RANGE = { startMin: 9 * 60, endMin: 22 * 60 }

// Solo las horas con clases de la semana: el cuadrante tiene muchas columnas
// y no tiene sentido enseñar las mañanas vacías.
export function courtGridRange(classes: { startMin: number; endMin: number }[]): { startMin: number; endMin: number } {
  if (!classes.length) return DEFAULT_RANGE
  return {
    startMin: Math.floor(Math.min(...classes.map(c => c.startMin)) / SLOT_MINUTES) * SLOT_MINUTES,
    endMin: Math.ceil(Math.max(...classes.map(c => c.endMin)) / SLOT_MINUTES) * SLOT_MINUTES,
  }
}

const byCourtName = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true })

// Cada día enseña las pistas en las que tiene clases. Un día que normalmente
// tiene escuela pero esa semana no (festivo, grupos que aún no han empezado)
// sale con una columna vacía para que se vea que ese día no hay clase.
export function courtColumns(
  days: { dayIndex: number; isHoliday: boolean }[],
  classes: CourtGridClass[],
  schoolDays: Set<number>,
): CourtColumn[] {
  return days.flatMap(({ dayIndex }): CourtColumn[] => {
    const courts = new Map<string, { courtId: string | null; courtName: string }>()
    for (const c of classes) {
      if (c.dayIndex === dayIndex) courts.set(c.courtId ?? c.courtName, { courtId: c.courtId, courtName: c.courtName })
    }
    if (!courts.size) {
      return schoolDays.has(dayIndex)
        ? [{ key: `${dayIndex}-`, dayIndex, courtId: null, courtName: null, firstOfDay: true, daySpan: 1 }]
        : []
    }
    const sorted = [...courts.values()].sort((a, b) => byCourtName(a.courtName, b.courtName))
    return sorted.map((court, i) => ({
      key: `${dayIndex}-${court.courtId ?? court.courtName}`,
      dayIndex,
      ...court,
      firstOfDay: i === 0,
      daySpan: sorted.length,
    }))
  })
}

// Bloques de una columna. Si dos clases se pisan en la misma pista (no debería
// pasar, pero la app lo permite) van juntas en un bloque en vez de taparse.
export function courtBlocks<T extends { startMin: number; endMin: number }>(
  classes: T[],
  range: { startMin: number },
): CourtBlock<T>[] {
  const sorted = [...classes].sort((a, b) => a.startMin - b.startMin)
  const groups: { endMin: number; classes: T[] }[] = []
  for (const c of sorted) {
    const last = groups[groups.length - 1]
    if (last && c.startMin < last.endMin) {
      last.endMin = Math.max(last.endMin, c.endMin)
      last.classes.push(c)
    } else {
      groups.push({ endMin: c.endMin, classes: [c] })
    }
  }
  return groups.map(g => ({
    firstSlot: Math.floor((g.classes[0].startMin - range.startMin) / SLOT_MINUTES),
    lastSlot: Math.ceil((g.endMin - range.startMin) / SLOT_MINUTES),
    classes: g.classes,
  }))
}

// Como en el Excel del club: el nombre de pila, y el primer apellido solo si
// en el grupo hay dos con el mismo nombre.
export function shortNames(names: string[]): string[] {
  const words = names.map(n => n.trim().split(/\s+/))
  const firstCount = new Map<string, number>()
  for (const w of words) firstCount.set(w[0], (firstCount.get(w[0]) ?? 0) + 1)
  return words
    .map(w => ((firstCount.get(w[0]) ?? 0) > 1 ? w.slice(0, 2).join(' ') : w[0]))
    .sort((a, b) => a.localeCompare(b, 'es'))
}
