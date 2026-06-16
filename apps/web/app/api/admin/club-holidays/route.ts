export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

async function getEffectiveCaller() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) return null
  const cookieStore = cookies()
  const effectiveClubId = caller.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? caller.club_id)
    : caller.club_id
  return { caller: { ...caller, club_id: effectiveClubId }, admin }
}

export async function GET() {
  const result = await getEffectiveCaller()
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { caller, admin } = result

  if (!caller.club_id) return NextResponse.json({ holidays: [] })

  const { data } = await admin.from('clubs').select('config').eq('id', caller.club_id).single()
  const holidays: string[] = (data?.config as any)?.holidays ?? []
  return NextResponse.json({ holidays })
}

export async function PATCH(req: NextRequest) {
  const result = await getEffectiveCaller()
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { caller, admin } = result

  if (!caller.club_id) return NextResponse.json({ error: 'Sin club asignado' }, { status: 400 })

  const body = await req.json()
  const holidays: string[] = (body.holidays ?? []).filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))

  const { data: existing } = await admin.from('clubs').select('config').eq('id', caller.club_id).single()
  const merged = { ...(existing?.config ?? {}), holidays }

  const { error } = await admin.from('clubs').update({ config: merged }).eq('id', caller.club_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ holidays })
}
