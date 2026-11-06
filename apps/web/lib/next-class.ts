import { getScheduleDateTimeInMadrid } from '@/lib/utils'
import { madridDayOfWeek } from '@/lib/madrid-time'

const TZ = 'Europe/Madrid'
// A safety cap so a misconfigured holiday list can never loop forever.
const MAX_WEEKS_AHEAD = 52
const DAY_MS = 24 * 60 * 60 * 1000

const toSpainDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const addDays = (dateStr: string, days: number) =>
  new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10)

// Próximas sesiones semanales de una clase fija, desde `now`, todo en hora de España: el día y la hora
// de la clase son los de España (no los del servidor, que en Railway va en UTC), así que una clase de
// las 17:30 sigue a las 17:30 después del cambio de hora. Nunca antes de la primera sesión.
export function getUpcomingOccurrences(startTime: string, now: Date = new Date(), count = 1): Date[] {
  if (!startTime) return []
  const base = new Date(startTime)
  if (isNaN(base.getTime())) return []
  const diff = (madridDayOfWeek(base) - madridDayOfWeek(now) + 7) % 7
  let dateStr = addDays(toSpainDate(now), diff)
  if (getScheduleDateTimeInMadrid(startTime, dateStr) <= now) dateStr = addDays(dateStr, 7)
  const baseDate = toSpainDate(base)
  while (dateStr < baseDate) dateStr = addDays(dateStr, 7)
  return Array.from({ length: count }, (_, i) => getScheduleDateTimeInMadrid(startTime, addDays(dateStr, i * 7)))
}

// Next weekly occurrence of a fixed class, skipping the club's holidays
// (there is no class on a holiday, so it is not the "next class").
export function getNextOccurrence(startTime: string, holidays: Set<string>, now: Date = new Date()): Date | null {
  const upcoming = getUpcomingOccurrences(startTime, now, MAX_WEEKS_AHEAD)
  return upcoming.find(d => !holidays.has(toSpainDate(d))) ?? null
}
