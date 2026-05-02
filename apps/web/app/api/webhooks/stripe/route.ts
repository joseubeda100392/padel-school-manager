export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

// Stripe desactivado — usando Redsys. Mantenemos el endpoint para no romper configs existentes.
export async function POST() {
  return NextResponse.json({ received: true })
}
