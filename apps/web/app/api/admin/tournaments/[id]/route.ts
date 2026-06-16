export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

async function getCaller() {
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await getCaller()
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { caller, admin } = result

  const { data: tournament } = await admin.from('tournaments').select('club_id').eq('id', params.id).single()
  if (!tournament || tournament.club_id !== caller.club_id) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    tournament_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    location: z.string().nullable().optional(),
    max_players: z.number().int().min(2).optional(),
    price_cents: z.number().int().min(0).optional(),
    status: z.enum(['open', 'closed', 'finished']).optional(),
    allowed_level_ids: z.array(z.string().uuid()).optional(),
  }))
  if (badRequest) return badRequest

  const { error } = await admin.from('tournaments').update(body).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await getCaller()
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { caller, admin } = result

  const { data: tournament } = await admin.from('tournaments').select('club_id').eq('id', params.id).single()
  if (!tournament || tournament.club_id !== caller.club_id) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  await admin.from('tournament_registrations').delete().eq('tournament_id', params.id)
  const { error } = await admin.from('tournaments').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
