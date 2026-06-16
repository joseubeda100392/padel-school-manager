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

  const { scheduleIds } = await req.json()
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    return NextResponse.json({ error: 'scheduleIds requerido' }, { status: 400 })
  }

  if (caller.role !== 'super_admin' && caller.club_id) {
    const { data: schedules } = await admin
      .from('schedules')
      .select('id, club_id')
      .in('id', scheduleIds)

    const foreign = (schedules ?? []).filter((s: any) => s.club_id !== caller.club_id)
    if (foreign.length > 0) {
      return NextResponse.json({ error: 'Sin permisos para borrar algunos horarios' }, { status: 403 })
    }
  }

  await admin.from('group_enrollments').delete().in('schedule_id', scheduleIds)
  await admin.from('bookings').delete().in('schedule_id', scheduleIds)
  await admin.from('schedules').delete().in('id', scheduleIds)

  return NextResponse.json({ ok: true })
}
