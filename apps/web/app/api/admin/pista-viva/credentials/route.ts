export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

async function resolveClubId(callerId: string, callerRole: string, callerClubId: string | null) {
  const cookieStore = cookies()
  if (callerRole === 'super_admin') {
    return cookieStore.get('sa_active_club')?.value ?? callerClubId
  }
  return callerClubId
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const clubId = await resolveClubId(user.id, caller.role, caller.club_id)
  if (!clubId) return NextResponse.json({ error: 'Club no encontrado' }, { status: 400 })

  const { data: club } = await admin
    .from('clubs')
    .select('playtomic_email, playtomic_tenant_id, playtomic_booking_url')
    .eq('id', clubId)
    .single()

  return NextResponse.json({
    playtomic_email: club?.playtomic_email ?? '',
    playtomic_tenant_id: club?.playtomic_tenant_id ?? '',
    playtomic_booking_url: club?.playtomic_booking_url ?? '',
  })
}

export async function PUT(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const clubId = await resolveClubId(user.id, caller.role, caller.club_id)
  if (!clubId) return NextResponse.json({ error: 'Club no encontrado' }, { status: 400 })

  const body = await req.json()
  const update: Record<string, string> = {}
  if (body.playtomic_email) update.playtomic_email = body.playtomic_email
  if (body.playtomic_password) update.playtomic_password = body.playtomic_password
  if (body.playtomic_tenant_id) update.playtomic_tenant_id = body.playtomic_tenant_id
  if (body.playtomic_booking_url) update.playtomic_booking_url = body.playtomic_booking_url
  if (body.playtomic_client_id) update.playtomic_client_id = body.playtomic_client_id
  if (body.playtomic_client_secret) update.playtomic_client_secret = body.playtomic_client_secret

  const { error } = await admin.from('clubs').update(update).eq('id', clubId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
