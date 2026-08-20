// "Fin de mes actual" se rompe cuando un cobro cae en los últimos días del
// mes (ej. inicio de temporada el 31/08): paid_until quedaría prácticamente
// caducado el mismo día, y el siguiente cobro programado casi inmediato.
// Si quedan menos de DAYS_THRESHOLD días para fin de mes, se salta directamente
// al mes siguiente completo.
const DAYS_THRESHOLD = 5

function monthsAheadFrom(referenceDate: Date): number {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysRemaining = daysInMonth - referenceDate.getDate()
  return daysRemaining < DAYS_THRESHOLD ? 2 : 1
}

// Hasta qué fecha queda cubierta una cuota pagada en referenceDate.
export function computePaidUntil(referenceDate: Date = new Date()): string {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const offset = monthsAheadFrom(referenceDate)
  return new Date(year, month + offset, 0).toISOString().split('T')[0]
}

// Para mandatos recurrentes: fecha cubierta (paidUntil) y próximo cobro
// (dayOfMonth del mes siguiente al cubierto), consistentes entre sí.
export function computeBillingCycle(referenceDate: Date, dayOfMonth: number): { paidUntil: string; nextChargeAt: string } {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const offset = monthsAheadFrom(referenceDate)
  return {
    paidUntil: new Date(year, month + offset, 0).toISOString().split('T')[0],
    nextChargeAt: new Date(year, month + offset, dayOfMonth).toISOString().split('T')[0],
  }
}
