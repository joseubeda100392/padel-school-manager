export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { getPlaytomicClient } from '@/lib/playtomic'

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

  const { data: club } = await admin
    .from('clubs')
    .select('playtomic_tenant_id')
    .eq('id', clubId)
    .single()

  if (!club?.playtomic_tenant_id) {
    return NextResponse.json({ error: 'tenant_id de Playtomic no configurado' }, { status: 400 })
  }

  const now = new Date()
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const startMin = now.toISOString().replace('Z', '').split('.')[0]
  const startMax = in48h.toISOString().replace('Z', '').split('.')[0]

  const client = getPlaytomicClient()
  try {
    const resources = await client.getAvailableSlots(club.playtomic_tenant_id, startMin, startMax)
    return NextResponse.json({ resources })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Error al consultar Playtomic', resources: [] }, { status: 502 })
  }
}
