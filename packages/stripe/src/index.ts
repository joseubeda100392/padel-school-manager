import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

// Crea un PaymentIntent para una clase suelta (pay-per-class)
export async function createPayPerClassIntent({
  customerId,
  amount,
  currency = 'eur',
  metadata,
}: {
  customerId: string
  amount: number
  currency?: string
  metadata?: Record<string, string>
}) {
  return stripe.paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: metadata ?? {},
  })
}

// Crea o recupera un cliente de Stripe para un usuario
export async function getOrCreateStripeCustomer({
  email,
  name,
  userId,
}: {
  email: string
  name: string
  userId: string
}) {
  const existing = await stripe.customers.list({ email, limit: 1 })

  if (existing.data.length > 0) return existing.data[0]

  return stripe.customers.create({
    email,
    name,
    metadata: { userId },
  })
}

// Crea una suscripción mensual
export async function createSubscription({
  customerId,
  priceId,
  metadata,
}: {
  customerId: string
  priceId: string
  metadata?: Record<string, string>
}) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: metadata ?? {},
  })
}

// Cancela una suscripción al final del período
export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

// Verifica la firma del webhook de Stripe
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string,
) {
  return stripe.webhooks.constructEvent(payload, signature, secret)
}

export type { Stripe }
