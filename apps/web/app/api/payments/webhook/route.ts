export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignature, parseRedsysResponse, isPaymentSuccessful } from '@/lib/redsys'
import { sendPushToUsers } from '@/lib/push'
import { resetEnrollmentDiscountAfterPayment } from '@/lib/enrollment-discount'
import { computePaidUntil, computeBillingCycle } from '@/lib/billing-cycle'

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

  if (!payment) return NextResponse.json({ error: 'Solicitud no válida' }, { status: 400 })

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
    return NextResponse.json({ error: 'Solicitud no válida' }, { status: 400 })
  }

  // Validar que el importe del IPN coincide con el registrado en BD
  const responseAmount = response.Ds_Amount ?? (response as any).DS_AMOUNT
  if (responseAmount !== undefined && String(payment.amount) !== String(responseAmount)) {
    console.error('[webhook] amount mismatch: expected', payment.amount, 'got', responseAmount)
    return NextResponse.json({ error: 'Solicitud no válida' }, { status: 400 })
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

  // Si el efecto (reserva/crédito/etc.) falla tras el claim, revertir a 'pending'
  // para que el próximo reintento de Redsys pueda reprocesarlo en vez de quedar
  // marcado 'succeeded' sin haber entregado lo pagado.
  const revertToPending = () =>
    adminSupabase.from('payments').update({ status: 'pending' }).eq('id', payment.id).eq('status', 'succeeded')

  const meta = payment.metadata ?? {}

  if (payment.type === 'single_class' && meta.schedule_id) {
    if (meta.exclusion_id) {
      await adminSupabase
        .from('schedule_exclusions')
        .update({ publish_spot: false })
        .eq('id', meta.exclusion_id)
    }

    if (meta.class_date) {
      // Aforo comprobado de forma atómica (bloqueo de la fila de schedules) —
      // evita que dos pagos simultáneos superen max_students, y que alguien
      // pague su plaza individual sobre una fecha ya cubierta por "clase
      // entera". El dinero ya se ha cobrado en Redsys en este punto: si la
      // clase ya está completa/cubierta no se puede simplemente rechazar el
      // pago, así que se deja constancia en el pago y se avisa al admin para
      // que lo resuelva a mano (reembolso, contactar al alumno, etc.).
      const { data: rpcResult, error: rpcErr } = await adminSupabase.rpc('book_paid_class_spot', {
        p_schedule_id: meta.schedule_id,
        p_student_id: payment.user_id,
        p_class_date: meta.class_date,
        p_whole_class: meta.whole_class ?? false,
      })

      if (rpcErr) {
        console.error('[webhook] single_class booking RPC failed:', rpcErr.message)
        await revertToPending()
        return NextResponse.json({ error: 'booking_failed' }, { status: 500 })
      }

      if (rpcResult?.error) {
        console.error('[webhook] single_class capacity conflict:', rpcResult.error, 'payment', payment.id)
        await adminSupabase
          .from('payments')
          .update({ metadata: { ...meta, capacity_conflict: rpcResult.error } })
          .eq('id', payment.id)

        const { data: admins } = await adminSupabase
          .from('users')
          .select('id')
          .eq('club_id', payment.club_id)
          .in('role', ['admin', 'super_admin'])
        const adminIds = (admins ?? []).map((a) => a.id)
        if (adminIds.length) {
          await sendPushToUsers(adminIds, {
            title: 'Conflicto de aforo — pago ya cobrado',
            body: `Un alumno ha pagado una clase para el ${meta.class_date} que ya está completa/cubierta. Revisa el pago ${payment.id} para gestionar el reembolso.`,
          }, 'admin_message')
        }
        // No se revierte a pending: el cobro en Redsys ya se hizo y es
        // definitivo, revertir el status aquí no deshace el cargo real.
      }
    } else {
      // Camino de compatibilidad si algún día llega sin class_date (no
      // ocurre en los flujos actuales de la app): comportamiento anterior,
      // sin chequeo de aforo.
      const { data: existing } = await adminSupabase
        .from('bookings')
        .select('id')
        .eq('schedule_id', meta.schedule_id)
        .eq('student_id', payment.user_id)
        .neq('status', 'cancelled')
        .maybeSingle()

      if (!existing) {
        const { error: bookingErr } = await adminSupabase.from('bookings').insert({
          schedule_id: meta.schedule_id,
          student_id: payment.user_id,
          status: 'confirmed',
          source: 'pay_per_class',
          club_id: payment.club_id ?? null,
          class_date: null,
        })
        if (bookingErr) {
          console.error('[webhook] single_class booking failed:', bookingErr.message)
          await revertToPending()
          return NextResponse.json({ error: 'booking_failed' }, { status: 500 })
        }
      }
    }

  } else if (payment.type === 'class_pack') {
    const classesToAdd = meta.classes_per_pack ?? 10
    const packType: '60' | '90' = meta.pack_type === '90' ? '90' : '60'

    const { error: rpcErr } = await adminSupabase.rpc('credit_class_bag', {
      p_user_id: payment.user_id,
      p_club_id: payment.club_id ?? null,
      p_delta: classesToAdd,
      p_pack_type: packType,
      p_reason: `Compra de bono — ${classesToAdd} clases`,
    })
    if (rpcErr) {
      console.error('[webhook] class_pack credit_class_bag failed:', rpcErr.message)
      await revertToPending()
      return NextResponse.json({ error: 'credit_failed' }, { status: 500 })
    }

  } else if (payment.type === 'fixed_group_month' && meta.enrollment_id) {
    const now = new Date()
    const paidUntil = computePaidUntil(now)
    const { error: enrollErr } = await adminSupabase
      .from('group_enrollments')
      .update({ paid_until: paidUntil })
      .eq('id', meta.enrollment_id)
      .eq('student_id', payment.user_id)
    if (enrollErr) {
      console.error('[webhook] fixed_group_month enrollment update failed:', enrollErr.message)
      await revertToPending()
      return NextResponse.json({ error: 'enrollment_update_failed' }, { status: 500 })
    }

    // Descuento puntual, no permanente: se cobró este mes ya con el precio
    // rebajado, se resetea para que el siguiente vuelva al precio normal.
    // Nunca debe tirar abajo la confirmación de un pago ya cobrado — si
    // falla, se registra y se sigue; el pago ya está bien procesado arriba.
    try {
      await resetEnrollmentDiscountAfterPayment(adminSupabase, meta.enrollment_id)
    } catch (err) {
      console.error('[webhook] resetEnrollmentDiscountAfterPayment failed:', err)
    }

  } else if (payment.type === 'tournament' && meta.tournament_id) {
    const { data: existing } = await adminSupabase
      .from('tournament_registrations')
      .select('id')
      .eq('tournament_id', meta.tournament_id)
      .eq('student_id', payment.user_id)
      .maybeSingle()
    if (!existing) {
      const { error: regErr } = await adminSupabase.from('tournament_registrations').insert({
        tournament_id: meta.tournament_id,
        student_id: payment.user_id,
      })
      if (regErr) {
        console.error('[webhook] tournament registration failed:', regErr.message)
        await revertToPending()
        return NextResponse.json({ error: 'registration_failed' }, { status: 500 })
      }
    }

  } else if (payment.type === 'mandate_init' && meta.mandate_id) {
    const identifier = response.Ds_Merchant_Identifier ?? response.DS_MERCHANT_IDENTIFIER ?? response.Ds_Identifier ?? null
    if (!identifier) {
      console.error('[webhook] mandate_init: Redsys no devolvió Ds_Merchant_Identifier para mandate', meta.mandate_id)
      await revertToPending()
      return NextResponse.json({ error: 'mandate_identifier_missing' }, { status: 500 })
    }
    const { data: mandate } = await adminSupabase
      .from('payment_mandates')
      .select('day_of_month')
      .eq('id', meta.mandate_id)
      .single()
    const dayOfMonth = mandate?.day_of_month ?? 1
    const now = new Date()
    const { paidUntil, nextChargeAt } = computeBillingCycle(now, dayOfMonth)
    const { error: mandateErr } = await adminSupabase
      .from('payment_mandates')
      .update({
        ...(identifier ? { redsys_identifier: identifier } : {}),
        status: 'active',
        last_charged_at: now.toISOString(),
        next_charge_at: nextChargeAt,
        updated_at: now.toISOString(),
      })
      .eq('id', meta.mandate_id)
    if (mandateErr) {
      console.error('[webhook] mandate_init mandate update failed:', mandateErr.message)
      await revertToPending()
      return NextResponse.json({ error: 'mandate_update_failed' }, { status: 500 })
    }

    // Marcar inscripciones activas del alumno como pagadas hasta paidUntil
    const { error: mandEnrolErr } = await adminSupabase
      .from('group_enrollments')
      .update({ paid_until: paidUntil })
      .eq('student_id', payment.user_id)
      .eq('club_id', payment.club_id)
      .eq('status', 'active')
    if (mandEnrolErr) {
      console.error('[webhook] mandate_init enrollment update failed:', mandEnrolErr.message)
    }

  } else if (payment.type === 'intensivo_group' && meta.intensivo_group_id) {
    const { data: schedules } = await adminSupabase
      .from('schedules')
      .select('id, start_time')
      .eq('intensivo_group_id', meta.intensivo_group_id)
      .eq('is_active', true)
      .order('start_time')
    const classDates: string[] = meta.class_dates ?? []
    const sortedSchedules = (schedules ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time))
    for (let i = 0; i < sortedSchedules.length; i++) {
      const s = sortedSchedules[i]
      const { data: existing } = await adminSupabase
        .from('bookings')
        .select('id')
        .eq('schedule_id', s.id)
        .eq('student_id', payment.user_id)
        .neq('status', 'cancelled')
        .maybeSingle()
      if (!existing) {
        const { error: iBookingErr } = await adminSupabase.from('bookings').insert({
          schedule_id: s.id,
          student_id: payment.user_id,
          status: 'confirmed',
          source: 'pay_per_class',
          club_id: payment.club_id ?? null,
          class_date: classDates[i] ?? null,
        })
        if (iBookingErr) {
          console.error('[webhook] intensivo_group booking failed:', iBookingErr.message)
          await revertToPending()
          return NextResponse.json({ error: 'intensivo_booking_failed' }, { status: 500 })
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
