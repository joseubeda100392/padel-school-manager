export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushToUsers } from '@/lib/push'

const adminSupabase = () => createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function getNextOccurrence(startTime: string): { date: Date; dateStr: string } {
  const base = new Date(startTime)
  const now = new Date()
  const next = new Date(now)
  next.setHours(base.getHours(), base.getMinutes(), 0, 0)
  const todayDow = now.getDay()
  const classDow = base.getDay()
  let daysAhead = (classDow - todayDow + 7) % 7
  if (daysAhead === 0 && next <= now) daysAhead = 7
  next.setDate(next.getDate() + daysAhead)
  return { date: next, dateStr: next.toISOString().split('T')[0] }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { scheduleId } = await req.json()
  const admin = adminSupabase()

  const [{ data: enrollment }, { data: schedule }, { data: cfgRow }] = await Promise.all([
    admin.from('group_enrollments')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('student_id', user.id)
      .eq('status', 'active')
      .single(),
    admin.from('schedules').select('start_time').eq('id', scheduleId).single(),
    admin.from('app_config').select('value').eq('key', 'cancellation_hours').single(),
  ])

  if (!enrollment) return NextResponse.json({ error: 'No estás inscrito en este grupo' }, { status: 403 })
  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  const cancellationHours = cfgRow ? Number(cfgRow.value) : 24
  const { date: nextOccurrence, dateStr } = getNextOccurrence(schedule.start_time)
  const hoursUntilClass = (nextOccurrence.getTime() - Date.now()) / 3600000

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

  const { data: bag } = await admin.from('class_bag').select('id, balance').eq('user_id', user.id).single()
  if (bag) {
    await admin.from('class_bag').update({ balance: bag.balance + 1, updated_at: new Date().toISOString() }).eq('id', bag.id)
    await admin.from('bag_transactions').insert({
      user_id: user.id,
      class_bag_id: bag.id,
      delta: 1,
      type: 'credit',
      reason: `Falta registrada ${dateStr}`,
    })
  }

  // Notificar a alumnos del mismo club que NO están en este grupo
  try {
    const { data: scheduleData } = await admin
      .from('schedules')
      .select('start_time, end_time, court:courts(name), level:levels(name)')
      .eq('id', scheduleId)
      .single()

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

    if (targetIds.length > 0 && scheduleData) {
      const sc = scheduleData as any
      const startDt = new Date(sc.start_time)
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      const timeStr = startDt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      const levelName = sc.level?.name ? ` · ${sc.level.name}` : ''
      const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

      await sendPushToUsers(targetIds, {
        title: '🎾 ¡Hueco libre disponible!',
        body: `${dayNames[startDt.getDay()]} ${dateLabel} a las ${timeStr}${levelName} — ${sc.court?.name ?? ''}`,
        url: '/student/spots',
      }, 'spot_available')
    }
  } catch {
    // No interrumpir la respuesta si falla el push
  }

  return NextResponse.json({ data, publishedSpot: true, excludedDate: dateStr })
}
