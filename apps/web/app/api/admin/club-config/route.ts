export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const DEFAULT_CONFIG = {
  pay_per_class_price_60: 1200,
  pay_per_class_price_90: 1500,
  whole_class_price_60: 4800,
  whole_class_price_90: 6000,
  pack_price_60: 9000,
  classes_per_pack_60: 10,
  pack_price_90: 12000,
  classes_per_pack_90: 10,
  cancellation_hours: 24,
  falta_advance_months: 0,
  max_recovery_classes: 0,
  school_name: 'Mi Escuela de Pádel',
  billing_start_date: '',
  standard_discount_cents: 4000,
  price_per_class_with_court_60: 0,
  price_per_class_with_court_90: 0,
  price_per_class_without_court_60: 0,
  price_per_class_without_court_90: 0,
  // Módulo enable_private_lessons (exclusivo R3) — clase suelta y bono para
  // alumnos marcados como "externo" (misma escuela, sin cuota fija).
  pay_per_class_price_60_external: 0,
  pay_per_class_price_90_external: 0,
  pack_price_60_external: 0,
  classes_per_pack_60_external: 0,
  pack_price_90_external: 0,
  classes_per_pack_90_external: 0,
  // Clase particular (1 a 1) — 4 combinaciones: alumno interno/externo ×
  // monitor normal/premium. El monitor premium se marca en su ficha
  // (is_premium_private_coach), el alumno externo en la suya (is_external).
  private_lesson_price_60: 0,
  private_lesson_price_90: 0,
  private_lesson_price_60_external: 0,
  private_lesson_price_90_external: 0,
  private_lesson_price_60_premium: 0,
  private_lesson_price_90_premium: 0,
  private_lesson_price_60_premium_external: 0,
  private_lesson_price_90_premium_external: 0,
  // Bono de clases particulares — mismas 4 combinaciones, con nº de clases
  // por bono además del precio.
  private_lesson_pack_price_60: 0,
  private_lesson_pack_classes_60: 0,
  private_lesson_pack_price_90: 0,
  private_lesson_pack_classes_90: 0,
  private_lesson_pack_price_60_external: 0,
  private_lesson_pack_classes_60_external: 0,
  private_lesson_pack_price_90_external: 0,
  private_lesson_pack_classes_90_external: 0,
  private_lesson_pack_price_60_premium: 0,
  private_lesson_pack_classes_60_premium: 0,
  private_lesson_pack_price_90_premium: 0,
  private_lesson_pack_classes_90_premium: 0,
  private_lesson_pack_price_60_premium_external: 0,
  private_lesson_pack_classes_60_premium_external: 0,
  private_lesson_pack_price_90_premium_external: 0,
  private_lesson_pack_classes_90_premium_external: 0,
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
  // Todas las claves de DEFAULT_CONFIG son numéricas salvo estas dos strings
  // — se deriva la lista en vez de mantener un array literal que hay que
  // recordar de ampliar cada vez que se añade un precio nuevo.
  const stringKeys = new Set(['school_name', 'billing_start_date'])
  const numericKeys = Object.keys(DEFAULT_CONFIG).filter(key => !stringKeys.has(key))
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
  if (error) return NextResponse.json({ error: 'Error al actualizar la configuración' }, { status: 400 })
  return NextResponse.json({ config: merged })
}
