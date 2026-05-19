export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
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

  const { scheduleId, date } = await req.json()
  if (!scheduleId || !date) return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 })

  const admin = getAdminClient()

  const [{ data: enrollment }, { data: schedule }, { data: cfgRow }] = await Promise.all([
    admin.from('group_enrollments')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('student_id', user.id)
      .eq('status', 'active')
      .single(),
    admin.from('schedules').select('start_time, end_time, court:courts(name), level:levels(name)').eq('id', scheduleId).single(),
    admin.from('app_config').select('value').eq('key', 'cancellation_hours').single(),
  ])

  if (!enrollment) return NextResponse.json({ error: 'No estás inscrito en este grupo' }, { status: 403 })
  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  const cancellationHours = cfgRow ? Number(cfgRow.value) : 24
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

    const { data: adminUser } = await admin.from('users').select('club_id').eq('id', user.id).single()
    const clubId = (adminUser as any)?.club_id

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
