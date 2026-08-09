export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { calculateCoachPending } from '@/lib/coach-payroll'

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
  if (!clubId) return NextResponse.json({ coaches: [] })

  const { data: coaches } = await admin
    .from('users')
    .select('id, name, email, hourly_rate_cents')
    .eq('club_id', clubId)
    .eq('role', 'coach')
    .eq('is_active', true)
    .order('name')

  const results = await Promise.all(
    (coaches ?? []).map(async (coach) => {
      const pending = await calculateCoachPending(admin, coach.id, clubId)
      return { id: coach.id, name: coach.name, email: coach.email, ...pending }
    })
  )

  return NextResponse.json({ coaches: results })
}
