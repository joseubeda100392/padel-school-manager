export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// Sesiones marcadas por el profesor y pendientes de que el admin las confirme.
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const cookieStore = cookies()
  const clubId = caller.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? caller.club_id)
    : caller.club_id
  if (!clubId) return NextResponse.json({ sessions: [] })

  const { data: sessions, error } = await admin
    .from('class_sessions')
    .select(`
      id, schedule_id, session_date, status, cancel_reason, marked_by_coach_at,
      coach:users!class_sessions_marked_by_coach_fkey(name),
      schedule:schedules(start_time, end_time, court:courts(name), coach:users!schedules_coach_id_fkey(name)),
      absences:class_session_absences(id, student:users!class_session_absences_student_id_fkey(id, name))
    `)
    .eq('club_id', clubId)
    .not('marked_by_coach', 'is', null)
    .is('confirmed_by_admin', null)
    .order('session_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sessions: sessions ?? [] })
}
