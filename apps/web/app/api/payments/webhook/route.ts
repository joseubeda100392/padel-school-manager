export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignature, parseRedsysResponse } from '@/lib/redsys'
import { settleRedsysPayment } from '@/lib/payment-settlement'

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

  if (!payment) {
    console.error('[webhook] aviso de Redsys de un pedido que no existe:', order, 'respuesta', responseCode)
    return NextResponse.json({ error: 'Solicitud no válida' }, { status: 400 })
  }

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
    console.error('[webhook] firma de Redsys no válida, pedido', order, 'pago', payment.id, 'club', payment.club_id)
    return NextResponse.json({ error: 'Solicitud no válida' }, { status: 400 })
  }

  // Validar que el importe del IPN coincide con el registrado en BD
  const responseAmount = response.Ds_Amount ?? (response as any).DS_AMOUNT
  if (responseAmount !== undefined && String(payment.amount) !== String(responseAmount)) {
    console.error('[webhook] amount mismatch: expected', payment.amount, 'got', responseAmount)
    return NextResponse.json({ error: 'Solicitud no válida' }, { status: 400 })
  }

  const identifier = response.Ds_Merchant_Identifier ?? response.DS_MERCHANT_IDENTIFIER ?? response.Ds_Identifier ?? null
  const result = await settleRedsysPayment(adminSupabase, payment, { responseCode, identifier })
  return NextResponse.json(result.body, { status: result.status })
}
