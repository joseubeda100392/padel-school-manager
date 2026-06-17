export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_FEATURES } from '@/lib/get-club-features'

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

  const isSuperAdmin = caller.role === 'super_admin'
  if (!caller.club_id) return NextResponse.json({ features: DEFAULT_FEATURES, isSuperAdmin })

  const { data } = await admin.from('clubs').select('features').eq('id', caller.club_id).single()
  return NextResponse.json({ features: { ...DEFAULT_FEATURES, ...(data?.features ?? {}) }, isSuperAdmin })
}

export async function PATCH(req: NextRequest) {
  const result = await getEffectiveCaller()
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { caller, admin } = result

  if (!caller.club_id) return NextResponse.json({ error: 'Sin club asignado' }, { status: 400 })

  const body = await req.json()
  const allowed = Object.keys(DEFAULT_FEATURES)
  const features: Record<string, boolean> = {}
  for (const key of allowed) {
    if (key in body) features[key] = Boolean(body[key])
  }

  const { data: existing } = await admin.from('clubs').select('features').eq('id', caller.club_id).single()
  const merged = { ...DEFAULT_FEATURES, ...(existing?.features ?? {}), ...features }

  const { error } = await admin.from('clubs').update({ features: merged }).eq('id', caller.club_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ features: merged })
}
