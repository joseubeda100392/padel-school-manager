import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

// Timezone fija España. Los timestamps se guardan en UTC; el servidor Railway
// corre en UTC, por lo que toLocaleTimeString sin timeZone mostraría UTC, no hora local.
const TZ = 'Europe/Madrid'

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(date))
}

export function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })
}

export function getDayOfWeek(date: Date | string): number {
  // getDay() usa la timezone del servidor (UTC en Railway), por eso usamos Intl
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TZ }).format(new Date(date))
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)
}

function madridTimeHHMM(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(date)
}

// Franjas que cruzan medianoche (ej. 23:00-08:00) se comparan con OR en vez de AND.
function isWithinTimeRange(time: string, start: string, end: string): boolean {
  return start <= end ? (time >= start && time < end) : (time >= start || time < end)
}

// Preferencias de Pista Viva: días/franja vacíos o null = sin restricción.
export function matchesDayTimePreference(
  matchStart: Date,
  preferredDays: number[] | null | undefined,
  preferredStart: string | null | undefined,
  preferredEnd: string | null | undefined,
): boolean {
  if (preferredDays?.length && !preferredDays.includes(getDayOfWeek(matchStart))) return false
  if (preferredStart && preferredEnd && !isWithinTimeRange(madridTimeHHMM(matchStart), preferredStart, preferredEnd)) return false
  return true
}

// Devuelve el instante UTC real de "dateStr a la hora de Madrid que representa
// scheduleStartTime", teniendo en cuenta el cambio de hora de esa fecha
// concreta (no la que tenía cuando se creó el horario). Usar SIEMPRE esto en
// vez de .getHours()/.setHours() para calcular plazos (cancelación, aviso de
// falta) sobre una fecha futura — esos métodos usan la hora del servidor
// (UTC en Railway), que puede quedar hasta 1h desfasada de la hora de Madrid
// según en qué lado del cambio de hora se creó el horario frente a la fecha evaluada.
export function getScheduleDateTimeInMadrid(scheduleStartTime: string, dateStr: string): Date {
  const pad = (n: number) => String(n).padStart(2, '0')

  const wallClock = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
  }).formatToParts(new Date(scheduleStartTime))
  const hour = Number(wallClock.find(p => p.type === 'hour')?.value ?? '0') % 24
  const minute = Number(wallClock.find(p => p.type === 'minute')?.value ?? '0')

  // 1) Valor de referencia: dateStr+hora tratado como si fuera UTC (error de hasta 2h)
  const target = new Date(`${dateStr}T${pad(hour)}:${pad(minute)}:00Z`)

  // 2) Ver qué fecha+hora de Madrid representa ese valor de referencia. Se
  // compara fecha completa, no solo hora — si la conversión cruza medianoche
  // (ej. 23:00 Madrid en horario de verano cae al día siguiente en UTC-2h),
  // comparar solo horas descuadraría el resultado en ~1 día.
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
  }).formatToParts(target)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  const gotHour = get('hour') === '24' ? '00' : get('hour')
  const got = new Date(`${get('year')}-${get('month')}-${get('day')}T${gotHour}:${get('minute')}:00Z`)

  // 3) Corregir por la diferencia real entre lo que queríamos y lo que salió
  return new Date(target.getTime() + (target.getTime() - got.getTime()))
}
