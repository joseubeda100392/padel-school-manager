export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

const tournamentSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  tournament_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().nullable().optional(),
  max_players: z.number().int().min(2).max(256),
  price_cents: z.number().int().min(0),
  status: z.enum(['open', 'closed', 'finished']).optional(),
})

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

export async function GET() {
  const result = await getCaller()
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { caller, admin } = result

  const { data, error } = await admin
    .from('tournaments')
    .select('*, registrations:tournament_registrations(count)')
    .eq('club_id', caller.club_id ?? '')
    .order('tournament_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tournaments: data ?? [] })
}

export async function POST(req: NextRequest) {
  const result = await getCaller()
  if (!result) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { caller, admin } = result

  if (!caller.club_id) return NextResponse.json({ error: 'Sin club asignado' }, { status: 400 })

  const { data: body, error: badRequest } = await parseBody(req, tournamentSchema)
  if (badRequest) return badRequest

  const { data, error } = await admin
    .from('tournaments')
    .insert({
      club_id: caller.club_id,
      name: body.name,
      description: body.description ?? null,
      tournament_date: body.tournament_date,
      location: body.location ?? null,
      max_players: body.max_players,
      price_cents: body.price_cents,
      status: body.status ?? 'open',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
