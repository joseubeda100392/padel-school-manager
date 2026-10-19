// Cuadro semanal por horas (Clases → Cuadro): coloca cada clase en su día y
// franja, pone una al lado de otra las que coinciden y cuenta, en cada franja,
// cuántas pistas quedan sin clase, para ver dónde cabe un grupo nuevo.

export interface TimetableClass {
  id: string
  dayIndex: number // 0 = lunes … 6 = domingo
  startMin: number // minutos desde las 00:00 (hora de Madrid)
  endMin: number
  courtId: string | null
}

export interface PlacedClass<T> {
  item: T
  lane: number
  lanes: number
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

// Reparte en columnas ("carriles") las clases de un mismo día que se solapan.
// Cada grupo de clases encadenadas por solape comparte el mismo nº de carriles.
export function placeDay<T extends { startMin: number; endMin: number }>(items: T[]): PlacedClass<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const placed: PlacedClass<T>[] = []
  let cluster: PlacedClass<T>[] = []
  let clusterEnd = -1
  const closeCluster = () => {
    const lanes = cluster.reduce((m, p) => Math.max(m, p.lane + 1), 0)
    for (const p of cluster) p.lanes = lanes
    placed.push(...cluster)
    cluster = []
  }
  for (const item of sorted) {
    if (cluster.length && item.startMin >= clusterEnd) closeCluster()
    const used = new Set(cluster.filter(p => overlaps(p.item, item)).map(p => p.lane))
    let lane = 0
    while (used.has(lane)) lane++
    cluster.push({ item, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  if (cluster.length) closeCluster()
  return placed
}

// Pistas sin clase en cada franja de un día. Cuenta pistas distintas, no
// clases, para no restar dos veces si dos grupos comparten pista.
export function freeCourtsBySlot(
  dayClasses: TimetableClass[],
  courtsCount: number,
  range: { startMin: number; endMin: number },
): number[] {
  const out: number[] = []
  for (let t = range.startMin; t < range.endMin; t += SLOT_MINUTES) {
    const slot = { startMin: t, endMin: t + SLOT_MINUTES }
    const busy = new Set(dayClasses.filter(c => overlaps(c, slot)).map(c => c.courtId ?? c.id))
    out.push(Math.max(0, courtsCount - busy.size))
  }
  return out
}
