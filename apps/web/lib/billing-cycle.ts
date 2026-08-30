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
// de grupo fijo: el mes actual si a la clase (por su día de la semana) le
// queda alguna sesión desde hoy hasta fin de mes, o si no, el mes que viene
// entero — el mismo criterio "cuenta desde hoy" que ya se usa para calcular
// la cuota al dar de alta al alumno (ver billingTarget() en group-enrollment.tsx).
// Se guarda en group_enrollments.start_date para que get_pending_payments()
// no confunda "cuándo se dio de alta el alumno en el sistema" (enrolled_at,
// que puede ser semanas antes de que la clase arranque) con "desde cuándo
// debe dinero de verdad".
export function firstBillableMonth(scheduleStartTime: string, referenceDate: Date = new Date()): string {
  const dow = getDayOfWeek(scheduleStartTime)
  const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(referenceDate)
  const [ty, tm, td] = todayMadrid.split('-').map(Number)
  const thisMonth0 = tm - 1
  const daysInMonth = new Date(ty, thisMonth0 + 1, 0).getDate()

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
