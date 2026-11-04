// Código que se propone para un grupo nuevo: el siguiente al más alto que ya usa
// el club (GP044 → GP045), con el prefijo más repetido y los mismos dígitos.
// Si el club no usa códigos con número, no propone nada.
const CODE_PATTERN = /^(.*?)(\d+)$/

export function nextScheduleCode(codes: (string | null | undefined)[]): string {
  const byPrefix = new Map<string, { count: number; max: number; width: number }>()
  for (const raw of codes) {
    const match = raw?.trim().match(CODE_PATTERN)
    if (!match) continue
    const [, prefix, digits] = match
    const entry = byPrefix.get(prefix) ?? { count: 0, max: 0, width: 0 }
    byPrefix.set(prefix, {
      count: entry.count + 1,
      max: Math.max(entry.max, Number(digits)),
      width: Math.max(entry.width, digits.length),
    })
  }
  const best = [...byPrefix.entries()].sort((a, b) => b[1].count - a[1].count)[0]
  if (!best) return ''
  const [prefix, { max, width }] = best
  return `${prefix}${String(max + 1).padStart(width, '0')}`
}
