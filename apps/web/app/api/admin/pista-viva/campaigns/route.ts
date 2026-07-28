export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
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

  const { data: postBody, error: badPost } = await parseBody(req, z.object({
    courtName: z.string().min(1).max(200),
    resourceId: z.string().min(1),
    slotDatetime: z.string().min(1),
    durationMinutes: z.number().int().positive().optional(),
    targetLevelId: z.string().uuid().nullable().optional(),
    message: z.string().max(2000).nullable().optional(),
    playersNeeded: z.number().int().min(1).max(10).optional(),
  }))
  if (badPost) return badPost
  const { courtName, resourceId, slotDatetime, durationMinutes = 90, targetLevelId, message, playersNeeded = 4 } = postBody

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

  if (error) return NextResponse.json({ error: 'Error al crear la campaña' }, { status: 500 })
  return NextResponse.json({ campaign })
}

export async function PATCH(req: NextRequest) {
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

  const { data: patchBody, error: badPatch } = await parseBody(req, z.object({
    id: z.string().uuid(),
    targetLevelId: z.string().uuid().nullable().optional(),
    message: z.string().max(2000).nullable().optional(),
    playersNeeded: z.number().int().min(1).max(10).optional(),
  }))
  if (badPatch) return badPatch
  const { id, targetLevelId, message, playersNeeded } = patchBody

  const update: Record<string, any> = {}
  if (targetLevelId !== undefined) update.target_level_id = targetLevelId || null
  if (message !== undefined) update.message = message
  if (playersNeeded !== undefined) update.players_needed = playersNeeded

  const { error } = await admin
    .from('pista_viva_campaigns')
    .update(update)
    .eq('id', id)
    .eq('club_id', clubId)

  if (error) return NextResponse.json({ error: 'Error al actualizar la campaña' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
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

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id es obligatorio' }, { status: 400 })

  const { error } = await admin
    .from('pista_viva_campaigns')
    .delete()
    .eq('id', id)
    .eq('club_id', clubId)

  if (error) return NextResponse.json({ error: 'Error al eliminar la campaña' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
