export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
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
  if (!clubId) return NextResponse.json({ error: 'Club no encontrado' }, { status: 400 })

  const { data: campaigns } = await admin
    .from('pista_viva_campaigns')
    .select('*, levels(name)')
    .eq('club_id', clubId)
    .order('slot_datetime', { ascending: false })
    .limit(100)

  return NextResponse.json({ campaigns: campaigns ?? [] })
}

export async function POST(req: NextRequest) {
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
  if (!clubId) return NextResponse.json({ error: 'Club no encontrado' }, { status: 400 })

  const { courtName, resourceId, slotDatetime, durationMinutes = 90, targetLevelId, message, playersNeeded = 4 } = await req.json()
  if (!courtName || !resourceId || !slotDatetime) {
    return NextResponse.json({ error: 'courtName, resourceId y slotDatetime son obligatorios' }, { status: 400 })
  }

  const { data: campaign, error } = await admin
    .from('pista_viva_campaigns')
    .upsert({
      club_id: clubId,
      court_name: courtName,
      resource_id: resourceId,
      slot_datetime: slotDatetime,
      duration_minutes: durationMinutes,
      target_level_id: targetLevelId ?? null,
      message: message ?? null,
      players_needed: playersNeeded,
      status: 'draft',
      created_by: user.id,
    }, { onConflict: 'club_id,resource_id,slot_datetime', ignoreDuplicates: false })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign })
}
