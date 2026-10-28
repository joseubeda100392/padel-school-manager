import { currentBillingMonth, nextPaidUntilForEnrollment } from '@/lib/billing-cycle'
import { monthsLabel } from '@/lib/payment-concept'

// Como mucho se cobran de una vez los meses que debe más uno adelantado.
export const MAX_FEE_MONTHS = 12

export interface FeeMonthOption {
  months: number
  paidUntil: string
  label: string
  advance: boolean
}

// Mes que se está cobrando ('YYYY-MM'), el mismo que Pagos: en los últimos
// días del mes ya es el siguiente.
export function billingMonthStr(referenceDate: Date = new Date()): string {
  const { year, month0 } = currentBillingMonth(referenceDate)
  return `${year}-${String(month0 + 1).padStart(2, '0')}`
}

// Los meses de una cuota se pagan en orden (paid_until es "pagado hasta"):
// la opción n cobra los n meses siguientes al último pagado. Se ofrecen los
// que ya debe y uno más por adelantado (posterior al mes que se cobra).
export function feeMonthOptions(paidUntil: string | null, startDate: string | null, currentMonth: string): FeeMonthOption[] {
  const options: FeeMonthOption[] = []
  const covered: string[] = []
  let last = paidUntil
  for (let n = 1; n <= MAX_FEE_MONTHS; n++) {
    last = nextPaidUntilForEnrollment(last, startDate)
    covered.push(last.slice(0, 7))
    const advance = last.slice(0, 7) > currentMonth
    options.push({ months: n, paidUntil: last, label: monthsLabel(covered), advance })
    if (advance) break
  }
  return options
}

// Reparte el importe cobrado entre los meses: el resto de céntimos va al primero.
export function splitAmount(totalCents: number, months: number): number[] {
  const base = Math.floor(totalCents / months)
  return Array.from({ length: months }, (_, i) => (i === 0 ? totalCents - base * (months - 1) : base))
}
