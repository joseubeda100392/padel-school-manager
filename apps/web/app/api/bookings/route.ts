export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getScheduleDateTimeInMadrid } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: body, error: badRequest } = await parseBody(req, z.object({ scheduleId: z.string().uuid() }))
  if (badRequest) return badRequest
  const { scheduleId } = body

  const admin = getAdminClient()

  // Overlap check: prevent booking two classes at the same time on the same weekday
  const [{ data: newSched }, { data: existing }] = await Promise.all([
    admin.from('schedules').select('start_time, end_time, recurrence_end_date').eq('id', scheduleId).single(),
    admin.from('bookings')
      .select('schedule_id, schedules(start_time, end_time, recurrence_end_date)')
      .eq('student_id', user.id)
      .neq('status', 'cancelled')
      .neq('schedule_id', scheduleId),
  ])
  if (newSched) {
    const TZ = 'Europe/Madrid'
    const nStart = new Date(newSched.start_time)
    const nEnd = new Date(newSched.end_time)
    const nDow = nStart.getUTCDay()
    const nStartMin = nStart.getUTCHours() * 60 + nStart.getUTCMinutes()
    const nEndMin = nEnd.getUTCHours() * 60 + nEnd.getUTCMinutes()
    const nStartDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(nStart)
    const nEndDate = (newSched as any).recurrence_end_date ?? null

    for (const b of existing ?? []) {
      const s = (b as any).schedules
      if (!s) continue
      const sStart = new Date(s.start_time)
      const sEnd = new Date(s.end_time)
      if (sStart.getUTCDay() !== nDow) continue
      const sStartMin = sStart.getUTCHours() * 60 + sStart.getUTCMinutes()
      const sEndMin = sEnd.getUTCHours() * 60 + sEnd.getUTCMinutes()
      if (sStartMin >= nEndMin || sEndMin <= nStartMin) continue
      const sStartDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(sStart)
      const sEndDate = s.recurrence_end_date ?? null
      if (nEndDate && sStartDate > nEndDate) continue
      if (sEndDate && nStartDate > sEndDate) continue
      return NextResponse.json({ error: 'Ya tienes una clase en ese horario' }, { status: 409 })
    }
  }

  const { data, error } = await admin.rpc('book_with_bag', {
    p_schedule_id: scheduleId,
    p_student_id: user.id,
  })

  if (error) return NextResponse.json({ error: 'Error al procesar la reserva' }, { status: 500 })
  if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 })
  return NextResponse.json({ ok: true, bookingId: data.booking_id, newBalance: data.new_balance })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: delBody, error: badDelete } = await parseBody(req, z.object({
    bookingId: z.string().uuid().optional(),
    scheduleId: z.string().uuid().optional(),
    refundBag: z.boolean().optional(),
  }).refine((v) => v.bookingId || v.scheduleId, { message: 'Falta bookingId o scheduleId' }))
  if (badDelete) return badDelete
  const { bookingId, scheduleId, refundBag } = delBody
  const admin = getAdminClient()

  const { data: callerProfile } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  const isAdmin = ['admin', 'super_admin', 'coach'].includes(callerProfile?.role ?? '')

  // Admins can cancel any booking; students only their own
  let bookingQuery = admin.from('bookings').select('id, source, schedule_id, student_id, club_id, class_date').neq('status', 'cancelled')
  if (bookingId) {
    bookingQuery = bookingQuery.eq('id', bookingId)
    if (!isAdmin) {
      bookingQuery = bookingQuery.eq('student_id', user.id)
    } else if (callerProfile?.role !== 'super_admin' && callerProfile?.club_id) {
      bookingQuery = bookingQuery.eq('club_id', callerProfile.club_id)
    }
  } else {
    bookingQuery = bookingQuery.eq('schedule_id', scheduleId).eq('student_id', user.id)
  }
  const { data: booking } = await bookingQuery.single()

  if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  // Coaches can only cancel bookings for classes they teach
  if (callerProfile?.role === 'coach') {
    const { data: scheduleOwner } = await admin
      .from('schedules')
      .select('coach_id')
      .eq('id', booking.schedule_id)
      .single()
    if (!scheduleOwner || scheduleOwner.coach_id !== user.id) {
      return NextResponse.json({ error: 'Solo puedes cancelar reservas de tus propias clases' }, { status: 403 })
    }
  }

  const studentId = booking.student_id ?? user.id

  // Plazo de cancelación: solo autoservicio (no admin/coach) y solo reservas con fecha concreta
  if (!isAdmin && (booking as any).class_date) {
    const [{ data: sched }, { data: clubRow }] = await Promise.all([
      admin.from('schedules').select('start_time').eq('id', booking.schedule_id).single(),
      admin.from('clubs').select('config').eq('id', booking.club_id).single(),
    ])
    if (sched) {
      const cancellationHours = (clubRow as any)?.config?.cancellation_hours ?? 24
      const classDt = getScheduleDateTimeInMadrid(sched.start_time, (booking as any).class_date)
      const hoursUntilClass = (classDt.getTime() - Date.now()) / 3600000
      if (hoursUntilClass < cancellationHours) {
        return NextResponse.json({ error: `Debes avisar con al menos ${cancellationHours} horas de antelación` }, { status: 400 })
      }
    }
  }

  // Leer la tx original ANTES de borrar bag_transactions (necesario para durationType del reembolso)
  let originalTx: { class_duration: string | null } | null = null
  if (refundBag && booking.source === 'bag') {
    const { data: tx } = await admin
      .from('bag_transactions')
      .select('class_duration')
      .eq('booking_id', booking.id)
      .eq('type', 'debit')
      .maybeSingle()
    originalTx = tx
  }

  // bag_transactions se borra (no es rastro fiscal); payments se conserva
  // (FK ON DELETE SET NULL) para no perder el historial de cobros de Redsys.
  await admin.from('bag_transactions').delete().eq('booking_id', booking.id)

  const { error: deleteErr } = await admin.from('bookings').delete().eq('id', booking.id)
  if (deleteErr) return NextResponse.json({ error: 'Error al cancelar la reserva' }, { status: 500 })

  if (refundBag && (booking.source === 'bag' || booking.source === 'pay_per_class')) {
    let durationType: '60' | '90' = '60'

    if (booking.source === 'bag') {
      durationType = originalTx?.class_duration === '90' ? '90' : '60'
    } else {
      const { data: sched } = await admin
        .from('schedules')
        .select('start_time, end_time')
        .eq('id', booking.schedule_id)
        .single()
      if (sched) {
        const mins = Math.round((new Date(sched.end_time).getTime() - new Date(sched.start_time).getTime()) / 60000)
        durationType = mins >= 80 ? '90' : '60'
      }
    }

    // Crédito atómico — crea la fila de bolsa si no existía (antes el reembolso se perdía en silencio)
    const { data: creditResult, error: creditErr } = await admin.rpc('credit_class_bag', {
      p_user_id: studentId,
      p_club_id: booking.club_id ?? null,
      p_delta: 1,
      p_pack_type: durationType,
      p_reason: 'Cancelación de clase',
    })
    if (creditErr || creditResult?.error) {
      console.error('[bookings] refund credit failed:', creditErr?.message ?? creditResult?.error)
      return NextResponse.json({ error: 'Error al devolver crédito a la bolsa' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, newBalance: creditResult.new_balance })
  }

  return NextResponse.json({ ok: true })
}
