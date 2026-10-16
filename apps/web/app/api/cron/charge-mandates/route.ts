export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { generateOrderId, chargeMit } from '@/lib/redsys'
import { applyMandateItems, loadMandateItems, nextChargeDate, type MandateItem } from '@/lib/mandate-charge'
import { timingSafeEqual } from 'crypto'

const MAX_AMOUNT_CENTS = 99_999

// Llamar cada día a las 08:00 desde Railway cron o similar
// Cobra a todos los mandatos activos cuyo next_charge_at es hoy o anterior
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? ''
  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${cronSecret}`
  const isValid = !!cronSecret && authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  if (!isValid) {
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

  const uniqueClubIds = [...new Set(mandates.map(m => m.club_id))]
  const { data: clubsData } = await admin
    .from('clubs')
    .select('id, redsys_merchant_code, redsys_secret_key, redsys_merchant_terminal, redsys_env, features')
    .in('id', uniqueClubIds)
  const clubMap = Object.fromEntries((clubsData ?? []).map((c: any) => [c.id, c]))

  const results: { mandateId: string; success: boolean; code: string }[] = []

  for (const mandate of mandates) {
    const club = clubMap[mandate.club_id]

    const merchantCode = club?.redsys_merchant_code ?? process.env.REDSYS_MERCHANT_CODE ?? ''
    const secretKey = club?.redsys_secret_key ?? process.env.REDSYS_SECRET_KEY ?? ''
    const terminal = club?.redsys_merchant_terminal ?? process.env.REDSYS_MERCHANT_TERMINAL ?? '001'
    const env = club?.redsys_env ?? null

    // Solo se cobran los grupos que deben el mes (los ya pagados en efectivo
    // o adelantados no), y el importe es la suma de sus cuotas.
    let items: MandateItem[]
    try {
      items = await loadMandateItems(admin, { userId: mandate.user_id, clubId: mandate.club_id, mode: 'monthly' })
    } catch (err) {
      console.error('[charge-mandates] enrollment lookup failed for mandate', mandate.id, err)
      results.push({ mandateId: mandate.id, success: false, code: 'LOOKUP_ERROR' })
      continue
    }
    const chargeAmountCents = items.reduce((sum, i) => sum + i.amount, 0)
    if (!items.length || chargeAmountCents <= 0) {
      await admin.from('payment_mandates')
        .update({ next_charge_at: nextChargeDate(mandate.day_of_month), updated_at: new Date().toISOString() })
        .eq('id', mandate.id)
      results.push({ mandateId: mandate.id, success: true, code: 'NOTHING_DUE' })
      continue
    }
    if (chargeAmountCents > MAX_AMOUNT_CENTS) {
      console.error('[charge-mandates] importe excede el máximo para mandate', mandate.id, chargeAmountCents)
      results.push({ mandateId: mandate.id, success: false, code: 'AMOUNT_EXCEEDS_CAP' })
      continue
    }

    const orderId = generateOrderId()

    // Registrar el pago como pending antes de llamar a Redsys
    const { data: payment, error: payInsertErr } = await admin.from('payments').insert({
      user_id: mandate.user_id,
      club_id: mandate.club_id,
      amount: chargeAmountCents,
      currency: 'eur',
      type: 'mandate_charge',
      status: 'pending',
      redsys_order_id: orderId,
      metadata: { mandate_id: mandate.id, items, paid_until: items[0].paid_until },
    }).select('id').single()

    if (payInsertErr || !payment) {
      console.error('[charge-mandates] payment insert failed for mandate', mandate.id, payInsertErr?.message)
      results.push({ mandateId: mandate.id, success: false, code: 'INSERT_ERROR' })
      continue
    }

    let chargeResult: { success: boolean; responseCode: string }
    try {
      chargeResult = await chargeMit({
        secretKey,
        merchantCode,
        terminal,
        env,
        identifier: mandate.redsys_identifier!,
        amountCents: chargeAmountCents,
        orderId,
      })
    } catch (err) {
      console.error('[charge-mandates] chargeMit threw for mandate', mandate.id, err)
      chargeResult = { success: false, responseCode: 'EXCEPTION' }
    }
    const { success, responseCode } = chargeResult

    const nextChargeAt = nextChargeDate(mandate.day_of_month)
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
    if (success) {
      try {
        await applyMandateItems(admin, mandate.user_id, items)
      } catch (err) {
        console.error('[charge-mandates] cobro hecho pero no se pudo marcar como pagado, mandate', mandate.id, err)
      }
    }

    results.push({ mandateId: mandate.id, success, code: responseCode })
  }

  const charged = results.filter(r => r.success).length
  return NextResponse.json({ ok: true, charged, total: mandates.length, results })
}
