export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import {
  generateOrderId,
  buildMerchantParameters,
  buildCofInitParams,
  generateSignature,
  getRedsysUrl,
} from '@/lib/redsys'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const { data: mandates } = await admin
    .from('payment_mandates')
    .select('id, amount_cents, day_of_month, status, last_charged_at, next_charge_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ mandates: mandates ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { userId, amountCents, dayOfMonth = 1 } = await req.json()
  if (!userId || !amountCents) return NextResponse.json({ error: 'userId y amountCents requeridos' }, { status: 400 })

  const cookieStore = cookies()
  let clubId = caller.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? caller.club_id)
    : caller.club_id

  // Fallback: usar el club_id del alumno si el caller no tiene uno resuelto
  if (!clubId) {
    const { data: student } = await admin.from('users').select('club_id').eq('id', userId).single()
    clubId = student?.club_id ?? null
  }

  if (!clubId) return NextResponse.json({ error: 'Club no configurado' }, { status: 400 })

  // Cancelar mandato previo activo si existe
  await admin
    .from('payment_mandates')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .in('status', ['pending_auth', 'active', 'paused'])

  // Crear nuevo mandato en estado pending_auth
  const { data: mandate, error: mandateErr } = await admin
    .from('payment_mandates')
    .insert({ user_id: userId, club_id: clubId, amount_cents: amountCents, day_of_month: dayOfMonth, status: 'pending_auth' })
    .select('id')
    .single()

  if (mandateErr || !mandate) {
    return NextResponse.json({ error: mandateErr?.message ?? 'Error creando mandato' }, { status: 500 })
  }

  // Credenciales Redsys del club
  const { data: club } = await admin
    .from('clubs')
    .select('redsys_merchant_code, redsys_secret_key, redsys_merchant_terminal, redsys_env')
    .eq('id', clubId)
    .single()

  const merchantCode = club?.redsys_merchant_code ?? process.env.REDSYS_MERCHANT_CODE ?? ''
  const secretKey = club?.redsys_secret_key ?? process.env.REDSYS_SECRET_KEY ?? ''
  const terminal = club?.redsys_merchant_terminal ?? process.env.REDSYS_MERCHANT_TERMINAL ?? '001'
  const env = club?.redsys_env ?? null

  const orderId = generateOrderId()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://padelschoolmanager.com'

  // Guardar el payment como pending para que el webhook lo identifique
  await admin.from('payments').insert({
    user_id: userId,
    club_id: clubId,
    amount: amountCents,
    currency: 'eur',
    type: 'mandate_init',
    status: 'pending',
    redsys_order_id: orderId,
    metadata: { mandate_id: mandate.id },
  })

  const baseParams: Record<string, string> = {
    DS_MERCHANT_MERCHANTCODE: merchantCode,
    DS_MERCHANT_TERMINAL: terminal,
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_AMOUNT: String(amountCents),
    DS_MERCHANT_ORDER: orderId,
    DS_MERCHANT_CURRENCY: '978',
    DS_MERCHANT_URLOK: `${baseUrl}/pay/mandate-ok`,
    DS_MERCHANT_URLKO: `${baseUrl}/pay/mandate-ko`,
    DS_MERCHANT_MERCHANTURL: `${baseUrl}/api/payments/webhook`,
  }

  const params = buildCofInitParams(baseParams)
  const merchantParameters = buildMerchantParameters(params)
  const signature = generateSignature(secretKey, orderId, merchantParameters)

  return NextResponse.json({
    mandateId: mandate.id,
    redsysUrl: getRedsysUrl(env),
    merchantParameters,
    signature,
  })
}
