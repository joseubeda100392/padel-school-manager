export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { generateOrderId, chargeMit } from '@/lib/redsys'
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

    if (mandate.amount_cents > MAX_AMOUNT_CENTS) {
      console.error('[charge-mandates] amount_cents excede cap para mandate', mandate.id, mandate.amount_cents)
      results.push({ mandateId: mandate.id, success: false, code: 'AMOUNT_EXCEEDS_CAP' })
      continue
    }

    // Módulo de validación de clases: descontar clases no dadas por causa
    // del club de las inscripciones activas de este alumno, si aplica.
    let discountedEnrollmentIds: string[] = []
    let mandateDiscountCents = 0
    if ((club as any)?.features?.enable_class_validation) {
      const { data: studentEnrollments } = await admin
        .from('group_enrollments')
        .select('id, price_per_class_cents, discount_classes_pending')
        .eq('student_id', mandate.user_id)
        .eq('club_id', mandate.club_id)
        .eq('status', 'active')
        .gt('discount_classes_pending', 0)
      for (const e of studentEnrollments ?? []) {
        if (!e.price_per_class_cents) continue
        mandateDiscountCents += e.discount_classes_pending * e.price_per_class_cents
        discountedEnrollmentIds.push(e.id)
      }
    }
    const chargeAmountCents = Math.max(0, mandate.amount_cents - mandateDiscountCents)

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
      metadata: { mandate_id: mandate.id, ...(mandateDiscountCents > 0 ? { discount_applied_cents: mandateDiscountCents } : {}) },
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

    const nextChargeAt = getNextChargeDate(mandate)
    const now = new Date().toISOString()

    const paidUntil = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    await Promise.all([
      admin.from('payments').update({ status: success ? 'succeeded' : 'failed' }).eq('id', payment!.id),
      admin.from('payment_mandates').update({
        last_charged_at: now,
        next_charge_at: nextChargeAt,
        updated_at: now,
        ...(success ? {} : { status: 'paused' }),
      }).eq('id', mandate.id),
      ...(success ? [
        admin.from('group_enrollments')
          .update({ paid_until: paidUntil, discount_classes_pending: 0 })
          .eq('student_id', mandate.user_id)
          .eq('club_id', mandate.club_id)
          .eq('status', 'active'),
      ] : []),
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
