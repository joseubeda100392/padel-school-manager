export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@padel/stripe'
import { prisma } from '@padel/db'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = constructWebhookEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Firma de webhook inválida' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent
        await handlePaymentSucceeded(intent)
        break
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailed(intent)
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCancelled(subscription)
        break
      }
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error procesando evento:', event.type, error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: intent.id },
    data: { status: 'succeeded' },
  })

  // Si el pago es de una clase suelta, actualizar el booking
  const payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: intent.id },
  })

  if (payment?.bookingId) {
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'confirmed' },
    })
  }
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: intent.id },
    data: { status: 'failed' },
  })
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  await prisma.payment.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: subscription.status === 'active' ? 'succeeded' : 'pending',
    },
  })
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  await prisma.payment.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: 'failed' },
  })
}
