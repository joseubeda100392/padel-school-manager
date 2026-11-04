export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { nextScheduleCode } from '@/lib/schedule-code'

// Código que se propone al crear una clase (el siguiente al más alto del club).
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }
  const clubId = caller.role === 'super_admin'
    ? (cookies().get('sa_active_club')?.value ?? caller.club_id)
    : caller.club_id
  if (!clubId) return NextResponse.json({ code: '' })

  const { data, error } = await admin.from('schedules').select('code').eq('club_id', clubId).not('code', 'is', null)
  if (error) {
    console.error('[next-code] no se pudieron leer los códigos', clubId, error)
    return NextResponse.json({ code: '' })
  }
  return NextResponse.json({ code: nextScheduleCode((data ?? []).map(s => s.code)) })
}
