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

  // Buscar pago para obtener club_id y así usar la clave secreta correcta
  const { data: payment } = await adminSupabase
    .from('payments')
    .select('*')
    .eq('redsys_order_id', order)
    .single()

  if (!payment) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  // Resolver la clave secreta del club (fallback a env var global)
  let secretKey = process.env.REDSYS_SECRET_KEY ?? ''
  if (payment.club_id) {
    const { data: club } = await adminSupabase
      .from('clubs')
      .select('redsys_secret_key')
      .eq('id', payment.club_id)
      .single()
    if (club?.redsys_secret_key) secretKey = club.redsys_secret_key
  }

  // Verificar firma con la clave del club
  const valid = verifySignature(secretKey, order, merchantParameters, signature)
  if (!valid) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const success = isPaymentSuccessful(responseCode)

  // Idempotencia: Redsys puede retransmitir el IPN; solo el primer aviso aplica efectos
  if (payment.status !== 'pending') {
    return NextResponse.json({ ok: true, already_processed: true })
  }

  const { data: claimed } = await adminSupabase
    .from('payments')
    .update({ status: success ? 'succeeded' : 'failed' })
    .eq('id', payment.id)
    .eq('status', 'pending')
    .select('id')

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ ok: true, already_processed: true })
  }

  if (!success) return NextResponse.json({ ok: false })

  const meta = payment.metadata ?? {}

  if (payment.type === 'single_class' && meta.schedule_id) {
    if (meta.exclusion_id) {
      await adminSupabase
        .from('schedule_exclusions')
        .update({ publish_spot: false })
        .eq('id', meta.exclusion_id)
    }

    let existingQuery = adminSupabase
      .from('bookings')
      .select('id')
      .eq('schedule_id', meta.schedule_id)
      .eq('student_id', payment.user_id)
      .neq('status', 'cancelled')
    if (meta.class_date) {
      existingQuery = existingQuery.eq('class_date', meta.class_date)
    }
    const { data: existing } = await existingQuery.maybeSingle()

    if (!existing) {
      await adminSupabase.from('bookings').insert({
        schedule_id: meta.schedule_id,
        student_id: payment.user_id,
        status: 'confirmed',
        source: 'pay_per_class',
        club_id: payment.club_id ?? null,
        class_date: meta.class_date ?? null,
      })
    }

  } else if (payment.type === 'class_pack') {
    const classesToAdd = meta.classes_per_pack ?? 10
    const packType: '60' | '90' = meta.pack_type === '90' ? '90' : '60'
    const balanceField = packType === '90' ? 'balance_90' : 'balance_60'

    await adminSupabase
      .from('class_bag')
      .upsert({ user_id: payment.user_id, balance_60: 0, balance_90: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })

    const { data: bag } = await adminSupabase
      .from('class_bag')
      .select('id, balance_60, balance_90')
      .eq('user_id', payment.user_id)
      .single()

    if (bag) {
      const currentVal = bag[balanceField] as number
      await adminSupabase
        .from('class_bag')
        .update({ [balanceField]: currentVal + classesToAdd, updated_at: new Date().toISOString() })
        .eq('id', bag.id)

      await adminSupabase.from('bag_transactions').insert({
        user_id: payment.user_id,
        class_bag_id: bag.id,
        delta: classesToAdd,
        type: 'credit',
        reason: `Compra de bono — ${classesToAdd} clases`,
        class_duration: packType,
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
