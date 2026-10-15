import { lastDayOfMonthStr } from '@/lib/billing-cycle'

export interface CarryoverPayment {
  amount: number
  created_at: string
  metadata: { paid_until?: string | null; advance?: boolean | null } | null
}

const MAX_MONTHS_AHEAD = 12

const madridMonth = (iso: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(iso)).slice(0, 7)

function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const endOfMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number)
  return lastDayOfMonthStr(y, m - 1)
}

function coveredMonth(p: CarryoverPayment): string {
  if (p.metadata?.paid_until) return p.metadata.paid_until.slice(0, 7)
  if (p.metadata?.advance) return addMonths(madridMonth(p.created_at), 1)
  return madridMonth(p.created_at)
}

// Hasta cuándo queda pagada una inscripción NUEVA con los pagos que el alumno
// ya hizo en ese club. Un pago solo se traslada si SOBRA: por cada mes, desde
// el actual, pagos de cuota que cubren ese mes (de importe suficiente) menos
// los otros grupos activos que ya lo tienen cubierto.
// - Cambia de grupo (se quitó del viejo): su pago sobra -> grupo nuevo pagado.
// - Dobla clase (sigue en el viejo): ese pago ya está gastado -> pendiente.
// - Adelantos de meses siguientes: se trasladan también, mes a mes.
// Si al cambiar se mete primero en el nuevo y luego se quita del viejo, queda
// pendiente: conservador, nunca regala un mes.
export function carriedOverPaidUntil(params: {
  payments: CarryoverPayment[]
  otherActivePaidUntil: (string | null)[]
  monthlyPrice: number
  currentMonth: string
}): string | null {
  const { payments, otherActivePaidUntil, monthlyPrice, currentMonth } = params
  const eligible = payments.filter(p => p.amount >= monthlyPrice).map(coveredMonth)

  let paidUntil: string | null = null
  for (let i = 0; i < MAX_MONTHS_AHEAD; i++) {
    const month = addMonths(currentMonth, i)
    const paid = eligible.filter(m => m === month).length
    const usedByOthers = otherActivePaidUntil.filter(pu => !!pu && pu >= endOfMonth(month)).length
    if (paid <= usedByOthers) break
    paidUntil = endOfMonth(month)
  }
  return paidUntil
}
