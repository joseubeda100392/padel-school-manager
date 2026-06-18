export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { generateOrderId, chargeMit } from '@/lib/redsys'

// Llamar cada día a las 08:00 desde Railway cron o similar
// Cobra a todos los mandatos activos cuyo next_charge_at es hoy o anterior
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = getAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: mandates } = await admin
    .from('payment_mandates')
    .select('id, user_id, club_id, redsys_identifier, amount_cents, day_of_month')
    .eq('status', 'active')
    .lte('next_charge_at', today)
    .not('redsys_identifier', 'is', null)

  if (!mandates?.length) return NextResponse.json({ ok: true, charged: 0 })

  const results: { mandateId: string; success: boolean; code: string }[] = []

  for (const mandate of mandates) {
    const { data: club } = await admin
      .from('clubs')
      .select('redsys_merchant_code, redsys_secret_key, redsys_merchant_terminal, redsys_env')
      .eq('id', mandate.club_id)
      .single()

    const merchantCode = club?.redsys_merchant_code ?? process.env.REDSYS_MERCHANT_CODE ?? ''
    const secretKey = club?.redsys_secret_key ?? process.env.REDSYS_SECRET_KEY ?? ''
    const terminal = club?.redsys_merchant_terminal ?? process.env.REDSYS_MERCHANT_TERMINAL ?? '001'
    const env = club?.redsys_env ?? null

    const orderId = generateOrderId()

    // Registrar el pago como pending antes de llamar a Redsys
    const { data: payment } = await admin.from('payments').insert({
      user_id: mandate.user_id,
      club_id: mandate.club_id,
      amount: mandate.amount_cents,
      currency: 'eur',
      type: 'mandate_charge',
      status: 'pending',
      redsys_order_id: orderId,
      metadata: { mandate_id: mandate.id },
    }).select('id').single()

    const { success, responseCode } = await chargeMit({
      secretKey,
      merchantCode,
      terminal,
      env,
      identifier: mandate.redsys_identifier!,
      amountCents: mandate.amount_cents,
      orderId,
    })

    const nextChargeAt = getNextChargeDate(mandate)
    const now = new Date().toISOString()

    await Promise.all([
      admin.from('payments').update({ status: success ? 'succeeded' : 'failed' }).eq('id', payment!.id),
      admin.from('payment_mandates').update({
        last_charged_at: now,
        next_charge_at: nextChargeAt,
        updated_at: now,
        ...(success ? {} : { status: 'paused' }),
      }).eq('id', mandate.id),
    ])

    results.push({ mandateId: mandate.id, success, code: responseCode })
  }

  const charged = results.filter(r => r.success).length
  return NextResponse.json({ ok: true, charged, total: mandates.length, results })
}

function getNextChargeDate(mandate: { day_of_month: number }): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, mandate.day_of_month)
  return next.toISOString().split('T')[0]
}
