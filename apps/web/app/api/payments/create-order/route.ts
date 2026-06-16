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

type PaymentType = 'single_class' | 'class_pack' | 'fixed_group_month' | 'tournament' | 'intensivo_group'

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
    type: z.enum(['single_class', 'class_pack', 'fixed_group_month', 'tournament', 'intensivo_group']),
    scheduleId: z.string().uuid().optional(),
    packType: z.enum(['60', '90']).optional(),
    enrollmentId: z.string().uuid().optional(),
    exclusionId: z.string().uuid().optional(),
    classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    tournamentId: z.string().uuid().optional(),
    intensivoGroupId: z.string().uuid().optional(),
    classDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  }))
  if (badRequest) return badRequest
  const { type, scheduleId, packType, enrollmentId, exclusionId, classDate, tournamentId, intensivoGroupId, classDates } = orderBody

  let amount: number
  let productDesc: string
  let classesToAdd = 0

  if (type === 'single_class') {
    let durationMin = 60
    let scheduleType = 'regular'
    let schedulePriceCents: number | null = null
    if (scheduleId) {
      const { data: schedule } = await admin
        .from('schedules')
        .select('start_time, end_time, type, price_cents')
        .eq('id', scheduleId)
        .single()
      if (schedule) {
        durationMin = Math.round(
          (new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000
        )
        scheduleType = (schedule as any).type ?? 'regular'
        schedulePriceCents = (schedule as any).price_cents ?? null
      }
    }
    if (schedulePriceCents && schedulePriceCents > 0) {
      amount = schedulePriceCents
      productDesc = scheduleType === 'intensivo' ? 'Clase intensivo pádel' : 'Clase de pádel'
    } else {
      const priceKey = durationMin >= 80 ? 'pay_per_class_price_90' : 'pay_per_class_price_60'
      amount = cfg[priceKey]
      productDesc = durationMin >= 80 ? 'Clase de pádel 1h 30min' : 'Clase de pádel 1h'
    }

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

  } else if (type === 'tournament') {
    if (!tournamentId) return NextResponse.json({ error: 'tournamentId requerido' }, { status: 400 })
    const { data: tournament } = await admin
      .from('tournaments')
      .select('id, name, status, price_cents, max_players, club_id')
      .eq('id', tournamentId)
      .single()
    if (!tournament) return NextResponse.json({ error: 'Torneo no encontrado' }, { status: 404 })
    if (tournament.status !== 'open') return NextResponse.json({ error: 'Las inscripciones están cerradas' }, { status: 409 })
    if (tournament.club_id !== clubId) return NextResponse.json({ error: 'No perteneces a este club' }, { status: 403 })
    const { count } = await admin
      .from('tournament_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
    if ((count ?? 0) >= tournament.max_players) return NextResponse.json({ error: 'El torneo está completo' }, { status: 409 })
    const { data: alreadyReg } = await admin
      .from('tournament_registrations')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('student_id', user.id)
      .maybeSingle()
    if (alreadyReg) return NextResponse.json({ error: 'Ya estás inscrito en este torneo' }, { status: 409 })
    amount = tournament.price_cents
    productDesc = `Inscripción torneo: ${tournament.name}`

  } else if (type === 'intensivo_group') {
    if (!intensivoGroupId) return NextResponse.json({ error: 'intensivoGroupId requerido' }, { status: 400 })
    const { data: schedules } = await admin
      .from('schedules')
      .select('id, price_cents, max_students, club_id, enrollments:group_enrollments(student_id, status)')
      .eq('intensivo_group_id', intensivoGroupId)
      .eq('is_active', true)
    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ error: 'Intensivo no encontrado' }, { status: 404 })
    }
    if (schedules[0].club_id !== clubId) {
      return NextResponse.json({ error: 'No perteneces a este club' }, { status: 403 })
    }
    // Validate capacity and not already enrolled
    for (const s of schedules) {
      const active = (s.enrollments as any[]).filter((e: any) => e.status === 'active')
      if (active.some((e: any) => e.student_id === user.id)) {
        return NextResponse.json({ error: 'Ya estás inscrito en alguna clase de este intensivo' }, { status: 409 })
      }
      if (active.length >= s.max_students) {
        return NextResponse.json({ error: 'No hay plazas disponibles en alguna clase del intensivo' }, { status: 409 })
      }
    }
    const totalPrice = schedules.reduce((sum, s) => sum + ((s.price_cents as number | null) ?? 0), 0)
    if (totalPrice <= 0) {
      return NextResponse.json({ error: 'Precio del intensivo no configurado' }, { status: 400 })
    }
    amount = totalPrice
    productDesc = `Semana intensivo pádel (${schedules.length} clases)`

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
      tournament_id: tournamentId ?? null,
      intensivo_group_id: intensivoGroupId ?? null,
      class_dates: classDates ?? null,
    },
  })

  return NextResponse.json({
    redsysUrl: getRedsysUrl(redsysEnv),
    merchantParameters: merchantParams,
    signature,
    signatureVersion: 'HMAC_SHA256_V1',
  })
}
