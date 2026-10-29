export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { canVoidPayment, previousPaidUntil, type VoidInfo } from '@/lib/payment-void'

type Admin = ReturnType<typeof getAdminClient>

// Anula un cobro apuntado a mano en el club (cuota o cargo suelto en efectivo
// o datáfono) y deja lo que cubría como estaba antes de cobrarlo.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id, name').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    reason: z.string().trim().max(200).optional(),
  }))
  if (badRequest) return badRequest

  const { data: payment } = await admin
    .from('payments')
    .select('id, club_id, user_id, type, status, amount, metadata')
    .eq('id', params.id)
    .single()
  if (!payment || (caller.role !== 'super_admin' && payment.club_id !== caller.club_id)) {
    return NextResponse.json({ error: 'Cobro no encontrado' }, { status: 404 })
  }
  if (!canVoidPayment(payment)) {
    return NextResponse.json({
      error: payment.status !== 'succeeded'
        ? 'Este cobro ya no está cobrado'
        : 'Solo se pueden anular cuotas y cargos cobrados en el club (efectivo o datáfono). Un pago con tarjeta se devuelve desde el TPV.',
    }, { status: 409 })
  }

  const metadata = (payment.metadata ?? {}) as Record<string, any>
  const voided: VoidInfo = { at: new Date().toISOString(), by: user.id, by_name: caller.name ?? null, reason: body.reason || null }

  if (payment.type === 'fixed_group_month') return voidFee(admin, payment, metadata, voided)
  return voidCharge(admin, payment, metadata, voided)
}

// Marca el pago como anulado solo si sigue cobrado (dos clics a la vez no
// anulan dos veces); devuelve false si otro ya lo había hecho.
async function claimPayment(admin: Admin, paymentId: string, metadata: Record<string, any>, voided: VoidInfo) {
  const { data } = await admin
    .from('payments')
    .update({ status: 'refunded', metadata: { ...metadata, voided } })
    .eq('id', paymentId)
    .eq('status', 'succeeded')
    .select('id')
  return !!data?.length
}

async function unclaimPayment(admin: Admin, paymentId: string, metadata: Record<string, any>) {
  await admin.from('payments').update({ status: 'succeeded', metadata }).eq('id', paymentId)
}

const alreadyVoided = () => NextResponse.json({ error: 'Este cobro ya se había anulado. Recarga la página.' }, { status: 409 })

async function voidFee(admin: Admin, payment: { id: string }, metadata: Record<string, any>, voided: VoidInfo) {
  const { data: enrollment } = metadata.enrollment_id
    ? await admin
        .from('group_enrollments')
        .select('id, paid_until, start_date, discount_applied, discount_classes_pending')
        .eq('id', metadata.enrollment_id)
        .single()
    : { data: null }
  if (!enrollment || !metadata.paid_until) {
    return NextResponse.json({ error: 'No se encuentra la cuota de este cobro' }, { status: 404 })
  }
  // Solo el último mes cobrado: si después se cobró otro, quitar este dejaría
  // un hueco en medio. Se anulan de más reciente a más antiguo.
  if (enrollment.paid_until !== metadata.paid_until) {
    return NextResponse.json({
      error: 'Después de este se cobró otro mes de la misma cuota. Anula primero el cobro más reciente.',
    }, { status: 409 })
  }

  if (!(await claimPayment(admin, payment.id, metadata, voided))) return alreadyVoided()

  const update: Record<string, unknown> = { paid_until: previousPaidUntil(metadata, enrollment.start_date) }
  if (metadata.discount_classes > 0) {
    update.discount_classes_pending = (enrollment.discount_classes_pending ?? 0) + metadata.discount_classes
  }
  // El descuento puntual se quitó al cobrar este mes: vuelve si nadie lo ha
  // tocado desde entonces.
  if (metadata.discount_reset && !enrollment.discount_applied) {
    update.monthly_price = metadata.discount_reset.monthly_price
    update.discount_cents = metadata.discount_reset.discount_cents
    update.discount_applied = true
  }

  const { data: updated, error } = await admin
    .from('group_enrollments')
    .update(update)
    .eq('id', enrollment.id)
    .eq('paid_until', metadata.paid_until)
    .select('id')
  if (error || !updated?.length) {
    await unclaimPayment(admin, payment.id, metadata)
    return NextResponse.json({ error: 'La cuota ha cambiado mientras tanto. Recarga la página y vuelve a probar.' }, { status: 409 })
  }
  return NextResponse.json({ ok: true, paidUntil: update.paid_until })
}

async function voidCharge(admin: Admin, payment: { id: string }, metadata: Record<string, any>, voided: VoidInfo) {
  if (!metadata.charge_id) return NextResponse.json({ error: 'No se encuentra el cargo de este cobro' }, { status: 404 })
  if (!(await claimPayment(admin, payment.id, metadata, voided))) return alreadyVoided()

  const { data: updated, error } = await admin
    .from('student_charges')
    .update({ status: 'pending', paid_method: null, paid_at: null, payment_id: null })
    .eq('id', metadata.charge_id)
    .eq('status', 'paid')
    .select('id')
  if (error || !updated?.length) {
    await unclaimPayment(admin, payment.id, metadata)
    return NextResponse.json({ error: 'El cargo ha cambiado mientras tanto. Recarga la página y vuelve a probar.' }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}
