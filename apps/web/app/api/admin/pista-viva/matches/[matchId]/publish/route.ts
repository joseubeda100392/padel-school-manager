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

  const results: Record<string, unknown> = {}
  for (const visibility of ['PUBLIC', 'VISIBLE']) {
    const res = await fetch(`https://api.playtomic.io/v1/matches/${params.matchId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(ptClient as any).token}`,
        'X-Requested-With': 'com.playtomic.app',
        'User-Agent': 'Playtomic/1 CFNetwork/1410.1 Darwin/22.6.0',
      },
      body: JSON.stringify({ visibility }),
    })
    const body = await res.text()
    results[visibility] = { status: res.status, body: body.slice(0, 500) }
    if (res.ok) break
  }

  return NextResponse.json({ matchId: params.matchId, results })
}
