export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { scheduleId, date, creditBags = true } = await req.json()
  if (!scheduleId || !date) return NextResponse.json({ error: 'scheduleId y date requeridos' }, { status: 400 })

  const { data: schedule } = await admin.from('schedules').select('start_time, end_time, club_id').eq('id', scheduleId).single()
  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  const durationMin = Math.round((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / 60000)
  const durationType: '60' | '90' = durationMin >= 80 ? '90' : '60'

  const { data: enrollments } = await admin
    .from('group_enrollments')
    .select('id, student_id')
    .eq('schedule_id', scheduleId)
    .eq('status', 'active')

  if (!enrollments?.length) return NextResponse.json({ ok: true, credited: 0 })

  const { data: existingExclusions } = await admin
    .from('schedule_exclusions')
    .select('group_enrollment_id')
    .in('group_enrollment_id', enrollments.map(e => e.id))
    .eq('excluded_date', date)

  const alreadyExcluded = new Set((existingExclusions ?? []).map((x: any) => x.group_enrollment_id))
  const toProcess = enrollments.filter(e => !alreadyExcluded.has(e.id))

  if (!toProcess.length) return NextResponse.json({ ok: true, credited: 0 })

  await admin.from('schedule_exclusions').insert(
    toProcess.map(e => ({
      group_enrollment_id: e.id,
      excluded_date: date,
      reason: 'Clase cancelada por el club',
      publish_spot: false,
      created_by: user.id,
    }))
  )

  let credited = 0
  if (creditBags) {
    for (const e of toProcess) {
      const { data: bag } = await admin.from('class_bag').select('id, balance_60, balance_90').eq('user_id', e.student_id).single()
      if (!bag) continue
      const newBal60 = durationType === '60' ? bag.balance_60 + 1 : bag.balance_60
      const newBal90 = durationType === '90' ? bag.balance_90 + 1 : bag.balance_90
      await admin.from('class_bag').update({ balance_60: newBal60, balance_90: newBal90, updated_at: new Date().toISOString() }).eq('id', bag.id)
      await admin.from('bag_transactions').insert({
        user_id: e.student_id,
        class_bag_id: bag.id,
        delta: 1,
        type: 'credit',
        reason: `Clase cancelada ${date}`,
        class_duration: durationType,
      })
      credited++
    }
  }

  return NextResponse.json({ ok: true, credited })
}
