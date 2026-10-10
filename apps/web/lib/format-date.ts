const TZ = 'Europe/Madrid'

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function toDate(value: Date | string) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value)
}

// "Lunes 12 de octubre" — solo la primera letra en mayúscula, como se escribe
// en español (toLocaleDateString + capitalizar cada palabra daba "12 De Octubre").
export function formatLongDate(value: Date | string, opts: { weekday?: boolean } = {}) {
  const text = new Intl.DateTimeFormat('es-ES', {
    weekday: opts.weekday === false ? undefined : 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }).format(toDate(value))
  return capitalize(text.replace(',', ''))
}

// "Lun 12" para etiquetas compactas.
export function formatShortDay(value: Date | string) {
  const d = toDate(value)
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: TZ }).format(d).replace('.', '')
  const day = new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: TZ }).format(d)
  return { weekday: capitalize(weekday), day }
}

export function formatClock(value: Date | string) {
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(value))
}
