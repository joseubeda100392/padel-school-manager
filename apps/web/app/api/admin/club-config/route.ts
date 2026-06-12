export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const DEFAULT_CONFIG = {
  pay_per_class_price_60: 1200,
  pay_per_class_price_90: 1500,
  pack_price_60: 9000,
  classes_per_pack_60: 10,
  pack_price_90: 12000,
  classes_per_pack_90: 10,
  cancellation_hours: 24,
  school_name: 'Mi Escuela de Pádel',
}

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

  if (!caller.club_id) return NextResponse.json({ config: DEFAULT_CONFIG })

  const { data } = await admin.from('clubs').select('config').eq('id', caller.club_id).single()
  return NextResponse.json({ config: { ...DEFAULT_CONFIG, ...(data?.config ?? {}) } })
}

export async function PATCH(req: NextRequest) {
  const result = await getEffectiveCaller()
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { caller, admin } = result

  if (!caller.club_id) return NextResponse.json({ error: 'Sin club asignado' }, { status: 400 })

  const body = await req.json()
  const numericKeys = ['pay_per_class_price_60','pay_per_class_price_90','pack_price_60','classes_per_pack_60','pack_price_90','classes_per_pack_90','cancellation_hours']
  const updates: Record<string, number | string> = {}
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (!(key in body)) continue
    if (numericKeys.includes(key)) {
      const n = Number(body[key])
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `Valor inválido para ${key}` }, { status: 400 })
      }
      updates[key] = n
    } else {
      updates[key] = String(body[key])
    }
  }

  const { data: existing } = await admin.from('clubs').select('config').eq('id', caller.club_id).single()
  const merged = { ...DEFAULT_CONFIG, ...(existing?.config ?? {}), ...updates }

  const { error } = await admin.from('clubs').update({ config: merged }).eq('id', caller.club_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ config: merged })
}
