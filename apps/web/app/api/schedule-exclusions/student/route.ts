export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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
  const canPublish = hoursUntilClass >= cancellationHours

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
    publish_spot: canPublish,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, publishedSpot: canPublish, excludedDate: dateStr })
}
