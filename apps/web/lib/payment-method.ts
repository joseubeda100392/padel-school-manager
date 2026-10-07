export type PaymentMethodKey = 'online' | 'cash' | 'card_terminal' | 'unknown'

export const IN_CLUB_METHODS = ['cash', 'card_terminal'] as const
export type InClubMethod = (typeof IN_CLUB_METHODS)[number]

export const PAYMENT_METHODS: Record<PaymentMethodKey, { label: string; cls: string }> = {
  online:        { label: 'Tarjeta online', cls: 'bg-blue-100 text-blue-700' },
  cash:          { label: 'Efectivo',       cls: 'bg-orange-100 text-orange-700' },
  card_terminal: { label: 'Datáfono',       cls: 'bg-purple-100 text-purple-700' },
  unknown:       { label: '—',              cls: 'bg-gray-100 text-gray-400' },
}

interface PaymentLike {
  metadata?: { method?: string } | null
  redsys_order_id?: string | null
  stripe_payment_intent_id?: string | null
}

export function paymentMethodKey(p: PaymentLike): PaymentMethodKey {
  const method = p.metadata?.method
  if (method === 'cash' || method === 'card_terminal') return method
  if (p.redsys_order_id || p.stripe_payment_intent_id) return 'online'
  return 'unknown'
}
