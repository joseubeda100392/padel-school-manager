export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { IN_CLUB_METHODS } from '@/lib/payment-method'

// Cargo suelto pagado en el club (efectivo o datáfono) o anulado.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    action: z.enum([...IN_CLUB_METHODS, 'cancel']),
  }))
  if (badRequest) return badRequest

  const { data: charge } = await admin
    .from('student_charges')
    .select('id, club_id, student_id, concept, amount_cents, status')
    .eq('id', params.id)
    .single()
  if (!charge || (caller.role !== 'super_admin' && charge.club_id !== caller.club_id)) {
    return NextResponse.json({ error: 'Cargo no encontrado' }, { status: 404 })
  }
  if (charge.status !== 'pending') {
    return NextResponse.json({ error: charge.status === 'paid' ? 'Este cargo ya está pagado' : 'Este cargo está anulado' }, { status: 409 })
  }

  if (body.action === 'cancel') {
    const { data: done } = await admin.from('student_charges').update({ status: 'cancelled' }).eq('id', charge.id).eq('status', 'pending').select('id')
    if (!done?.length) return NextResponse.json({ error: 'Este cargo ya no está pendiente' }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  // Se marca primero el cargo (solo si sigue pendiente) y luego se apunta el
  // pago: así dos clics a la vez no apuntan el cobro dos veces.
  const { data: claimed } = await admin
    .from('student_charges')
    .update({ status: 'paid', paid_method: body.action, paid_at: new Date().toISOString() })
    .eq('id', charge.id)
    .eq('status', 'pending')
    .select('id')
  if (!claimed?.length) return NextResponse.json({ error: 'Este cargo ya no está pendiente' }, { status: 409 })

  const { data: payment, error } = await admin
    .from('payments')
    .insert({
      user_id: charge.student_id,
      club_id: charge.club_id,
      amount: charge.amount_cents,
      type: 'manual_charge',
      status: 'succeeded',
      metadata: { charge_id: charge.id, method: body.action, concept: charge.concept },
    })
    .select('id')
    .single()
  if (error || !payment) {
    await admin.from('student_charges').update({ status: 'pending', paid_method: null, paid_at: null }).eq('id', charge.id)
    console.error('[charges] payment insert failed:', error?.message)
    return NextResponse.json({ error: 'No se ha podido registrar el pago' }, { status: 500 })
  }
  await admin.from('student_charges').update({ payment_id: payment.id }).eq('id', charge.id)

  return NextResponse.json({ ok: true })
}
