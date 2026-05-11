export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignature, parseRedsysResponse, isPaymentSuccessful } from '@/lib/redsys'

export async function POST(req: NextRequest) {
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const body = await req.formData()
  const merchantParameters = body.get('Ds_MerchantParameters') as string
  const signature = body.get('Ds_Signature') as string

  if (!merchantParameters || !signature) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const response = parseRedsysResponse(merchantParameters)
  const order = response.Ds_Order
  const responseCode = response.Ds_Response ?? '9999'

  // Verificar firma
  const valid = verifySignature(
    process.env.REDSYS_SECRET_KEY ?? '',
    order,
    merchantParameters,
    signature,
  )

  if (!valid) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const success = isPaymentSuccessful(responseCode)

  // Buscar pago pendiente
  const { data: payment } = await adminSupabase
    .from('payments')
    .select('*')
    .eq('redsys_order_id', order)
    .single()

  if (!payment) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  // Actualizar estado del pago
  await adminSupabase
    .from('payments')
    .update({ status: success ? 'completed' : 'failed' })
    .eq('id', payment.id)

  if (!success) return NextResponse.json({ ok: false })

  const meta = payment.metadata ?? {}

  if (payment.type === 'single_class' && meta.schedule_id) {
    if (meta.exclusion_id) {
      await adminSupabase
        .from('schedule_exclusions')
        .update({ publish_spot: false })
        .eq('id', meta.exclusion_id)
    }
    const { data: existing } = await adminSupabase
      .from('bookings')
      .select('id')
      .eq('schedule_id', meta.schedule_id)
      .eq('student_id', payment.user_id)
      .neq('status', 'cancelled')
      .maybeSingle()
    if (!existing) {
      await adminSupabase.from('bookings').insert({
        schedule_id: meta.schedule_id,
        student_id: payment.user_id,
        status: 'confirmed',
        source: 'pay_per_class',
        club_id: meta.club_id ?? null,
      })
    }
  } else if (payment.type === 'class_pack') {
    const classesToAdd = meta.classes_per_pack ?? 10

    // Ensure class_bag row exists then increment
    await adminSupabase
      .from('class_bag')
      .upsert({ user_id: payment.user_id, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })

    const { data: bag } = await adminSupabase
      .from('class_bag')
      .select('id, balance')
      .eq('user_id', payment.user_id)
      .single()

    if (bag) {
      await adminSupabase
        .from('class_bag')
        .update({ balance: bag.balance + classesToAdd, updated_at: new Date().toISOString() })
        .eq('id', bag.id)

      await adminSupabase.from('bag_transactions').insert({
        user_id: payment.user_id,
        class_bag_id: bag.id,
        delta: classesToAdd,
        type: 'credit',
        reason: `Compra de bono — ${classesToAdd} clases`,
      })
    }
  } else if (payment.type === 'fixed_group_month' && meta.enrollment_id) {
    const now = new Date()
    const paidUntil = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    await adminSupabase
      .from('group_enrollments')
      .update({ paid_until: paidUntil })
      .eq('id', meta.enrollment_id)
      .eq('student_id', payment.user_id)
  }

  return NextResponse.json({ ok: true })
}
