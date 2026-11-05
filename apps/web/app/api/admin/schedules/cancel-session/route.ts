export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { isActiveOn } from '@/lib/enrollment-window'
import { CLUB_CANCELLED_REASON, cancelBookingsOn } from '@/lib/schedule-from-date'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    creditBags: z.boolean().optional(),
  }))
  if (badRequest) return badRequest
  const { scheduleId, date, creditBags = true } = body

  const { data: schedule } = await admin.from('schedules').select('start_time, end_time, club_id').eq('id', scheduleId).single()
  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  if (caller.role !== 'super_admin' && (schedule as any).club_id !== caller.club_id) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const durationMin = Math.round((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000)
  const durationType: '60' | '90' = durationMin >= 80 ? '90' : '60'

  const { data: enrollments } = await admin
    .from('group_enrollments')
    .select('id, student_id, start_date, end_date')
    .eq('schedule_id', scheduleId)
    .eq('status', 'active')

  // Reservas puntuales y listas de espera de ese día: la clase no se da, así
  // que se anulan y se devuelve a la bolsa la clase que gastaron.
  const clubId = (schedule as any).club_id ?? null
  const { cancelled: bookingsCancelled, paidByCard } = await cancelBookingsOn(admin, scheduleId, date, clubId, `Clase cancelada ${date}`)
  await admin.from('class_waitlist').delete().eq('schedule_id', scheduleId).eq('class_date', date)

  const { data: existingExclusions } = enrollments?.length
    ? await admin
        .from('schedule_exclusions')
        .select('id, group_enrollment_id')
        .in('group_enrollment_id', enrollments.map(e => e.id))
        .eq('excluded_date', date)
    : { data: [] as { id: string; group_enrollment_id: string }[] }

  // Quien ya había avisado de falta ya tiene su clase en la bolsa: no se le
  // suma otra, pero su hueco deja de estar publicado y la falta pasa a ser
  // «cancelada por el club» (así tampoco cuenta en las horas del monitor).
  const alreadyAbsent = existingExclusions ?? []
  if (alreadyAbsent.length) {
    const { error: updErr } = await admin.from('schedule_exclusions')
      .update({ reason: CLUB_CANCELLED_REASON, publish_spot: false })
      .in('id', alreadyAbsent.map(x => x.id))
    if (updErr) return NextResponse.json({ error: 'Error al registrar la cancelación' }, { status: 500 })
  }

  const alreadyExcluded = new Set(alreadyAbsent.map(x => x.group_enrollment_id))
  // Solo quien está en el grupo ese día (ni altas a futuro ni salidas ya pasadas).
  const toProcess = (enrollments ?? []).filter(e => !alreadyExcluded.has(e.id) && isActiveOn(e, date))
  const summary = { alreadyAbsent: alreadyAbsent.length, bookingsCancelled, paidByCard }

  if (!toProcess.length) return NextResponse.json({ ok: true, credited: 0, ...summary })

  const { error: insertErr } = await admin.from('schedule_exclusions').insert(
    toProcess.map(e => ({
      group_enrollment_id: e.id,
      excluded_date: date,
      reason: CLUB_CANCELLED_REASON,
      publish_spot: false,
      created_by: user.id,
    }))
  )

  if (insertErr) return NextResponse.json({ error: 'Error al registrar la cancelación' }, { status: 500 })

  let credited = 0
  if (creditBags) {
    for (const e of toProcess) {
      const { data: bag } = await admin.from('class_bag').select('id, balance_60, balance_90').eq('user_id', e.student_id).single()
      if (!bag) continue
      const newBal60 = durationType === '60' ? bag.balance_60 + 1 : bag.balance_60
      const newBal90 = durationType === '90' ? bag.balance_90 + 1 : bag.balance_90
      const { error: bagErr } = await admin.from('class_bag').update({ balance_60: newBal60, balance_90: newBal90, updated_at: new Date().toISOString() }).eq('id', bag.id)
      if (bagErr) {
        console.error('[cancel-session] bag update failed for student', e.student_id, bagErr.message)
        continue
      }
      const { error: txErr } = await admin.from('bag_transactions').insert({
        user_id: e.student_id,
        class_bag_id: bag.id,
        delta: 1,
        type: 'credit',
        reason: `Clase cancelada ${date}`,
        class_duration: durationType,
      })
      if (txErr) console.error('[cancel-session] bag_transactions insert failed for student', e.student_id, txErr.message)
      credited++
    }
  }

  return NextResponse.json({ ok: true, credited, ...summary })
}
