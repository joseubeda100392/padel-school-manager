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
    // Crear reserva
    await adminSupabase.from('bookings').insert({
      schedule_id: meta.schedule_id,
      student_id: payment.user_id,
      status: 'confirmed',
      source: 'pay_per_class',
      club_id: meta.club_id ?? null,
    })
  } else if (payment.type === 'class_pack') {
    // Sumar clases a la bolsa
    const classesToAdd = meta.classes_per_pack ?? 10
    const { data: bag } = await adminSupabase
      .from('class_bag')
      .select('balance')
      .eq('user_id', payment.user_id)
      .single()

    const newBalance = (bag?.balance ?? 0) + classesToAdd
    await adminSupabase
      .from('class_bag')
      .update({ balance: newBalance })
      .eq('user_id', payment.user_id)

    // Registrar transacción
    await adminSupabase.from('bag_transactions').insert({
      user_id: payment.user_id,
      delta: classesToAdd,
      reason: 'pack_purchase',
    })
  }

  return NextResponse.json({ ok: true })
}
