// Festivos del club (Configuración → Días festivos), guardados en
// clubs.config.holidays como 'YYYY-MM-DD'. Ese día no hay clase: ninguna vía
// del alumno (faltas, huecos, reservas, pagos) debe tratarlo como sesión.
export function getHolidaySet(config: unknown): Set<string> {
  const holidays = (config as { holidays?: unknown } | null | undefined)?.holidays
  return new Set(Array.isArray(holidays) ? holidays.filter((d): d is string => typeof d === 'string') : [])
}

export const HOLIDAY_ERROR = 'Ese día es festivo: no hay clase'
