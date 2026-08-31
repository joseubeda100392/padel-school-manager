import { getDayOfWeek } from './utils'

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

// Primer día del mes desde el que debe empezar a facturarse una inscripción
// de grupo fijo. Se guarda en group_enrollments.start_date para que
// get_pending_payments() no confunda "cuándo se dio de alta el alumno en el
// sistema" (enrolled_at, que puede ser semanas antes de que la clase arranque)
// con "desde cuándo debe dinero de verdad".
//
// Dos criterios distintos según cómo se calculó el precio:
// - Tarifa por clase (con/sin pista, clase suelta): el precio YA está
//   prorrateado por ocurrencias restantes (ver billingTarget() en
//   group-enrollment.tsx), así que una única sesión que quede este mes es
//   perfectamente facturable este mes — el criterio es "¿le queda alguna
//   sesión de esta clase (por su día de la semana) desde hoy a fin de mes?".
// - Cuota mensual plana (el flujo normal/heredado): el precio es fijo por
//   mes completo, así que no tiene sentido cobrar el mes entero por una sola
//   sesión suelta al final de mes — aquí se usa el mismo umbral de días que
//   ya usa el resto del sistema para mandatos recurrentes (DAYS_THRESHOLD).
export function firstBillableMonth(
  scheduleStartTime: string,
  usesPerClassPricing: boolean,
  referenceDate: Date = new Date(),
): string {
  const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(referenceDate)
  const [ty, tm, td] = todayMadrid.split('-').map(Number)
  const thisMonth0 = tm - 1
  const daysInMonth = new Date(ty, thisMonth0 + 1, 0).getDate()

  if (usesPerClassPricing) {
    const dow = getDayOfWeek(scheduleStartTime)
    let hasRemainingThisMonth = false
    for (let d = td; d <= daysInMonth; d++) {
      if (getDayOfWeek(new Date(ty, thisMonth0, d, 12)) === dow) {
        hasRemainingThisMonth = true
        break
      }
    }
    const targetMonth0 = hasRemainingThisMonth ? thisMonth0 : thisMonth0 + 1
    return new Date(ty, targetMonth0, 1).toISOString().split('T')[0]
  }

  const daysRemaining = daysInMonth - td
  const targetMonth0 = daysRemaining < DAYS_THRESHOLD ? thisMonth0 + 1 : thisMonth0
  return new Date(ty, targetMonth0, 1).toISOString().split('T')[0]
}

// Mes de facturación "efectivo" para vistas que por defecto muestran el mes
// actual (ej. Pagos): con menos de DAYS_THRESHOLD días de mes, ya se
// considera que estamos facturando el mes siguiente — igual que
// firstBillableMonth() para cuota plana. Sin esto, esas vistas abren por
// defecto en un mes de calendario que, a efectos de cobro, ya no existe.
export function currentBillingMonth(referenceDate: Date = new Date()): { year: number; month0: number } {
  const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(referenceDate)
  const [ty, tm, td] = todayMadrid.split('-').map(Number)
  const thisMonth0 = tm - 1
  const daysInMonth = new Date(ty, thisMonth0 + 1, 0).getDate()
  const daysRemaining = daysInMonth - td
  if (daysRemaining < DAYS_THRESHOLD) {
    const next = new Date(ty, thisMonth0 + 1, 1)
    return { year: next.getFullYear(), month0: next.getMonth() }
  }
  return { year: ty, month0: thisMonth0 }
}
