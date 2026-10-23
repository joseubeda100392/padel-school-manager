// Hora y día de la semana en Madrid de un instante. Para comparar clases de
// distintas fechas hay que usar la hora local: una clase de las 17:30 creada en
// septiembre (UTC+2) se guarda como 15:30 UTC y una de las 16:00 de noviembre
// (UTC+1) como 15:00 UTC; comparadas en UTC parecen pisarse y no se tocan.
const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function parts(value: Date | string) {
  const map = Object.fromEntries(PARTS.formatToParts(new Date(value)).map(p => [p.type, p.value]))
  return { weekday: WEEKDAYS[map.weekday], minutes: Number(map.hour) * 60 + Number(map.minute) }
}

export function madridMinutesOfDay(value: Date | string): number {
  return parts(value).minutes
}

export function madridDayOfWeek(value: Date | string): number {
  return parts(value).weekday
}
