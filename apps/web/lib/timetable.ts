// Cuadro semanal por horas (Clases → Semana): coloca cada clase en su día y
// franja de media hora y cuenta, en cada franja, cuántas pistas quedan sin
// clase, para ver dónde cabe un grupo nuevo.

export interface TimetableClass {
  id: string
  dayIndex: number // 0 = lunes … 6 = domingo
  startMin: number // minutos desde las 00:00 (hora de Madrid)
  endMin: number
  courtId: string | null
}

export const SLOT_MINUTES = 30
export const DEFAULT_START_MIN = 9 * 60
export const DEFAULT_END_MIN = 24 * 60

// Rango del cuadro: 9:00–00:00, ampliado si alguna clase se sale.
export function timetableRange(classes: { startMin: number; endMin: number }[]): { startMin: number; endMin: number } {
  let startMin = DEFAULT_START_MIN
  let endMin = DEFAULT_END_MIN
  for (const c of classes) {
    startMin = Math.min(startMin, Math.floor(c.startMin / SLOT_MINUTES) * SLOT_MINUTES)
    endMin = Math.max(endMin, Math.ceil(c.endMin / SLOT_MINUTES) * SLOT_MINUTES)
  }
  return { startMin, endMin }
}

const overlaps = (a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }) =>
  a.startMin < b.endMin && b.startMin < a.endMin

// Clases de un día agrupadas por la media hora en que empiezan; dentro de cada
// franja, por hora de inicio y manteniendo el orden de entrada.
export function classesBySlot<T extends { startMin: number }>(
  items: T[],
  range: { startMin: number; endMin: number },
): T[][] {
  const out: T[][] = Array.from({ length: (range.endMin - range.startMin) / SLOT_MINUTES }, () => [])
  for (const item of items) out[Math.floor((item.startMin - range.startMin) / SLOT_MINUTES)]?.push(item)
  return out.map(slot => [...slot].sort((a, b) => a.startMin - b.startMin))
}

// Pistas en las que cabe una clase nueva empezando en cada franja: sin ninguna
// clase durante al menos `minMinutes` (1 h por defecto; un hueco de media hora
// no sirve para abrir un grupo). Cuenta pistas distintas, no clases, para no
// restar dos veces si dos grupos comparten pista.
export const MIN_NEW_CLASS_MINUTES = 60

export function freeCourtsBySlot(
  dayClasses: TimetableClass[],
  courtsCount: number,
  range: { startMin: number; endMin: number },
  minMinutes = MIN_NEW_CLASS_MINUTES,
): number[] {
  const out: number[] = []
  for (let t = range.startMin; t < range.endMin; t += SLOT_MINUTES) {
    const window = { startMin: t, endMin: Math.min(t + minMinutes, range.endMin) }
    const busy = new Set(dayClasses.filter(c => overlaps(c, window)).map(c => c.courtId ?? c.id))
    out.push(Math.max(0, courtsCount - busy.size))
  }
  return out
}
