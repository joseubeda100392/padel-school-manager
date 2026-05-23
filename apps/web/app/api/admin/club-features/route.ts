export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_FEATURES } from '@/lib/get-club-features'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (!caller.club_id) return NextResponse.json({ features: DEFAULT_FEATURES })

  const { data } = await admin.from('clubs').select('features').eq('id', caller.club_id).single()
  return NextResponse.json({ features: { ...DEFAULT_FEATURES, ...(data?.features ?? {}) } })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

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
