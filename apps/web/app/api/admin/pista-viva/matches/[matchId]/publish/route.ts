export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getPlaytomicClient } from '@/lib/playtomic'

export async function POST(req: NextRequest, { params }: { params: { matchId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: club } = await admin
    .from('clubs')
    .select('playtomic_email, playtomic_password')
    .eq('id', caller.club_id)
    .single()

  if (!club?.playtomic_email || !club?.playtomic_password) {
    return NextResponse.json({ error: 'Credenciales Playtomic no configuradas' }, { status: 400 })
  }

  const ptClient = getPlaytomicClient()
  await ptClient.login(club.playtomic_email, club.playtomic_password)

  try {
    await ptClient.publishMatch(params.matchId)
    return NextResponse.json({ ok: true, matchId: params.matchId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
