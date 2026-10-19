// Recuperar en otro nivel. Cada club puede decir, para cada nivel, en qué
// otro nivel pueden recuperar sus alumnos (normalmente el de justo debajo).
// Se guarda en clubs.config.spot_lower_levels como { nivel: nivelDondeTambiénPuede }.
// No se deduce del orden de los niveles: en X7, por ejemplo, Infantil va
// detrás de Avanzado y no por eso un alumno de Infantil puede ir a Avanzado.

export type LowerLevelMap = Record<string, string>

export function parseLowerLevelMap(config: unknown): LowerLevelMap {
  const raw = (config as { spot_lower_levels?: unknown } | null)?.spot_lower_levels
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: LowerLevelMap = {}
  for (const [from, to] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof to === 'string' && to && to !== from) out[from] = to
  }
  return out
}

// Niveles de clase en los que un alumno puede coger huecos: el suyo y, si el
// club lo permite, el que tenga asignado su nivel.
export function spotLevelsForStudent(studentLevelId: string | null, map: LowerLevelMap): Set<string> | null {
  if (!studentLevelId) return null // sin nivel: sin restricción, como siempre
  const levels = new Set([studentLevelId])
  if (map[studentLevelId]) levels.add(map[studentLevelId])
  return levels
}

export function canTakeSpot(studentLevelId: string | null, classLevelId: string | null, map: LowerLevelMap): boolean {
  if (!classLevelId) return true
  const allowed = spotLevelsForStudent(studentLevelId, map)
  return !allowed || allowed.has(classLevelId)
}

// Niveles de alumno a los que avisar de un hueco en una clase de este nivel:
// el propio y los que pueden bajar a él.
export function studentLevelsForClass(classLevelId: string, map: LowerLevelMap): string[] {
  return [classLevelId, ...Object.keys(map).filter(from => map[from] === classLevelId)]
}

// Propuesta inicial al activar la opción: cada nivel puede bajar al de justo
// debajo según el orden. El club la revisa y corrige lo que no tenga sentido.
export function defaultLowerLevelMap(levels: { id: string; order: number | null }[]): LowerLevelMap {
  const sorted = [...levels].filter(l => l.order != null).sort((a, b) => a.order! - b.order!)
  const out: LowerLevelMap = {}
  for (let i = 1; i < sorted.length; i++) out[sorted[i].id] = sorted[i - 1].id
  return out
}
