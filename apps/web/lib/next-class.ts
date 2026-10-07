const TZ = 'Europe/Madrid'
// A safety cap so a misconfigured holiday list can never loop forever.
const MAX_WEEKS_AHEAD = 52

const toSpainDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

// Next weekly occurrence of a fixed class, skipping the club's holidays
// (there is no class on a holiday, so it is not the "next class").
export function getNextOccurrence(startTime: string, holidays: Set<string>, now: Date = new Date()): Date | null {
  if (!startTime) return null
  const base = new Date(startTime)
  if (isNaN(base.getTime())) return null
  const next = new Date(now)
  next.setHours(base.getHours(), base.getMinutes(), 0, 0)
  const diff = (base.getDay() - now.getDay() + 7) % 7
  next.setDate(now.getDate() + (diff === 0 && next <= now ? 7 : diff))
  while (next < base) next.setDate(next.getDate() + 7)
  for (let i = 0; i < MAX_WEEKS_AHEAD && holidays.has(toSpainDate(next)); i++) {
    next.setDate(next.getDate() + 7)
  }
  return next
}
