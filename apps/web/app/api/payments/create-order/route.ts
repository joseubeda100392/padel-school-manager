export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  generateOrderId,
  buildMerchantParameters,
  generateSignature,
  getRedsysUrl,
} from '@/lib/redsys'

// Tipo de pago: clase suelta o bono de clases
type PaymentType = 'single_class' | 'class_pack'

export async function POST(req: NextRequest) {
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { type, scheduleId }: { type: PaymentType; scheduleId?: string } = await req.json()

  // Obtener precio desde app_config
  const { data: configs } = await adminSupabase
    .from('app_config')
    .select('key, value')
    .in('key', ['pay_per_class_price', 'pack_price', 'classes_per_pack'])

  const cfg = Object.fromEntries((configs ?? []).map((c: any) => [c.key, c.value]))
  const amount = type === 'single_class'
    ? parseInt(cfg.pay_per_class_price ?? '1200')
    : parseInt(cfg.pack_price ?? '9000')

  const orderId = generateOrderId()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://padel-school-manager-production.up.railway.app'

  const merchantParams = buildMerchantParameters({
    DS_MERCHANT_MERCHANTCODE: process.env.REDSYS_MERCHANT_CODE ?? '',
    DS_MERCHANT_TERMINAL: process.env.REDSYS_TERMINAL ?? '001',
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_AMOUNT: amount.toString(),
    DS_MERCHANT_ORDER: orderId,
    DS_MERCHANT_CURRENCY: '978',
    DS_MERCHANT_MERCHANTURL: `${appUrl}/api/payments/webhook`,
    DS_MERCHANT_URLOK: `${appUrl}/pay/success`,
    DS_MERCHANT_URLKO: `${appUrl}/pay/error`,
    DS_MERCHANT_PRODUCTDESCRIPTION: type === 'single_class' ? 'Clase de padel' : 'Bono de clases de padel',
  })

  const signature = generateSignature(
    process.env.REDSYS_SECRET_KEY ?? '',
    orderId,
    merchantParams,
  )

  // Guardar pago pendiente en BD
  await adminSupabase.from('payments').insert({
    user_id: user.id,
    redsys_order_id: orderId,
    amount,
    type,
    status: 'pending',
    metadata: {
      schedule_id: scheduleId ?? null,
      classes_per_pack: parseInt(cfg.classes_per_pack ?? '10'),
    },
  })

  return NextResponse.json({
    redsysUrl: getRedsysUrl(),
    merchantParameters: merchantParams,
    signature,
    signatureVersion: 'HMAC_SHA256_V1',
  })
}
