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
