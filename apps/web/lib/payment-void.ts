import { IN_CLUB_METHODS } from '@/lib/payment-method'
import { lastDayOfMonthStr } from '@/lib/billing-cycle'

// Anular un cobro apuntado a mano en el club (efectivo o datáfono): no se
// borra, se queda con status 'refunded' y metadata.voided (quién, cuándo y
// por qué), así deja de sumar en Pagos y en los totales pero el club conserva
// el rastro de la caja. Los cobros con tarjeta online no se anulan aquí: el
// dinero se devuelve desde el TPV de Redsys.
export const VOIDABLE_TYPES = ['fixed_group_month', 'manual_charge'] as const

export interface VoidInfo {
  at: string
  by: string
  by_name: string | null
  reason: string | null
}

interface PaymentLike {
  status?: string | null
  type?: string | null
  metadata?: Record<string, any> | null
}

export function isVoidedPayment(p: PaymentLike): boolean {
  return p.status === 'refunded' && !!p.metadata?.voided
}

export function canVoidPayment(p: PaymentLike): boolean {
  return p.status === 'succeeded'
    && (VOIDABLE_TYPES as readonly string[]).includes(p.type ?? '')
    && (IN_CLUB_METHODS as readonly string[]).includes(p.metadata?.method ?? '')
}

// Hasta cuándo quedaba pagada la cuota antes de este cobro. Los cobros nuevos
// lo guardan (metadata.prev_paid_until); para los antiguos, el mes anterior al
// que cubría, o nada si el alumno empezó ese mismo mes (era su primera cuota).
export function previousPaidUntil(metadata: Record<string, any>, startDate: string | null): string | null {
  if ('prev_paid_until' in metadata) return metadata.prev_paid_until ?? null
  const covered: string = metadata.paid_until
  const year = Number(covered.slice(0, 4))
  const month0 = Number(covered.slice(5, 7)) - 1
  const prev = lastDayOfMonthStr(month0 === 0 ? year - 1 : year, month0 === 0 ? 11 : month0 - 1)
  return startDate && startDate > prev ? null : prev
}
