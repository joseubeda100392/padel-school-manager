export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import {
  generateOrderId,
  buildMerchantParameters,
  generateSignature,
  getRedsysUrl,
} from '@/lib/redsys'

type PaymentType = 'single_class' | 'class_pack' | 'fixed_group_month'

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()

  const { data: userProfile } = await admin
    .from('users')
    .select('club_id')
    .eq('id', user.id)
    .single()
  const clubId = userProfile?.club_id ?? null

  // fallback to env vars for clubs without Redsys configured in DB
  let merchantCode = process.env.REDSYS_MERCHANT_CODE ?? ''
  let secretKey = process.env.REDSYS_SECRET_KEY ?? ''
  let terminal = process.env.REDSYS_TERMINAL ?? '001'
  let redsysEnv: string | null = null

  const DEFAULT_CFG = {
    pay_per_class_price_60: 1200,
    pay_per_class_price_90: 1500,
    pack_price_60: 9000,
    classes_per_pack_60: 10,
    pack_price_90: 12000,
    classes_per_pack_90: 10,
  }

  let cfg = { ...DEFAULT_CFG }

  if (clubId) {
    const { data: club } = await admin
      .from('clubs')
      .select('redsys_merchant_code, redsys_secret_key, redsys_merchant_terminal, redsys_env, config')
      .eq('id', clubId)
      .single()

    if (club?.redsys_merchant_code) merchantCode = club.redsys_merchant_code
    if (club?.redsys_secret_key) secretKey = club.redsys_secret_key
    if (club?.redsys_merchant_terminal) terminal = club.redsys_merchant_terminal
    if (club?.redsys_env) redsysEnv = club.redsys_env
    if (club?.config) cfg = { ...DEFAULT_CFG, ...club.config }
  }

  if (!merchantCode || !secretKey) {
    return NextResponse.json({ error: 'TPV no configurado para este club. Contacta con el administrador.' }, { status: 503 })
  }

  const { data: orderBody, error: badRequest } = await parseBody(req, z.object({
    type: z.enum(['single_class', 'class_pack', 'fixed_group_month']),
    scheduleId: z.string().uuid().optional(),
    packType: z.enum(['60', '90']).optional(),
    enrollmentId: z.string().uuid().optional(),
    exclusionId: z.string().uuid().optional(),
    classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }))
  if (badRequest) return badRequest
  const { type, scheduleId, packType, enrollmentId, exclusionId, classDate } = orderBody

  let amount: number
  let productDesc: string
  let classesToAdd = 0

  if (type === 'single_class') {
    let durationMin = 60
    if (scheduleId) {
      const { data: schedule } = await admin
        .from('schedules')
        .select('start_time, end_time')
        .eq('id', scheduleId)
        .single()
      if (schedule) {
        durationMin = Math.round(
          (new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000
        )
      }
    }
    const priceKey = durationMin >= 80 ? 'pay_per_class_price_90' : 'pay_per_class_price_60'
    amount = cfg[priceKey]
    productDesc = durationMin >= 80 ? 'Clase de pádel 1h 30min' : 'Clase de pádel 1h'

  } else if (type === 'fixed_group_month') {
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId requerido' }, { status: 400 })
    const { data: enrollment } = await admin
      .from('group_enrollments')
      .select('monthly_price, student_id')
      .eq('id', enrollmentId)
      .eq('student_id', user.id)
      .single()
    if (!enrollment) return NextResponse.json({ error: 'Inscripción no encontrada' }, { status: 404 })
    amount = enrollment.monthly_price
    const now = new Date()
    productDesc = `Cuota grupo fijo ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`

  } else {
    const is90 = packType === '90'
    amount = cfg[is90 ? 'pack_price_90' : 'pack_price_60']
    classesToAdd = cfg[is90 ? 'classes_per_pack_90' : 'classes_per_pack_60']
    productDesc = is90 ? 'Bono clases de pádel 1h 30min' : 'Bono clases de pádel 1h'
  }

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: `Importe inválido: ${amount}. Revisa la configuración de precios.` }, { status: 400 })
  }

  const orderId = generateOrderId()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://padel-school-manager-production.up.railway.app'

  const merchantParams = buildMerchantParameters({
    DS_MERCHANT_MERCHANTCODE: merchantCode,
    DS_MERCHANT_TERMINAL: terminal,
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_AMOUNT: amount.toString(),
    DS_MERCHANT_ORDER: orderId,
    DS_MERCHANT_CURRENCY: '978',
    DS_MERCHANT_MERCHANTURL: `${appUrl}/api/payments/webhook`,
    DS_MERCHANT_URLOK: `${appUrl}/pay/success`,
    DS_MERCHANT_URLKO: `${appUrl}/pay/error`,
    DS_MERCHANT_PRODUCTDESCRIPTION: productDesc,
  })

  const signature = generateSignature(secretKey, orderId, merchantParams)

  await admin.from('payments').insert({
    user_id: user.id,
    club_id: clubId,
    redsys_order_id: orderId,
    amount,
    type,
    status: 'pending',
    metadata: {
      schedule_id: scheduleId ?? null,
      classes_per_pack: classesToAdd,
      pack_type: packType ?? null,
      enrollment_id: enrollmentId ?? null,
      exclusion_id: exclusionId ?? null,
      class_date: classDate ?? null,
    },
  })

  return NextResponse.json({
    redsysUrl: getRedsysUrl(redsysEnv),
    merchantParameters: merchantParams,
    signature,
    signatureVersion: 'HMAC_SHA256_V1',
  })
}
