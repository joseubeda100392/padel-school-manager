export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Pagar una clase particular ya asignada (reserva en 'pending') con crédito
// de bono de particular en vez de tarjeta. Toda la comprobación de saldo +
// descuento + confirmación de la reserva va atómica en la RPC — ver
// pay_private_lesson_with_bag en la migración del módulo.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    bookingId: z.string().uuid(),
  }))
  if (badRequest) return badRequest

  const admin = getAdminClient()
  const { data, error } = await admin.rpc('pay_private_lesson_with_bag', {
    p_booking_id: body.bookingId,
    p_student_id: user.id,
  })

  if (error) {
    console.error('[pay-private-with-bag] RPC failed:', error.message)
    return NextResponse.json({ error: 'Error al pagar con bono' }, { status: 500 })
  }
  if (data?.error) return NextResponse.json({ error: data.error }, { status: 409 })

  return NextResponse.json({ ok: true, newBalance: data.new_balance })
}
