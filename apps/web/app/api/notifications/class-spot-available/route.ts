export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { formatTime } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { scheduleId } = await req.json()
  if (!scheduleId) return NextResponse.json({ error: 'scheduleId requerido' }, { status: 400 })

  const admin = getAdminClient()

  const { data: schedule } = await admin
    .from('schedules')
    .select('id, max_students, level_id, club_id, start_time, court:courts(name)')
    .eq('id', scheduleId)
    .single()

  if (!schedule) return NextResponse.json({ ok: true, sent: 0 })

  const { count: occupied } = await admin
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('schedule_id', scheduleId)
    .neq('status', 'cancelled')

  const freePlaces = schedule.max_students - (occupied ?? 0)
  if (freePlaces <= 0) return NextResponse.json({ ok: true, sent: 0 })

  const { data: enrolled } = await admin
    .from('bookings')
    .select('student_id')
    .eq('schedule_id', scheduleId)
    .neq('status', 'cancelled')

  const enrolledIds = (enrolled ?? []).map((b: any) => b.student_id)

  // same level if class has a level_id, otherwise all students; TS loses type on chained builder
  let query: any = admin
    .from('users')
    .select('id, push_token, name')
    .eq('role', 'student')
    .eq('is_active', true)
    .not('push_token', 'is', null)

  if (schedule.club_id) query = query.eq('club_id', schedule.club_id)
  if (schedule.level_id) query = query.eq('current_level_id', schedule.level_id)
  if (enrolledIds.length > 0) query = query.not('id', 'in', `(${enrolledIds.join(',')})`)

  const { data: candidates } = await query

  if (!candidates?.length) return NextResponse.json({ ok: true, sent: 0 })

  const startTime = new Date(schedule.start_time)
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const day = dayNames[startTime.getDay()]
  const hour = formatTime(startTime)
  const court = (schedule.court as any)?.name ?? 'Pista'

  const messages = candidates.map((s: any) => ({
    to: s.push_token,
    title: `¡Plaza libre! 🎾`,
    body: `${court} · ${day} ${hour}. ¡${freePlaces} ${freePlaces === 1 ? 'hueco' : 'huecos'} disponible${freePlaces === 1 ? '' : 's'}!`,
    sound: 'default',
    data: { scheduleId },
  }))

  let sent = 0
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    })
    sent += messages.slice(i, i + 100).length
  }

  return NextResponse.json({ ok: true, sent })
}
