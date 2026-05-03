export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Day of week for tomorrow (0=Sun, 1=Mon, ...)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDow = tomorrow.getDay()

  const { data: schedules } = await adminSupabase
    .from('schedules')
    .select('id, start_time, end_time, court:courts(name)')
    .eq('is_active', true)
    .in('recurrence', ['weekly', 'biweekly'])

  const tomorrowSchedules = (schedules ?? []).filter(
    (s: any) => new Date(s.start_time).getDay() === tomorrowDow
  )

  if (tomorrowSchedules.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const scheduleIds = tomorrowSchedules.map((s: any) => s.id)
  const scheduleMap = Object.fromEntries(tomorrowSchedules.map((s: any) => [s.id, s]))

  const { data: bookings } = await adminSupabase
    .from('bookings')
    .select('schedule_id, student:users!bookings_student_id_fkey(push_token, name)')
    .in('schedule_id', scheduleIds)
    .eq('status', 'confirmed')

  const messages: any[] = []
  ;(bookings ?? []).forEach((b: any) => {
    const token = b.student?.push_token
    if (!token) return
    const sched = scheduleMap[b.schedule_id]
    const startTime = new Date(sched.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    messages.push({
      to: token,
      title: '¡Tienes clase mañana! 🎾',
      body: `${sched.court?.name ?? 'Pista'} a las ${startTime}. ¡Nos vemos en la pista!`,
      sound: 'default',
    })
  })

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
