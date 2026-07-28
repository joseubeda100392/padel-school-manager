export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'
import { formatTime } from '@/lib/utils'

function getClassDatetime(startTime: string, dateStr: string): Date {
  const base = new Date(startTime)
  const d = new Date(dateStr + 'T12:00:00')
  d.setHours(base.getHours(), base.getMinutes(), 0, 0)
  return d
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }))
  if (badRequest) return badRequest
  const { scheduleId, date } = body

  const admin = getAdminClient()

  const { data: userProfile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const clubId = (userProfile as any)?.club_id ?? null

  const [{ data: enrollment }, { data: schedule }, { data: clubRow }] = await Promise.all([
    admin.from('group_enrollments')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('student_id', user.id)
      .eq('status', 'active')
      .single(),
    admin.from('schedules').select('start_time, end_time, court:courts(name), level:levels(name)').eq('id', scheduleId).single(),
    clubId
      ? admin.from('clubs').select('config').eq('id', clubId).single()
      : { data: null },
  ])

  if (!enrollment) return NextResponse.json({ error: 'No estás inscrito en este grupo' }, { status: 403 })
  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  const cancellationHours = (clubRow as any)?.config?.cancellation_hours ?? 24
  const dateStr = date as string
  const classDt = getClassDatetime(schedule.start_time, dateStr)


  const base = new Date(schedule.start_time)
  if (classDt.getDay() !== base.getDay()) {
    return NextResponse.json({ error: 'La fecha no corresponde al día de la clase' }, { status: 400 })
  }

  const hoursUntilClass = (classDt.getTime() - Date.now()) / 3600000
  if (hoursUntilClass < 0) {
    return NextResponse.json({ error: 'La fecha ya ha pasado' }, { status: 400 })
  }
  if (hoursUntilClass < cancellationHours) {
    return NextResponse.json({ error: `Debes avisar con al menos ${cancellationHours} horas de antelación` }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('schedule_exclusions')
    .select('id')
    .eq('group_enrollment_id', enrollment.id)
    .eq('excluded_date', dateStr)
    .single()

  if (existing) return NextResponse.json({ error: 'Ya tienes registrada la falta para esa fecha' }, { status: 400 })

  const { data, error } = await admin.from('schedule_exclusions').insert({
    group_enrollment_id: enrollment.id,
    excluded_date: dateStr,
    publish_spot: true,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const durationMin = Math.round((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000)
  const durationType: '60' | '90' = durationMin >= 80 ? '90' : '60'

  const { data: bag } = await admin.from('class_bag').select('id, balance_60, balance_90').eq('user_id', user.id).single()
  if (bag) {
    const newBal60 = durationType === '60' ? bag.balance_60 + 1 : bag.balance_60
    const newBal90 = durationType === '90' ? bag.balance_90 + 1 : bag.balance_90
    await admin.from('class_bag').update({ balance_60: newBal60, balance_90: newBal90, updated_at: new Date().toISOString() }).eq('id', bag.id)
    await admin.from('bag_transactions').insert({
      user_id: user.id,
      class_bag_id: bag.id,
      delta: 1,
      type: 'credit',
      reason: `Falta registrada ${dateStr}`,
      class_duration: durationType,
    })
  }

  try {
    const { data: enrolledIds } = await admin
      .from('group_enrollments')
      .select('student_id')
      .eq('schedule_id', scheduleId)
      .eq('status', 'active')

    const excludedIds = new Set((enrolledIds ?? []).map((e: any) => e.student_id))

    const q = admin.from('users').select('id').eq('role', 'student').eq('is_active', true)
    const { data: candidates } = await (clubId ? q.eq('club_id', clubId) : q)
    const targetIds = (candidates ?? []).map((u: any) => u.id).filter((id: string) => !excludedIds.has(id))

    if (targetIds.length > 0) {
      const sc = schedule as any
      const startDt = new Date(sc.start_time)
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      const timeStr = formatTime(startDt)
      const levelName = sc.level?.name ? ` · ${sc.level.name}` : ''
      const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

      await sendPushToUsers(targetIds, {
        title: '🎾 ¡Hueco libre disponible!',
        body: `${dayNames[startDt.getDay()]} ${dateLabel} a las ${timeStr}${levelName} — ${sc.court?.name ?? ''}`,
        url: '/student/spots',
      }, 'spot_available')
    }
  } catch {
    // no interrumpir la respuesta si falla el push
  }

  return NextResponse.json({ data, publishedSpot: true, excludedDate: dateStr })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { exclusionId } = await req.json()
  if (!exclusionId) return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 })

  const admin = getAdminClient()

  const { data: exclusion } = await admin
    .from('schedule_exclusions')
    .select('id, excluded_date, group_enrollment_id')
    .eq('id', exclusionId)
    .single()

  if (!exclusion) return NextResponse.json({ error: 'Falta no encontrada' }, { status: 404 })

  const { data: enrollment } = await admin
    .from('group_enrollments')
    .select('student_id, schedule_id')
    .eq('id', exclusion.group_enrollment_id)
    .single()

  if (!enrollment || enrollment.student_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Verificar que la clase no ha pasado
  const { data: schedule } = await admin
    .from('schedules')
    .select('start_time, end_time')
    .eq('id', enrollment.schedule_id)
    .single()

  if (schedule) {
    const base = new Date(schedule.start_time)
    const classDt = new Date(exclusion.excluded_date + 'T12:00:00')
    classDt.setHours(base.getHours(), base.getMinutes(), 0, 0)
    if (classDt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'La clase ya ha pasado' }, { status: 400 })
    }
  }

  // Verificar que nadie ha reservado el hueco
  const { data: bookings } = await admin
    .from('bookings')
    .select('id')
    .eq('schedule_id', enrollment.schedule_id)
    .eq('class_date', exclusion.excluded_date)
    .neq('status', 'cancelled')
    .limit(1)

  if (bookings && bookings.length > 0) {
    return NextResponse.json({ error: 'Alguien ya ha reservado tu plaza, no puedes cancelar la falta' }, { status: 409 })
  }

  await admin.from('schedule_exclusions').delete().eq('id', exclusionId)

  // Revertir el crédito de bolsa
  const { data: originalTx } = await admin
    .from('bag_transactions')
    .select('class_duration')
    .eq('user_id', user.id)
    .eq('type', 'credit')
    .like('reason', `Falta registrada ${exclusion.excluded_date}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let durationType: '60' | '90' = '60'
  if (originalTx?.class_duration === '90') {
    durationType = '90'
  } else if (!originalTx && schedule) {
    const durationMin = Math.round(
      (new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000
    )
    durationType = durationMin >= 80 ? '90' : '60'
  }

  const { data: bag } = await admin.from('class_bag').select('id, balance_60, balance_90').eq('user_id', user.id).single()
  if (bag) {
    const newBal60 = durationType === '60' ? Math.max(0, bag.balance_60 - 1) : bag.balance_60
    const newBal90 = durationType === '90' ? Math.max(0, bag.balance_90 - 1) : bag.balance_90
    await admin.from('class_bag').update({ balance_60: newBal60, balance_90: newBal90, updated_at: new Date().toISOString() }).eq('id', bag.id)
    await admin.from('bag_transactions').insert({
      user_id: user.id,
      class_bag_id: bag.id,
      delta: -1,
      type: 'debit',
      reason: 'Falta cancelada por alumno',
      class_duration: durationType,
    })
  }

  return NextResponse.json({ ok: true })
}
